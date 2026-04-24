// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/agentLoop.ts — 3-step agent loop:
//   STEP 1: PLAN   — LLM outputs JSON plan only (no execution)
//   STEP 2: EXECUTE — Code runs each tool, gets real results
//   STEP 3: RESPOND — LLM sees real results, streams natural language

import { executeTool, TOOLS, getToolTier, detectToolCategories, getToolsForCategories } from './toolRegistry'
import { loadAllRecipes, matchRecipe, executeRecipe } from './recipeEngine'
import { livePulse }          from '../coordination/livePulse'
import { planTool }                        from './planTool'
import type { Phase }                      from './planTool'
import { WorkspaceMemory }                 from './workspaceMemory'
import { taskStateManager, TaskState }     from './taskState'
import { skillLoader, isSimpleMessage, needsMemory } from './skillLoader'
import { entityGraph }                      from './entityGraph'
import { learningMemory }                  from './learningMemory'
import { conversationMemory }             from './conversationMemory'
import { getNextAvailableAPI, markRateLimited, markHealthy, incrementUsage, getModelForTask, getOllamaModelForTask, enterDegradedMode } from '../providers/router'
import { ollamaProvider } from '../providers/ollama'
import { loadConfig }     from '../providers/index'
import { knowledgeBase } from './knowledgeBase'
import { skillTeacher }  from './skillTeacher'
import { growthEngine }  from './growthEngine'
import { AIDEN_RESPONDER_SYSTEM } from './aidenPersonality'
import { auditTrail }             from './auditTrail'
import { mcpClient }             from './mcpClient'
import { unifiedMemoryRecall, buildMemoryInjection } from './memoryRecall'
import { costTracker } from './costTracker'
import { getOllamaTimeout } from './modelDiscovery'
import { semanticMemory }          from './semanticMemory'
import { createChildSession }      from './sessionMemory'
import { getActiveGoalsSummary }  from './goalTracker'
import { fireHook }               from './hooks'
import { instinctSystem }         from './instinctSystem'
import { startWorkflow, addNode, updateNode, completeWorkflow } from './workflowTracker'
import { MAX_PARALLEL, chunkSteps, hasParallelism } from './parallelExecutor'
import { sanitizeMessages }  from './messageValidator'
import { repairToolName }    from './toolNameRepair'
import { SLASH_MIRROR_TOOL_NAMES } from './slashAsTool'
import { repairPlanResponse }      from './planResponseRepair'
import * as nodeFs             from 'fs'
import * as nodePath           from 'path'
import * as nodeOs             from 'os'

// ── Pre-compact threshold ──────────────────────────────────────
// Fire pre_compact hook when history has this many messages
const COMPACT_THRESHOLD = 40

// ── Interrupt / stop state ─────────────────────────────────────
let currentAbortController: AbortController | null = null
let executionInterrupted = false

export function interruptCurrentCall(): void {
  executionInterrupted = true
  if (currentAbortController) {
    currentAbortController.abort()
    currentAbortController = null
  }
}

// ── Iteration budget ───────────────────────────────────────────
interface IterationBudget {
  maxIterations:    number
  currentIteration: number
  cautionThreshold: number   // 0.7 (70%)
  warningThreshold: number   // 0.9 (90%)
}

function getBudgetWarning(budget: IterationBudget): string | null {
  const usage     = budget.currentIteration / budget.maxIterations
  const remaining = budget.maxIterations - budget.currentIteration
  if (usage >= budget.warningThreshold) {
    return `[BUDGET WARNING: Turn ${budget.currentIteration}/${budget.maxIterations}. Only ${remaining} turn(s) left. Provide your final response NOW. Do not start new tool calls.]`
  }
  if (usage >= budget.cautionThreshold) {
    return `[BUDGET: Turn ${budget.currentIteration}/${budget.maxIterations}. ${remaining} turns left. Start consolidating your work and prepare a response.]`
  }
  return null
}

let _activeBudget: IterationBudget | null = null

export function getBudgetState(): { current: number; max: number; remaining: number } | null {
  if (!_activeBudget) return null
  return {
    current:   _activeBudget.currentIteration,
    max:       _activeBudget.maxIterations,
    remaining: _activeBudget.maxIterations - _activeBudget.currentIteration,
  }
}

// ── Token-based preflight compression ─────────────────────────

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function estimateConversationTokens(messages: { role: string; content: string }[]): number {
  return messages.reduce((sum, msg) => {
    const content = typeof msg.content === 'string'
      ? msg.content
      : JSON.stringify(msg.content || '')
    return sum + estimateTokens(content) + 4  // 4 tokens per message overhead
  }, 0)
}

const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'llama-3.1-8b-instant':           8192,
  'llama-3.3-70b-versatile':        32768,
  'gemma-7b-it':                    8192,
  'gemma2-9b-it':                   8192,
  'mixtral-8x7b-32768':             32768,
  'deepseek-r1-distill-llama-70b':  32768,
  'qwen-2.5-72b-instruct':          32768,
  'gemini-2.0-flash':               1048576,
  'gemini-1.5-flash':               1048576,
  'gpt-4o':                         128000,
  'claude-sonnet-4-20250514':       200000,
  'gemini-3-flash':                 1048576,
  'gemini-3.1-pro':                 1048576,
  'gpt-5.3-codex':                  200000,
  'default':                        8192,
}

function getContextLimit(model: string): number {
  return MODEL_CONTEXT_LIMITS[model] ?? MODEL_CONTEXT_LIMITS['default']
}

async function flushMemoryFromMessages(messages: { role: string; content: string }[]): Promise<void> {
  const userMessages = messages
    .filter(m => m.role === 'user')
    .map(m => String(m.content))
    .join('\n')

  if (userMessages.length > 100) {
    try {
      semanticMemory.add(userMessages.slice(0, 500), 'exchange', ['preflight_compression'])
      console.log('[Context] Memory flushed before compression')
    } catch {
      console.log('[Context] Memory flush skipped — extractor unavailable')
    }
  }
}

async function preflightCompressionCheck(
  messages:   { role: string; content: string }[],
  model:      string,
  sessionId?: string,
): Promise<{ role: string; content: string }[]> {
  const tokenCount   = estimateConversationTokens(messages)
  const contextLimit = getContextLimit(model)
  const usage        = tokenCount / contextLimit

  console.log(`[Context] ${tokenCount} tokens / ${contextLimit} limit (${(usage * 100).toFixed(0)}%)`)

  if (usage < 0.5) {
    // Under 50% — no compression needed
    return messages
  }

  console.log(`[Context] Over 50% — compressing middle messages`)

  // Track parent/child lineage across compressions
  if (sessionId) {
    try {
      createChildSession(sessionId, 'preflight_compression', messages.length, tokenCount)
    } catch {
      console.log('[Context] Session lineage tracking skipped')
    }
  }

  // Step 1: Flush memory before compressing
  await flushMemoryFromMessages(messages)

  // Step 2: Keep first 2 messages (system + first user) and last 10 messages
  const protectedStart = messages.slice(0, 2)
  const protectedEnd   = messages.slice(-10)
  const middleMessages = messages.slice(2, -10)

  if (middleMessages.length < 3) {
    return messages  // not enough to compress
  }

  // Step 3: Summarize middle messages into a single system message
  const middleText = middleMessages
    .map(m => `${m.role}: ${String(m.content).substring(0, 200)}`)
    .join('\n')

  const summary: { role: string; content: string } = {
    role:    'system',
    content: `[COMPRESSED CONTEXT — ${middleMessages.length} messages summarized]\n` +
      `Previous conversation covered: ${middleText.substring(0, 1000)}\n` +
      `[End compressed context]`,
  }

  const compressed = [...protectedStart, summary, ...protectedEnd]

  const newTokens = estimateConversationTokens(compressed)
  console.log(
    `[Context] Compressed: ${tokenCount} → ${newTokens} tokens ` +
    `(${messages.length} → ${compressed.length} messages)`,
  )

  return compressed
}

// ── Proactive memory surfacing ─────────────────────────────────

const SKIP_MEMORY_PATTERNS = [
  /^(hi|hello|hey|thanks|ok|yes|no|sure|bye)\b/i,
  /^.{1,15}$/,
]

export async function surfaceRelevantMemories(userMessage: string): Promise<string> {
  if (SKIP_MEMORY_PATTERNS.some(p => p.test(userMessage.trim()))) return ''

  const memories: string[] = []

  // 1. Semantic memory search
  try {
    const results = semanticMemory.search(userMessage, 5)
    for (const r of results) {
      memories.push(`[Memory] ${r.text}`)
    }
  } catch {}

  // 2. Memory directory files — keyword match
  try {
    const memDir = nodePath.join(process.cwd(), 'workspace', 'memory')
    if (nodeFs.existsSync(memDir)) {
      const files    = nodeFs.readdirSync(memDir).filter((f: string) => f.endsWith('.md'))
      const keywords = userMessage.toLowerCase().split(/\s+/).filter((k: string) => k.length > 3)

      for (const file of files) {
        try {
          const content      = nodeFs.readFileSync(nodePath.join(memDir, file), 'utf8')
          const contentLower = content.toLowerCase()
          const matches      = keywords.filter((k: string) => contentLower.includes(k))
          if (matches.length >= 2) {
            const body = content.split('---').slice(2).join('---').trim()
            if (body.length > 0 && body.length < 500) {
              memories.push(`[Memory] ${body}`)
            }
          }
        } catch {}
      }
    }
  } catch {}

  if (memories.length === 0) return ''

  const unique = [...new Set(memories)].slice(0, 8)
  console.log(`[Memory] Surfaced ${unique.length} memories for: "${userMessage.substring(0, 40)}"`)

  return '\n## Relevant Context from Memory\n' + unique.join('\n') + '\n'
}

// ── Types ─────────────────────────────────────────────────────

export interface ToolStep {
  step:        number
  tool:        string
  input:       Record<string, any>
  description: string
}

export interface AgentPlan {
  goal:               string
  goals?:             string[]   // multi-goal decomposition list (Phase 1)
  requires_execution: boolean
  plan:               ToolStep[]
  direct_response?:   string
  planId?:            string
  workspaceDir?:      string
  phases?:            Phase[]
  reason?:            string
  repairLog?:         string[]   // Phase 2: tool name auto-repairs applied
}

export interface StepResult {
  step:     number
  tool:     string
  input:    Record<string, any>
  success:  boolean
  output:   string
  error?:   string
  duration: number
}

export interface ExecutionState {
  goal:           string
  completedSteps: StepResult[]
  currentStep:    number
  lastError?:     string
  startTime:      number
}

export interface LoopResult {
  plan:     AgentPlan
  results:  StepResult[]
  response: string
}

// ── Template resolver ──────────────────────────────────────────
// Replaces {{step_N_output}} tokens with actual step outputs

export function resolveTemplates(input: string, stepOutputs: string[]): string {
  return input.replace(/\{\{step_(\d+)_output\}\}/g, (_match, n) => {
    const idx = parseInt(n, 10)
    return stepOutputs[idx] ?? `(step ${idx} output unavailable)`
  })
}

// ── SSE stream helpers ─────────────────────────────────────────

export async function streamOpenAIResponse(
  res:     any,
  onToken: (token: string) => void,
): Promise<void> {
  if (!res.body) return
  const reader  = (res.body as any).getReader()
  const decoder = new TextDecoder()
  let buf = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const raw = line.replace('data: ', '').trim()
      if (raw === '[DONE]') return
      try {
        const parsed = JSON.parse(raw) as any
        const token  = parsed?.choices?.[0]?.delta?.content
        if (token) onToken(token)
      } catch {}
    }
  }
}

export async function streamGeminiResponse(
  res:     any,
  onToken: (token: string) => void,
): Promise<void> {
  // Gemini streaming with ?alt=sse returns SSE events with data: prefix
  if (!res.body) return
  const reader  = (res.body as any).getReader()
  const decoder = new TextDecoder()
  let buf = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const raw = line.replace('data: ', '').trim()
      try {
        const parsed = JSON.parse(raw) as any
        const text   = parsed?.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) onToken(text)
      } catch {}
    }
  }
}

// ── Provider endpoint map ──────────────────────────────────────

const OPENAI_COMPAT_ENDPOINTS: Record<string, string> = {
  groq:       'https://api.groq.com/openai/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  cerebras:   'https://api.cerebras.ai/v1/chat/completions',
  nvidia:     'https://integrate.api.nvidia.com/v1/chat/completions',
  github:     'https://models.inference.ai.azure.com/v1/chat/completions',
  boa:        'https://api.bayofassets.com/v1/chat/completions',
}

function buildHeaders(providerName: string, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }
  if (providerName === 'openrouter') {
    headers['HTTP-Referer'] = 'http://localhost:3000'
    headers['X-Title']      = 'DevOS'
  }
  return headers
}

// ── Phase inference from tool steps ───────────────────────────
// Groups consecutive steps of the same capability type into phases.

function inferPhasesFromSteps(
  steps: ToolStep[],
): Omit<Phase, 'status' | 'result' | 'startedAt' | 'completedAt'>[] {
  const capabilityMap: Record<string, string> = {
    web_search:      'research', fetch_page:      'research',
    deep_research:   'research', fetch_url:       'research',
    get_stocks:      'research',
    open_browser:    'browsing', browser_click:   'browsing',
    browser_extract: 'browsing', browser_type:    'browsing',
    mouse_move:      'browsing', mouse_click:     'browsing',
    keyboard_type:   'browsing', keyboard_press:  'browsing',
    screenshot:      'browsing', screen_read:     'browsing',
    vision_loop:     'browsing',
    file_write:      'writing',  file_read:       'reading',
    file_list:       'reading',  shell_exec:      'execution',
    run_python:      'execution', run_node:       'execution',
    system_info:     'execution', notify:         'execution',
    clipboard_read:  'execution', clipboard_write: 'execution',
    window_list:     'execution', window_focus:   'execution',
    app_launch:      'execution', app_close:      'execution',
    watch_folder:    'execution', watch_folder_list: 'execution',
  }
  const phaseNames: Record<string, string> = {
    research:  'Research & Gather',
    browsing:  'Browse & Extract',
    writing:   'Write & Save',
    reading:   'Read & Analyze',
    execution: 'Execute Tasks',
    delivery:  'Deliver Results',
  }

  const phases: Omit<Phase, 'status' | 'result' | 'startedAt' | 'completedAt'>[] = []
  let currentCap  = ''
  let currentTools: string[] = []

  for (const step of steps) {
    const cap = capabilityMap[step.tool] || 'execution'
    if (cap !== currentCap && currentTools.length > 0) {
      phases.push({
        id:           `phase_${phases.length + 1}`,
        title:        phaseNames[currentCap] || currentCap,
        capabilities: [currentCap as Phase['capabilities'][0]],
        tools:        [...currentTools],
      })
      currentTools = []
    }
    currentCap = cap
    currentTools.push(step.tool)
  }

  if (currentTools.length > 0) {
    phases.push({
      id:           `phase_${phases.length + 1}`,
      title:        phaseNames[currentCap] || currentCap,
      capabilities: [currentCap as Phase['capabilities'][0]],
      tools:        currentTools,
    })
  }

  // Always end with a Deliver Results phase
  phases.push({
    id:           `phase_${phases.length + 1}`,
    title:        'Deliver Results',
    capabilities: ['delivery'],
    tools:        ['respond'],
  })

  return phases
}

// ── Keyword-based plan inference — fallback when LLM unavailable ──────
// Detects simple single-tool intents from the message text.

function inferPlanFromKeywords(message: string): any | null {
  const m = message.toLowerCase()

  // notify
  if (/send\s+(a\s+)?(desktop\s+)?notif|notify\s+me|desktop\s+alert/.test(m)) {
    const msgMatch = message.match(/saying\s+(.+?)(?:\s*$)/i)
    const notifMsg = msgMatch ? msgMatch[1].trim() : message
    return {
      goal: message, requires_execution: true,
      plan: [{ step: 1, tool: 'notify', input: { message: notifMsg }, description: 'Send notification' }],
      phases: [],
    }
  }

  // file_read — matches "read the file /path/to/file", "read file C:\...", "tell me what it says"
  const fileReadMatch = message.match(/read\s+(?:the\s+)?file\s+([^\s"']+)/i) ||
                        message.match(/read\s+([A-Z]:[/\\][^\s"']+)/i) ||
                        message.match(/read\s+(\/[^\s"']+\.\w{1,6})/i)
  if (fileReadMatch) {
    const filePath = fileReadMatch[1].trim()
    return {
      goal: message, requires_execution: true,
      plan: [{ step: 1, tool: 'file_read', input: { path: filePath }, description: `Read ${filePath}` }],
      phases: [],
    }
  }

  // file_write — matches "write ... to /path/file"
  const fileWriteMatch = message.match(/write\s+(.+?)\s+to\s+([^\s"']+\.\w{1,6})/i)
  if (fileWriteMatch) {
    const content  = fileWriteMatch[1].trim()
    const filePath = fileWriteMatch[2].trim()
    return {
      goal: message, requires_execution: true,
      plan: [{ step: 1, tool: 'file_write', input: { path: filePath, content }, description: `Write to ${filePath}` }],
      phases: [],
    }
  }

  // fetch_url — matches "Fetch https://...", "fetch http://...", "get https://..."
  const fetchUrlMatch = message.match(/(?:fetch|get|open|load)\s+(https?:\/\/[^\s"']+)/i) ||
                        message.match(/(https?:\/\/[^\s"']+)/i)
  if (fetchUrlMatch) {
    const url = fetchUrlMatch[1].trim()
    return {
      goal: message, requires_execution: true,
      plan: [{ step: 1, tool: 'fetch_url', input: { url }, description: `Fetch ${url}` }],
      phases: [],
    }
  }

  // web_search / search the web
  if (/search\s+(the\s+)?web|web\s+search|look\s+up|find\s+info/.test(m)) {
    const query = message.replace(/search\s+(the\s+)?web\s+(for\s+)?/i, '').replace(/look\s+up\s+/i, '').trim()
    return {
      goal: message, requires_execution: true,
      plan: [{ step: 1, tool: 'web_search', input: { query: query || message }, description: 'Search' }],
      phases: [],
    }
  }

  // get_stocks / stock gainers
  if (/top\s+(gainers|losers|active)|nse\s+top|bse\s+top|stock\s+(market|data|gainers)|get\s+stocks/.test(m)) {
    const isLosers = /loser/.test(m)
    const market   = /bse/.test(m) ? 'BSE' : 'NSE'
    const type     = isLosers ? 'losers' : /active/.test(m) ? 'active' : 'gainers'
    return {
      goal: message, requires_execution: true,
      plan: [{ step: 1, tool: 'get_stocks', input: { market, type }, description: `Get ${market} top ${type}` }],
      phases: [],
    }
  }

  // system_info
  if (/system\s+info|hardware\s+info|what.{0,10}(cpu|ram|memory|os|specs)|show\s+system|computer\s+specs/.test(m)) {
    return {
      goal: message, requires_execution: true,
      plan: [{ step: 1, tool: 'system_info', input: {}, description: 'Get system info' }],
      phases: [],
    }
  }

  // run_python — matches "Run Python: print(...)", "run python code ...", etc.
  const pyMatch = message.match(/run\s+python\s*[:：]?\s*(.+)/i) ||
                  message.match(/python\s+script\s+(?:to\s+)?(.+)/i) ||
                  message.match(/execute\s+python\s*[:：]?\s*(.+)/i)
  if (pyMatch) {
    // Use the captured code portion directly as the script
    const script = pyMatch[1].trim()
    return {
      goal: message, requires_execution: true,
      plan: [{ step: 1, tool: 'run_python', input: { script }, description: 'Run Python' }],
      phases: [],
    }
  }

  // run_node — matches "Run Node.js: console.log(...)", "Run JavaScript: ...", etc.
  const nodeMatch = message.match(/run\s+(?:node(?:\.js)?|javascript|js)\s*[:：]?\s*(.+)/i) ||
                    message.match(/execute\s+(?:node(?:\.js)?|javascript|js)\s*[:：]?\s*(.+)/i)
  if (nodeMatch) {
    const code = nodeMatch[1].trim()
    return {
      goal: message, requires_execution: true,
      plan: [{ step: 1, tool: 'run_node', input: { code }, description: 'Run Node.js' }],
      phases: [],
    }
  }

  return null
}

// ── Sprint 5: Planner racing helper ──────────────────────────
// Fires top-2 available APIs simultaneously; returns first valid JSON string.

async function racePlannerAPIs(
  promptText: string,
  topN = 2,
): Promise<string | null> {
  const cfg  = loadConfig()
  const apis = cfg.providers.apis
    .filter(a => {
      if (!a.enabled || a.rateLimited) return false
      const k = a.key.startsWith('env:') ? (process.env[a.key.replace('env:', '')] || '') : a.key
      // Only race providers that use the OpenAI-compat format.
      // Gemini and Cloudflare use different APIs — they'll be tried via callLLM in the main loop.
      return k.length > 0 && OPENAI_COMPAT_ENDPOINTS[a.provider] !== undefined
    })
    .slice(0, topN)

  if (apis.length < 2) return null

  const controllers = apis.map(() => new AbortController())

  const callOne = async (api: typeof apis[0], ctrl: AbortController): Promise<string> => {
    const key = api.key.startsWith('env:')
      ? (process.env[api.key.replace('env:', '')] || '')
      : api.key
    const messages = [{ role: 'user', content: promptText }]
    // Use callLLM logic inline with abort support
    const url     = OPENAI_COMPAT_ENDPOINTS[api.provider] || OPENAI_COMPAT_ENDPOINTS.groq
    const headers = buildHeaders(api.provider, key)
    const r = await fetch(url, {
      method:  'POST',
      headers,
      body:    JSON.stringify({ model: api.model, messages, stream: false, max_tokens: 2000 }),
      signal:  ctrl.signal,
    })
    if (!r.ok) throw new Error(`${api.provider} ${r.status}`)
    const d = await r.json() as any
    const text = d?.choices?.[0]?.message?.content || ''
    // Only return if it looks like valid JSON
    if (!text.trim() || !text.includes('{')) throw new Error('no JSON')
    return text
  }

  const promises = apis.map((api, i) =>
    callOne(api, controllers[i]).then(text => {
      controllers.forEach((c, j) => { if (j !== i) { try { c.abort() } catch {} } })
      return text
    })
  )

  try {
    return await Promise.race(promises)
  } catch {}
  return null
}

// ── Compaction protection — critical files survive context reset ──
// When the sliding context window summarizes older messages, we re-inject
// these files word-for-word as a system message so identity and rules survive.

const COMPACTION_PROTECTED = [
  'SOUL.md',            // personality + boundaries
  'STANDING_ORDERS.md', // persistent instructions
  'LESSONS.md',         // failure rules
  'GOALS.md',           // active goals
  'USER.md',            // user profile
]

async function rebuildContextAfterCompaction(
  contextHistory: any[],
): Promise<any[]> {
  const workspaceDir      = nodePath.join(process.cwd(), 'workspace')
  const protectedContent: string[] = []

  // Read all protected files
  for (const filename of COMPACTION_PROTECTED) {
    try {
      const filepath = nodePath.join(workspaceDir, filename)
      if (nodeFs.existsSync(filepath)) {
        const content = nodeFs.readFileSync(filepath, 'utf-8')
        if (content.trim()) {
          protectedContent.push(`## ${filename}\n${content.trim()}`)
        }
      }
    } catch {}
  }

  // Top 5 instincts by confidence (read directly from workspace/instincts.json)
  let instinctCount = 0
  try {
    const instinctsPath = nodePath.join(workspaceDir, 'instincts.json')
    if (nodeFs.existsSync(instinctsPath)) {
      const raw      = JSON.parse(nodeFs.readFileSync(instinctsPath, 'utf-8')) as Array<{
        action:     string
        confidence: number
        status:     string
      }>
      const topInsts = raw
        .filter(i => i.status === 'active' && i.confidence >= 0.7)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5)
      if (topInsts.length > 0) {
        const instinctText = topInsts
          .map(i => `- ${i.action} (confidence: ${(i.confidence * 100).toFixed(0)}%)`)
          .join('\n')
        protectedContent.push(`## Active Instincts\n${instinctText}`)
        instinctCount = topInsts.length
      }
    }
  } catch {}

  if (protectedContent.length === 0) return contextHistory

  console.log(
    `[Compaction] Protected ${COMPACTION_PROTECTED.length} files ` +
    `+ ${instinctCount} instincts — re-injected into context`,
  )

  const protectedMessage = {
    role:    'system',
    content: `[PROTECTED CONTEXT — survives compaction]\n\n${protectedContent.join('\n\n---\n\n')}`,
  }

  return [protectedMessage, ...contextHistory]
}

// ── STEP 1: planWithLLM ────────────────────────────────────────

export async function planWithLLM(
  message:       string,
  history:       { role: string; content: string }[],
  apiKey:        string,
  model:         string,
  provider:      string,
  memoryContext?: string,
): Promise<AgentPlan> {

  // ── Pre-compact hook — fire at multiples of COMPACT_THRESHOLD ─
  // Fires at 40, 80, 120 … to avoid triggering on every message after crossing 40.
  if (history.length >= COMPACT_THRESHOLD && history.length % COMPACT_THRESHOLD === 0) {
    fireHook('pre_compact', { historyLength: history.length, message }).catch(() => {})
  }

  // ── Vague goal detection — ask for clarification before planning ──
  const VAGUE_PATTERNS = [/\bthe thing\b/i, /\bthe stuff\b/i, /\bthe place\b/i, /\bdo it\b$/i, /\bfix it\b$/i]
  if (VAGUE_PATTERNS.some(p => p.test(message))) {
    return {
      goal:               message,
      requires_execution: false,
      plan:               [],
      phases:             [],
      direct_response:    'I need more detail. What specifically should I do, with what, and where?',
      reason:             'goal_too_vague',
    }
  }

  // ── Recipe engine — YAML workflow definitions ─────────────────
  // Check before LLM planning: if a recipe trigger matches, execute
  // the structured workflow instead of the probabilistic planner.
  const recipes     = loadAllRecipes()
  const recipeMatch = matchRecipe(message, recipes)
  if (recipeMatch) {
    try {
      const recipeResult = await executeRecipe(recipeMatch.recipe, recipeMatch.params)
      return {
        goal:               message,
        requires_execution: false,
        plan:               [],
        phases:             [],
        direct_response:    recipeResult.output || `Completed recipe: ${recipeMatch.recipe.name}`,
        reason:             `recipe:${recipeMatch.recipe.name}`,
      }
    } catch (err) {
      console.warn(`[Recipe] Execution failed for ${recipeMatch.recipe.name}: ${err} — falling through to LLM planner`)
    }
  }

  const ALLOWED_TOOLS = [
    'web_search', 'fetch_page', 'open_browser', 'browser_extract',
    'browser_click', 'browser_type', 'file_write', 'file_read',
    'file_list', 'shell_exec', 'run_python', 'run_node',
    'system_info', 'notify', 'deep_research', 'get_stocks',
    'get_market_data', 'get_company_info', 'social_research',
    'mouse_move', 'mouse_click', 'keyboard_type', 'keyboard_press',
    'screenshot', 'screen_read', 'vision_loop', 'wait',
    'code_interpreter_python', 'code_interpreter_node',
    'clipboard_read', 'clipboard_write', 'window_list', 'window_focus',
    'app_launch', 'app_close',
    'watch_folder', 'watch_folder_list',
    'get_briefing',
    'respond',
    'clarify', 'todo', 'cronjob', 'vision_analyze',
    'voice_speak', 'voice_transcribe', 'voice_clone', 'voice_design',
    ...SLASH_MIRROR_TOOL_NAMES,
  ]

  // Sprint 13: append discovered MCP tools
  const mcpToolNames = mcpClient.getAllCachedTools().map(t => t.name)
  const allTools     = mcpToolNames.length > 0
    ? [...ALLOWED_TOOLS, ...mcpToolNames]
    : ALLOWED_TOOLS

  // Dynamic tool loading — filter to relevant tools per task category
  // Reduces planner prompt from ~15K to ~3-5K tokens without losing capability.
  // Validation (line ~898) still uses full allTools — filtering is prompt-only.
  const categories    = detectToolCategories(message)
  const categoryTools = getToolsForCategories(categories)
  // MCP tools always included; ALLOWED_TOOLS filtered by detected category
  const plannerTools  = allTools.filter(t => t.startsWith('mcp_') || categoryTools.includes(t))
  console.log(
    `[Tools] ${plannerTools.length}/${allTools.length} tools loaded for categories: ${categories.join(', ')}`
  )
  // Load any relevant skills to guide planning
  const relevantSkills = skillLoader.findRelevant(message)
  const skillContext   = skillLoader.formatForPrompt(relevantSkills)
  // Append instinct context to memory (micro-patterns learned from past tool calls)
  const instinctCtx  = instinctSystem?.getRelevantInstincts(message) || ''
  const fullMemCtx   = (memoryContext || '') + (instinctCtx ? '\n\n' + instinctCtx : '')

  // Build memory section — inject when available
  const memorySection = fullMemCtx.trim()
    ? `\n\nCONVERSATION MEMORY (use to resolve references like "that file", "the report", "it"):\n${fullMemCtx}\n\nWhen the user says "that file", "the report", "the script" etc., use the paths/queries above to resolve them into concrete values in your plan inputs.\n`
    : ''

  // Build learning context — past experiences with similar tasks
  const learningCtx     = learningMemory.buildLearningContext(message)
  const learningSection = learningCtx ? `\n${learningCtx}\n` : ''

  // Build knowledge context — relevant chunks from user's knowledge base files
  const knowledgeCtxPlanner = knowledgeBase.buildContext(message)
  const knowledgeSection    = knowledgeCtxPlanner
    ? `\n\n${knowledgeCtxPlanner}\n`
    : ''

  // LESSONS.md — permanent failure rules, injected every session
  const lessonsContent = loadLessons()
  const lessonsSection = lessonsContent
    ? `\n\nPERMANENT FAILURE RULES (learned from past task failures — follow strictly):\n${lessonsContent.split('\n').filter(l => /^\d+\./.test(l.trim())).map(l => `  ${l.trim()}`).join('\n')}\n`
    : ''

  // Sprint 21: unified memory recall — only when message references past context
  // Gate prevents unnecessary hybrid-search I/O on routine messages
  let memoryRecallSection = ''
  if (needsMemory(message)) {
    try {
      const recalled       = await unifiedMemoryRecall(message, 5)
      const memoryInjected = buildMemoryInjection(recalled)
      if (memoryInjected) {
        memoryRecallSection = memoryInjected
      }
    } catch {}
  }

  // Resolve the actual Windows username and home directory at runtime
  const _sysUsername = process.env.USERNAME || process.env.USER || nodeOs.userInfo().username || 'User'
  const _sysHomedir  = nodeOs.homedir()

  const plannerPrompt = `You are DevOS Planner. Analyze the user request and output a JSON plan.

GOAL DECOMPOSITION: Before writing your plan, count the distinct intents in the user message.
If the message contains 2 or more distinct goals (e.g., "search X AND write a file", "do A then B", "1. … 2. …"), add a "goals" array to your JSON listing each goal as a short phrase (max 8 words each). Your plan MUST cover ALL listed goals — do not silently drop any.
Single-goal messages: omit "goals" or leave it as an empty array.

SYSTEM CONTEXT — use these exact values for all file paths:
- Windows username: ${_sysUsername}
- Home directory: ${_sysHomedir}
- Desktop: ${nodePath.join(_sysHomedir, 'Desktop')}
- Documents: ${nodePath.join(_sysHomedir, 'Documents')}
- Downloads: ${nodePath.join(_sysHomedir, 'Downloads')}
IMPORTANT: NEVER use "C:\\Users\\Aiden" — "Aiden" is the AI assistant's name, NOT the Windows username. Always use "${_sysUsername}" as the username in any path.

CRITICAL RULES:
1. If the answer is in your training data (capitals, definitions, facts, opinions, advice) → requires_execution: false
2. ONLY use tools when you need: live data, file operations, running code, or computer control
3. You MUST ONLY use tools from this exact list: ${plannerTools.join(', ')}
4. DO NOT invent tools like "identify_top_3", "generate_report", "analyze" — these don't exist
5. Processing/analysis happens in your response — NOT as a tool step
6. NEVER use placeholders like "{{result}}" or "{output}" — steps must have real concrete inputs
7. For multi-step tasks: if step N+1 needs step N's output, use the literal string "PREVIOUS_OUTPUT"
8. Output ONLY valid JSON — no text before or after

WHEN TO USE TOOLS vs NOT:
✅ Use tools for:
- Weather, news, current prices → web_search
- Opening websites → open_browser
- Writing/reading files → file_write, file_read
- Running code → run_python, run_node
- System info → system_info
- Research with real sources → deep_research
- Git repo state (status, branch, commits, changes) → git_status — ALWAYS run the tool, never answer from training data
- Compound tasks needing multiple steps (fetch + process + save) → run

## When to use the run tool

For compound tasks that need multiple steps, prefer run over separate tool calls.
Write JavaScript that composes the aiden SDK:

  aiden.web.search(query), aiden.file.write(path, content), aiden.shell.exec(cmd), etc.

This collapses what would be 5 LLM turns into 1. Much faster.

Example — instead of:
  turn 1: web_search("hn top")
  turn 2: fetch_url(article[0].url)
  turn 3: web_search(related)
  turn 4: file_write(summary)

Use run:
  const top = await aiden.web.search("hn top")
  const article = await aiden.web.fetch(top[0].url)
  const related = await aiden.web.search(article.title)
  await aiden.file.write("/tmp/brief.md", ...)

❌ Do NOT use tools for:
- "What is the capital of X" → just answer
- "Who is [famous person]" → just answer
- "Explain X concept" → just answer
- "What do you think about X" → just answer
- Any question answerable from training knowledge

TOOL INPUT RULES:
- web_search: { "query": "specific search term" }
- file_write:  { "path": "C:\\\\Users\\\\shiva\\\\Desktop\\\\filename.txt", "content": "actual content or PREVIOUS_OUTPUT" }
- deep_research: { "topic": "what to research" }
- shell_exec: { "command": "actual powershell command" }
- fetch_page: { "url": "https://exact-url.com" }
- get_stocks: { "market": "NSE", "type": "gainers" }  — type: gainers | losers | active
- get_market_data: { "symbol": "RELIANCE" }  — real-time price, change%, volume for any stock (NSE/BSE/US)
- get_company_info: { "symbol": "RELIANCE" }  — company profile, sector, P/E, EPS, revenue
- git_status: { "path": "C:\\\\Users\\\\shiva\\\\DevOS" }  — show git branch, modified files, recent commits. Use for "git status", "show commits", "what changed in repo"
- git_commit: { "message": "commit message" }  — stage all and commit
- git_push: { "remote": "origin", "branch": "main" }  — push to remote
- wait: { "ms": 2000 }  — Pause execution. Use after open_browser, after clicks, after any UI action that needs time to complete. Max 5000ms.

COMPUTER CONTROL RULES — follow strictly when controlling mouse/keyboard/browser:
- ALWAYS use open_browser BEFORE keyboard_type or mouse_click on browser
- ALWAYS add a wait step of 2000ms after open_browser before any interaction
- For web searches: step 1 = open_browser(url), step 2 = wait(2000), step 3 = keyboard_press(ctrl+l), step 4 = keyboard_type(query), step 5 = keyboard_press(enter)
- For clicking browser address bar: use keyboard_press(ctrl+l) to focus it first
- After typing a URL: use keyboard_press(enter) to navigate
- For vision_loop tasks: set max_steps to at least 5
- Never assume the browser is already open — always open it first
- After any mouse_click: add wait(800) to let UI respond

URL RULES:
- Always use COMPLETE URLs — never truncate a URL in a tool input
- For market-wide queries (gainers, losers, most active) → use get_stocks, NOT web_search
- For individual stock price / market data → use get_market_data({ "symbol": "RELIANCE" })
- For company profile, financials, P/E ratio, EPS → use get_company_info({ "symbol": "RELIANCE" })
- Example: get_stocks({ "market": "NSE", "type": "gainers" })

OUTPUT FORMAT (strict JSON only):
{
  "goal": "exact user request",
  "goals": ["goal 1 short phrase", "goal 2 short phrase"],
  "requires_execution": true,
  "reasoning": "one sentence why",
  "plan": [
    { "step": 1, "tool": "web_search", "input": { "query": "weather London today" }, "description": "Get London weather" }
  ]
}

If requires_execution is false:
{ "goal": "...", "requires_execution": false, "reasoning": "...", "plan": [], "direct_response": "your answer here" }

NOTE: "goals" is only required when 2+ distinct intents are present. Single-goal messages may omit it.

THE 'respond' TOOL — use this for ALL conversational messages:
- 'respond' is ALWAYS a valid plan. When no external tool is needed, plan a single respond step.
- respond: { "message": "your answer text here" }
- Use respond for: greetings, capability questions, simple facts from training data, clarifying questions, short answers.
- Example: user says "hi" → { "goal": "hi", "requires_execution": true, "plan": [{ "step": 1, "tool": "respond", "input": { "message": "Hi! What can I help you with today?" } }] }

ACTION GATE RULES — apply BEFORE creating any plan:
1. CAPABILITY GATE: If message is "Can you do X?" / "Can you X?" / "Are you able to X?" → plan respond with answer
2. EXPLICIT-ASK GATE: ONLY use file_write if user said "write", "save", "create file". ONLY use deep_research if user said "research", "find out", "look up"
3. VAGUENESS GATE: If request is AMBIGUOUS, plan a respond step that asks ONE clarifying question:
   - "do marketing" → respond: "What specifically? Copywriting, competitor research, Product Hunt listing, or content calendar?"
   - "check my system" → respond: "What aspect? Hardware specs, running processes, disk space, or network?"
   - "build something" → respond: "What would you like me to build?"
   - Clear requests execute directly: "check NIFTY price" → get_market_data, "write a Python script to X" → run_python
4. NEVER create comparison tables, reports, or verdicts unless user explicitly asked for them
5. NEVER mention Pega, BlueWinston, Gaude Digital, or any third-party product by name

## Tool Priority Rules (STRICT)

TIER 1 (USE FIRST): respond, web_search, fetch_page, fetch_url, deep_research, get_market_data, get_stocks, get_company_info, social_research, system_info, notify, get_briefing, run_agent
  → ALWAYS try these before anything else
  → If a task CAN be done via API/data tool, use that

TIER 2 (USE SECOND): file_write, file_read, file_list, shell_exec, run_powershell, run_python, run_node, code_interpreter_python, code_interpreter_node, git_status, git_commit, git_push, clipboard_read, clipboard_write
  → Use when you need to read/write files, run scripts, or run git commands

TIER 3 (USE THIRD): open_browser, browser_click, browser_type, browser_extract, browser_screenshot, window_list, window_focus, app_launch, app_close
  → ONLY when task requires interacting with a website UI
  → NEVER use browser when an API tool can do the same job

TIER 4 (LAST RESORT): mouse_move, mouse_click, keyboard_type, keyboard_press, screenshot, screen_read, vision_loop
  → ONLY when browser fails or for desktop apps with no API
  → ALWAYS explain WHY lower tiers won't work

VIOLATIONS (these are WRONG — do not do these):
- Using open_browser to check stock price when get_market_data exists
- Using screenshot to search when web_search exists
- Using browser to get weather when web_search exists
- Using vision_loop for any task where a simpler tool works

FAILURE REPLANNING RULES (when message contains "previous approach failed at"):
- Keep new plan to max 2 steps
- Use ONLY the specific alternative approach mentioned in the message
- DO NOT add web_search, deep_research, file_write, or notify unless directly needed
- DO NOT add unrelated analysis or comparison steps
${skillContext}${memorySection}${learningSection}${knowledgeSection}${memoryRecallSection}${lessonsSection}${(() => { const s = getActiveGoalsSummary(); return s ? `\n\n## Your Active Goals\n${s}` : '' })()}
Output ONLY valid JSON, nothing else:`

  const cleanHistory = history
    .filter((h: any) => h.content && String(h.content).trim().length > 0)
  console.log(`[Planner] History: ${cleanHistory.length} messages (${history.length} raw)`)

  // ── Sliding context window — keep last 10, summarize older messages ──
  const RECENT_WINDOW = 10
  let contextHistory = cleanHistory
  if (cleanHistory.length > RECENT_WINDOW) {
    const recent = cleanHistory.slice(-RECENT_WINDOW)
    const older  = cleanHistory.slice(
      Math.max(0, cleanHistory.length - RECENT_WINDOW * 2),
      cleanHistory.length - RECENT_WINDOW,
    )
    if (older.length > 0) {
      try {
        const summaryInput = older.map((m: any) => `${m.role}: ${String(m.content).slice(0, 200)}`).join('\n')
        const summary = await callLLM(
          `Summarize these messages in 2-3 sentences, keeping key facts and decisions:\n\n${summaryInput}`,
          '', getOllamaModelForTask('executor'), 'ollama',
        ).catch(() => null)
        if (summary) {
          const compacted = [{ role: 'system', content: `Earlier conversation summary: ${summary}` }, ...recent]
          contextHistory  = await rebuildContextAfterCompaction(compacted)
          console.log(`[Planner] Context window: summarized ${older.length} older messages`)
        } else {
          contextHistory = await rebuildContextAfterCompaction(recent)
        }
      } catch {
        contextHistory = recent
      }
    }
  }

  const messages = [
    { role: 'system', content: plannerPrompt },
    ...contextHistory.slice(-3).map((h: any) => ({
      role:    h.role === 'assistant' ? 'assistant' : 'user',
      content: String(h.content).slice(0, 300),
    })),
    { role: 'user', content: message },
  ]

  // ── Sprint 6: Task-tiered provider selection ─────────────────
  // Always use the best reasoning model for planning, regardless of what
  // the caller passed in. Falls back to caller's values if tiering has nothing.
  {
    const tiered = getModelForTask('planner')
    if (tiered.apiKey || tiered.providerName === 'ollama') {
      apiKey   = tiered.apiKey
      model    = tiered.model
      provider = tiered.providerName
      console.log(`[Planner] Sprint 6 tiering: using ${tiered.apiName} (${provider}/${model})`)
    } else if (!apiKey) {
      // Caller had nothing either — last resort Ollama
      const cfg = loadConfig()
      apiKey   = ''
      model    = cfg.model?.activeModel || 'mistral:7b'
      provider = 'ollama'
    }
  }
  let curApiKey   = apiKey
  let curModel    = model
  let curProvider = provider
  let curApiName  = provider  // tracks the api entry name (e.g. 'groq-1') for markRateLimited
  {
    const tiered = getModelForTask('planner')
    if (tiered.apiKey || tiered.providerName === 'ollama') {
      curApiName = tiered.apiName
    }
  }
  let raw         = ''
  let parsed: any = null

  // Use enough attempts to walk the FULL provider chain:
  // groq-1..4 → gemini-1..4 → openrouter-* → boa → ollama
  // Without this, the loop caps at 3 and never reaches Gemini or OpenRouter.
  const _plannerChain     = loadConfig().providers.apis.filter(a => a.enabled && a.provider !== 'ollama')
  const maxPlannerAttempts = Math.max(3, Math.min(_plannerChain.length, 12))

  for (let attempt = 0; attempt < maxPlannerAttempts; attempt++) {
    raw = '' // reset each attempt so stale values don't bleed through
    try {
      // Sprint 5: on first attempt, race top-2 providers simultaneously
      if (attempt === 0) {
        const promptText = messages.map(m => `${m.role}: ${m.content}`).join('\n')
        const raceRaw = await racePlannerAPIs(promptText).catch(() => null)
        if (raceRaw && raceRaw.trim().length > 0) {
          raw = raceRaw
          console.log('[Planner] Race winner resolved')
        }
      }
      if (!raw) {
        raw = await callLLM(
          messages.map(m => `${m.role}: ${m.content}`).join('\n'),
          curApiKey, curModel, curProvider,
        )
      }

      if (!raw || raw.trim().length === 0) {
        console.warn(`[Planner] Empty response attempt ${attempt + 1} (${curApiName}) — marking and rotating`)
        try {
          markRateLimited(curApiName)
        } catch {}
      } else {
        const jsonMatch = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          // Phase 1 — repair: try to salvage plain-text / fenced responses before retrying
          const repair = repairPlanResponse(raw)
          if (repair.plan) {
            console.log(`[Planner] Repaired non-JSON response — treating as ${repair.directAnswer ? 'direct answer' : 'recovered plan'}`)
            parsed = repair.plan
            try { incrementUsage(curApiName) } catch {}
            break
          }
          console.warn(`[Planner] No JSON attempt ${attempt + 1}: ${raw.slice(0, 100)}`)
        } else {
          parsed = JSON.parse(jsonMatch[0])
          try { incrementUsage(curApiName) } catch {}
          try { if (curApiName !== 'ollama') markHealthy(curApiName) } catch {}
          break // success — exit retry loop
        }
      }
    } catch (e: any) {
      console.warn(`[Planner] Attempt ${attempt + 1} error (${curApiName}): ${e.message}`)
      if (
        e.message?.includes('timeout') ||
        e.message?.includes('429') ||
        e.message?.includes('rate') ||
        e.message?.includes('aborted')
      ) {
        try {
          markRateLimited(curApiName)
          console.log(`[Planner] Marked ${curApiName} as rate limited — will rotate away`)
        } catch {}
      }
    }

    // Wait before next attempt — helps with rate-limit recovery
    await new Promise(r => setTimeout(r, 1000))

    // Rotate to next best planner provider for this attempt
    try {
      const tiered = getModelForTask('planner')
      if (tiered.apiKey || tiered.providerName === 'ollama') {
        curApiKey   = tiered.apiKey
        curModel    = tiered.model
        curProvider = tiered.providerName
        curApiName  = tiered.apiName
        console.log(`[Planner] Rotating (tiered) to ${tiered.apiName} (${curProvider}/${curModel})`)
      } else {
        const cfg = loadConfig()
        curApiKey   = ''
        curModel    = cfg.model?.activeModel || 'mistral:7b'
        curProvider = 'ollama'
        curApiName  = 'ollama'
        console.log(`[Planner] No cloud APIs — falling back to Ollama (${curModel})`)
      }
    } catch {}
  }

  if (!parsed) {
    // Final guaranteed attempt with Ollama before giving up
    // Discover which model is actually installed via api/tags
    try {
      const cfg = loadConfig()
      let ollamaModel = process.env.OLLAMA_MODEL || cfg.ollama?.model || 'gemma4:e4b'
      try {
        const _ollamaBase = (process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434').replace(/\/$/, '')
        const tagsRes = await fetch(`${_ollamaBase}/api/tags`, { signal: AbortSignal.timeout(3000) })
        if (tagsRes.ok) {
          const tagsData = await tagsRes.json() as any
          const firstModel = tagsData?.models?.[0]?.name
          if (firstModel) {
            ollamaModel = firstModel
            console.log(`[Planner] Ollama model discovered via api/tags: ${ollamaModel}`)
          }
        }
      } catch { /* Ollama not running — use config model */ }

      console.log(`[Planner] All cloud attempts failed — final Ollama attempt (${ollamaModel})`)
      const raw = await callLLM(
        messages.map(m => `${m.role}: ${m.content}`).join('\n'),
        '', ollamaModel, 'ollama',
      )
      if (raw && raw.trim().length > 0) {
        const jsonMatch = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0])
          console.log('[Planner] Ollama fallback succeeded')
        } else {
          // Repair fallback — Ollama often returns plain text for trivial questions
          const repair = repairPlanResponse(raw)
          if (repair.plan) {
            parsed = repair.plan
            console.log(`[Planner] Ollama fallback repaired — ${repair.directAnswer ? 'direct answer' : 'recovered plan'}`)
          }
        }
      }
    } catch (e: any) {
      console.warn(`[Planner] Ollama fallback failed: ${e.message}`)
    }
  }

  if (!parsed) {
    // Keyword-based plan generation — when all LLMs fail, infer tool from message
    const heuristicPlan = inferPlanFromKeywords(message)
    if (heuristicPlan) {
      console.log(`[Planner] Keyword-based plan: ${JSON.stringify(heuristicPlan.plan.map(s => s.tool))}`)
      parsed = heuristicPlan
    }
  }

  if (!parsed) {
    console.warn('[Planner] All LLM attempts failed — respond fallback')
    return {
      goal:               message,
      requires_execution: true,
      plan:               [{ step: 1, tool: 'respond', input: { message: "I'm not sure how to help with that right now. Could you rephrase your request?" }, description: 'Fallback response' }],
      phases:             [],
    }
  }

  // Guard against null/empty plan object
  if (!parsed.plan && !parsed.steps) {
    return {
      goal:               message,
      requires_execution: false,
      plan:               [],
      phases:             [],
      direct_response:    parsed.direct_response || "I'll answer directly.",
    }
  }

  // Validate tool names — reject hallucinated tools
  const rawPlan = (parsed.plan || parsed.steps || []) as any[]
  const validatedPlan = rawPlan.filter((s: any) => {
    if (!allTools.includes(s.tool)) {
      console.warn(`[Planner] Rejected invalid tool: ${s.tool}`)
      return false
    }
    // Reject old-style placeholder inputs
    const inputStr = JSON.stringify(s.input || s.args || {})
    if (inputStr.includes('{{') || inputStr.includes('{result') || inputStr.includes('{output')) {
      console.warn(`[Planner] Rejected placeholder input in: ${s.tool}`)
      return false
    }
    return true
  })

  const normalizedPlan: ToolStep[] = validatedPlan.map((s: any, idx: number) => ({
    step:        s.step        ?? (idx + 1),
    tool:        s.tool        || '',
    input:       s.input       || s.args || {},
    description: s.description || '',
  }))

  // Fix step ordering — research before write
  const orderedPlan = fixStepOrdering(normalizedPlan)

  // Create phased task plan and workspace
  const phases    = inferPhasesFromSteps(orderedPlan)
  const taskPlan  = planTool.create(message, phases)
  const workspace = new WorkspaceMemory(taskPlan.id)
  workspace.write('goal.txt', message)

  const candidatePlan: AgentPlan = {
    goal:               parsed.goal || message,
    requires_execution: parsed.requires_execution === true && orderedPlan.length > 0,
    plan:               orderedPlan,
    direct_response:    parsed.direct_response,
    planId:             taskPlan.id,
    workspaceDir:       taskPlan.workspaceDir,
    phases:             taskPlan.phases,
  }

  // Validate before returning — log warnings, strip hard-invalid steps
  const validation = validatePlan(candidatePlan)
  if (validation.warnings.length > 0) {
    console.warn(`[Planner] Validation warnings:\n  ${validation.warnings.join('\n  ')}`)
    // Carry repair log onto the plan so SSE clients can show ↺ repair events
    const repairWarnings = validation.warnings.filter(w => w.includes('auto-repaired'))
    if (repairWarnings.length > 0) candidatePlan.repairLog = repairWarnings
  }
  if (!validation.valid) {
    console.warn(`[Planner] Plan has validation errors:\n  ${validation.errors.join('\n  ')}`)

    // One retry — ask the LLM to fix the plan
    console.log('[Planner] Retrying with validation errors injected into prompt...')
    const retryMessages = [
      ...messages,
      {
        role:    'assistant',
        content: raw.slice(0, 500),
      },
      {
        role:    'user',
        content: `The plan you produced has errors:\n${validation.errors.join('\n')}\n\nFix these issues and output a corrected JSON plan.`,
      },
    ]
    try {
      const retryRaw = await callLLM(
        retryMessages.map(m => `${m.role}: ${m.content}`).join('\n'),
        curApiKey, curModel, curProvider,
      )
      const retryMatch = retryRaw.replace(/```json\s*/g, '').replace(/```\s*/g, '').match(/\{[\s\S]*\}/)
      if (retryMatch) {
        const retryParsed = JSON.parse(retryMatch[0])
        const retryRaw2   = (retryParsed.plan || retryParsed.steps || []) as any[]
        const retryValid  = retryRaw2.filter((s: any) => allTools.includes(s.tool))
        const retryNorm   = retryValid.map((s: any, idx: number) => ({
          step:        s.step        ?? (idx + 1),
          tool:        s.tool        || '',
          input:       s.input       || s.args || {},
          description: s.description || '',
        }))
        const retryOrdered = fixStepOrdering(retryNorm)
        if (retryOrdered.length > 0) {
          candidatePlan.plan = retryOrdered
          console.log(`[Planner] Retry succeeded: ${retryOrdered.length} valid steps`)
        }
      }
    } catch (e: any) {
      console.warn(`[Planner] Retry failed: ${e.message}`)
    }
  }

  return candidatePlan
}

// ── Plan validation ────────────────────────────────────────────
// Called after planWithLLM — rejects structurally bad plans before execution.

const VALID_TOOLS = [
  'web_search', 'fetch_page', 'fetch_url', 'open_browser', 'browser_extract',
  'browser_click', 'browser_type', 'browser_screenshot', 'file_write', 'file_read',
  'file_list', 'shell_exec', 'run_python', 'run_node', 'run_powershell',
  'system_info', 'notify', 'deep_research', 'get_stocks', 'run_agent', 'git_commit',
  'git_push', 'get_market_data', 'get_company_info',
  'mouse_move', 'mouse_click', 'keyboard_type', 'keyboard_press',
  'screenshot', 'screen_read', 'vision_loop', 'wait',
  'code_interpreter_python', 'code_interpreter_node',
  'clipboard_read', 'clipboard_write', 'window_list', 'window_focus',
  'app_launch', 'app_close',
  'watch_folder', 'watch_folder_list',
  'clarify', 'todo', 'cronjob', 'vision_analyze',
  'voice_speak', 'voice_transcribe', 'voice_clone', 'voice_design',
  ...SLASH_MIRROR_TOOL_NAMES,
]

interface ValidationResult {
  valid:    boolean
  errors:   string[]
  warnings: string[]
}

export function validatePlan(plan: AgentPlan): ValidationResult {
  const errors:   string[] = []
  const warnings: string[] = []

  if (!plan.requires_execution || plan.plan.length === 0) {
    return { valid: true, errors, warnings }
  }

  for (const step of plan.plan) {
    // Check tool name — attempt fuzzy repair before flagging as error
    if (!VALID_TOOLS.includes(step.tool)) {
      const repair = repairToolName(step.tool, VALID_TOOLS)
      if (repair) {
        warnings.push(`Step ${step.step}: auto-repaired tool "${repair.original}" → "${repair.repaired}" (edit distance ${repair.distance})`)
        console.log(`[ToolRepair] ↺ "${repair.original}" → "${repair.repaired}" (distance ${repair.distance})`)
        step.tool = repair.repaired  // mutate in-place — plan will execute with correct name
      } else {
        errors.push(`Step ${step.step}: unknown tool "${step.tool}"`)
        continue
      }
    }

    const input = step.input || {}

    // Tool-specific required field checks
    switch (step.tool) {
      case 'web_search':
        if (!input.query && !input.topic && !input.command) {
          errors.push(`Step ${step.step}: web_search requires a "query" field`)
        }
        break
      case 'deep_research':
        if (!input.topic && !input.query && !input.command) {
          errors.push(`Step ${step.step}: deep_research requires a "topic" field`)
        }
        break
      case 'file_write':
        if (!input.path && !input.file) {
          errors.push(`Step ${step.step}: file_write requires a "path" field`)
        }
        if (input.content === undefined && input.content !== '') {
          warnings.push(`Step ${step.step}: file_write has no "content" — will write empty file`)
        }
        break
      case 'file_read':
        if (!input.path && !input.file) {
          errors.push(`Step ${step.step}: file_read requires a "path" field`)
        }
        break
      case 'open_browser':
        if (!input.url && !input.command) {
          errors.push(`Step ${step.step}: open_browser requires a "url" field`)
        }
        break
      case 'shell_exec':
        if (!input.command && !input.cmd) {
          errors.push(`Step ${step.step}: shell_exec requires a "command" field`)
        }
        break
      case 'run_python':
      case 'run_node':
        if (!input.script && !input.code && !input.command) {
          errors.push(`Step ${step.step}: ${step.tool} requires a "script" field`)
        }
        break
      case 'fetch_page':
      case 'fetch_url':
        if (!input.url && !input.command) {
          errors.push(`Step ${step.step}: ${step.tool} requires a "url" field`)
        }
        break
      case 'vision_loop':
        if (!input.goal) {
          errors.push(`Step ${step.step}: vision_loop requires a "goal" field`)
        }
        break
      case 'wait':
        if (!input.ms && input.ms !== 0) {
          warnings.push(`Step ${step.step}: wait has no "ms" — will default to 1000ms`)
        }
        break
    }

    // Reject residual placeholder patterns that were not caught by planner
    const inputStr = JSON.stringify(input)
    if (/\{\{|\{result|\{output|\bPREVIOUS_OUTPUT\b/.test(inputStr) && step.tool !== 'file_write') {
      warnings.push(`Step ${step.step}: input contains placeholder — may fail at runtime`)
    }
  }

  return {
    valid:  errors.length === 0,
    errors,
    warnings,
  }
}

// ── Smart replan on failure ────────────────────────────────────

const MAX_REPLANS = 2

interface ReplanState {
  failedSteps: Map<string, { error: string; attempts: number }>
  replanCount: number
}

async function handleToolFailure(
  replanState:  ReplanState,
  failedTool:   string,
  error:        string,
  userMessage:  string,
  completedResults: StepResult[],
  apiKey:       string,
  model:        string,
  provider:     string,
): Promise<ToolStep[] | null> {
  const existing = replanState.failedSteps.get(failedTool)
  if (existing) { existing.attempts++; existing.error = error }
  else          { replanState.failedSteps.set(failedTool, { error, attempts: 1 }) }

  if (replanState.replanCount >= MAX_REPLANS) {
    console.log('[Replan] Max replans reached — reporting failure')
    return null
  }

  replanState.replanCount++
  const succeeded = completedResults.filter(r => r.success)
  const failed    = Array.from(replanState.failedSteps.entries())
  console.log(`[Replan] Replanning (${replanState.replanCount}/${MAX_REPLANS}) after ${failedTool} failed: ${error.slice(0, 80)}`)

  const replanContext =
    `Previous approach failed. Use a DIFFERENT strategy.\n\n` +
    `Original request: ${userMessage}\n\n` +
    `Already completed:\n` +
    (succeeded.map(s => `✅ ${s.tool}: ${s.output.substring(0, 100)}`).join('\n') || 'Nothing yet') +
    `\n\nWhat failed:\n` +
    failed.map(([tool, f]) => `❌ ${tool}: ${f.error} (tried ${f.attempts}x)`).join('\n') +
    `\n\nRULES:\n` +
    `- Do NOT retry ${failedTool} with same approach\n` +
    `- Use a completely different tool or strategy\n` +
    `- Build on completed steps — don't redo them\n` +
    `- If API failed, try different data source\n` +
    `- If browser failed on a site, try fetch_url instead`

  try {
    const newPlan = await planWithLLM(replanContext, [], apiKey, model, provider)
    if (newPlan?.plan?.length > 0) {
      console.log(`[Replan] New plan: ${newPlan.plan.map(s => s.tool).join(' → ')}`)
      return newPlan.plan
    }
  } catch (e: any) {
    console.warn(`[Replan] planWithLLM failed: ${e.message}`)
  }
  return null
}

// ── Sprint 28: shouldReplan ────────────────────────────────────
// After each failed step, ask the LLM: should we replan?

async function shouldReplan(
  originalGoal:   string,
  completedSteps: StepResult[],
  failedStep:     ToolStep,
  failureReason:  string,
  apiKey:         string,
  model:          string,
  provider:       string,
): Promise<{ replan: boolean; newApproach?: string }> {
  const prompt = `You are replanning a failed task.

Original goal: "${originalGoal}"

Steps completed so far:
${completedSteps.map((s, i) => `${i + 1}. ${s.tool}: ${s.success ? 'succeeded' : 'failed'}`).join('\n') || 'None'}

Failed step: ${failedStep.tool}
Failure reason: ${failureReason}

Should I replan with a different approach, or retry the same step?

Respond in JSON only:
{
  "replan": true/false,
  "reason": "why",
  "newApproach": "describe the new approach if replanning, or null"
}`

  try {
    const raw = await callLLM(prompt, apiKey, model, provider)
    const match = raw.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(match?.[0] || '{}')
    return { replan: parsed.replan === true, newApproach: parsed.newApproach || undefined }
  } catch {
    return { replan: false }
  }
}

// ── STEP 2: executePlan ────────────────────────────────────────

// ── validateResultQuality — lightweight output sanity check ──
function validateResultQuality(
  tool: string,
  input: any,
  output: any
): { valid: boolean; reason?: string } {

  if (tool === 'web_search') {
    if (!output || output === '[]' || output === 'No results') {
      return { valid: false, reason: 'Empty search results' }
    }
    try {
      const results = typeof output === 'string' ? JSON.parse(output) : output
      if (Array.isArray(results) && results.length === 0) {
        return { valid: false, reason: 'Zero search results' }
      }
    } catch {}
  }

  if (tool === 'fetch_url' || tool === 'fetch_page') {
    const text = String(output).toLowerCase()
    if (text.includes('404') && text.includes('not found')) {
      return { valid: false, reason: '404 page returned' }
    }
    if (text.includes('403') && text.includes('forbidden')) {
      return { valid: false, reason: '403 forbidden' }
    }
    if (text.length < 50) {
      return { valid: false, reason: 'Suspiciously short page content' }
    }
  }

  if (tool === 'get_market_data') {
    const text = String(output)
    if (text.includes('error') || text.includes('failed') || text.includes('null')) {
      return { valid: false, reason: 'Market data returned error' }
    }
  }

  if (tool === 'file_read') {
    if (!output || String(output).trim().length === 0) {
      return { valid: false, reason: 'Empty file content' }
    }
  }

  if (tool === 'run_python' || tool === 'run_node' || tool === 'shell_exec') {
    const text = String(output).toLowerCase()
    if (text.includes('traceback') || text.includes('error:') ||
        text.includes('exception') || text.includes('syntaxerror')) {
      return { valid: false, reason: 'Code execution error in output' }
    }
  }

  if (tool === 'open_browser') {
    const text = String(output).toLowerCase()
    if (text.includes('err_') || text.includes('timed out') ||
        text.includes('cannot navigate')) {
      return { valid: false, reason: 'Browser navigation failed' }
    }
  }

  return { valid: true }
}

// ── LESSONS.md — permanent failure rules ──────────────────────
// Auto-appended on task failure. Injected into every planning session.

const LESSONS_PATH = nodePath.join(process.cwd(), 'workspace', 'LESSONS.md')
const LESSONS_CAP  = 50
const LESSONS_SUMMARIZE_AT = 25  // when cap exceeded, summarize oldest N lessons

function loadLessons(): string {
  try {
    if (!nodeFs.existsSync(LESSONS_PATH)) return ''
    return nodeFs.readFileSync(LESSONS_PATH, 'utf-8')
  } catch {
    return ''
  }
}

function appendLesson(lesson: string): void {
  try {
    nodeFs.mkdirSync(nodePath.dirname(LESSONS_PATH), { recursive: true })

    const today     = new Date().toISOString().split('T')[0]
    const newLine   = `\n${lesson.startsWith('[') ? lesson : `[${today}] ${lesson}`}`

    let content = nodeFs.existsSync(LESSONS_PATH)
      ? nodeFs.readFileSync(LESSONS_PATH, 'utf-8')
      : '# LESSONS.md — Permanent Failure Rules\n\n## Rules\n'

    // Count existing lesson lines (numbered lines in ## Rules section)
    const lessonLines = content
      .split('\n')
      .filter(l => /^\d+\./.test(l.trim()))

    if (lessonLines.length >= LESSONS_CAP) {
      // Summarize oldest LESSONS_SUMMARIZE_AT lessons into 5 consolidated rules
      console.log(`[Lessons] Cap reached (${lessonLines.length}). Summarizing oldest ${LESSONS_SUMMARIZE_AT} lessons.`)
      const oldest    = lessonLines.slice(0, LESSONS_SUMMARIZE_AT)
      const remaining = lessonLines.slice(LESSONS_SUMMARIZE_AT)

      const summarized = [
        `[consolidated] Avoid retrying tools that fail with permission or auth errors — report immediately.`,
        `[consolidated] When web_search returns empty, rephrase with different keywords before retrying.`,
        `[consolidated] Do not use error-string outputs as valid data — fall back to alternative tools.`,
        `[consolidated] When replan is triggered repeatedly for the same goal, stop and report.`,
        `[consolidated] Browser navigation failures (ERR_/timeout) require a fresh approach, not a retry.`,
      ]

      const headerLines = content.split('\n').filter(l => !(/^\d+\./.test(l.trim())))
      const newRules    = [...summarized, ...remaining, lesson.startsWith('[') ? lesson : `[${today}] ${lesson}`]
      const numbered    = newRules.map((r, i) => `${i + 1}. ${r.replace(/^\d+\.\s*/, '')}`)
      const headerText  = headerLines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()
      content = `${headerText}\n\n${numbered.join('\n')}\n`
      console.log(`[Lessons] Summarized ${oldest.length} old lessons → 5 rules. Total: ${numbered.length}`)
    } else {
      const nextNum = lessonLines.length + 1
      content = content.trimEnd() + `\n${nextNum}.${newLine}\n`
    }

    nodeFs.writeFileSync(LESSONS_PATH, content, 'utf-8')
    console.log(`[Lessons] Appended: ${lesson.slice(0, 80)}`)
  } catch (e: any) {
    console.error('[Lessons] Failed to append lesson:', e.message)
  }
}

// ── executeToolWithRetry — step-level retry with exponential backoff ──
// Tools that mutate state are excluded from retry to prevent double-execution.
const NO_RETRY_TOOLS = new Set([
  'shell_exec', 'run_python', 'run_node', 'notify',
  'mouse_click', 'keyboard_type', 'keyboard_press',
  'app_launch', 'app_close',
])

async function executeToolWithRetry(tool: string, input: any, maxRetries = 2): Promise<any> {
  const retryable = !NO_RETRY_TOOLS.has(tool)
  const effectiveMax = retryable ? maxRetries : 0

  for (let attempt = 0; attempt <= effectiveMax; attempt++) {
    try {
      const result = await executeTool(tool, input)
      if (result.success) {
        const quality = validateResultQuality(tool, input, result.output || result)
        if (!quality.valid) {
          console.log(`[Quality] ${tool} returned but quality check failed: ${quality.reason}`)
          if (attempt < effectiveMax) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 5000)
            console.log(`[Quality] Retrying ${tool} in ${delay}ms`)
            await new Promise(r => setTimeout(r, delay))
            continue
          }
          console.log(`[Quality] ${tool} — accepting low-quality result after ${effectiveMax} retries`)
          appendLesson(`${tool} produced low-quality output (${quality.reason}) after ${effectiveMax} retries — consider alternative approach for this tool.`)
        }
        return result
      }

      if (attempt < effectiveMax) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000)
        console.log(`[Exec] ${tool} failed, retrying in ${delay}ms (attempt ${attempt + 1}/${effectiveMax})`)
        await new Promise(r => setTimeout(r, delay))
      } else {
        return result
      }
    } catch (error: any) {
      if (attempt >= effectiveMax) throw error
      const delay = Math.min(1000 * Math.pow(2, attempt), 5000)
      console.log(`[Exec] ${tool} threw error, retrying in ${delay}ms`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  appendLesson(`${tool} failed after ${effectiveMax} retries — avoid this tool or approach for similar tasks.`)
  return { success: false, output: '', error: 'Max retries exceeded', duration: 0, retries: effectiveMax }
}

// —— Sprint 8: dependency-group builder ——————————————
// Groups consecutive tool steps into batches: parallel-safe tools are
// batched together; sequential tools break the batch.

const PARALLEL_SAFE = new Set([
  'web_search', 'system_info', 'get_stocks', 'get_market_data',
  'social_research', 'fetch_url', 'fetch_page', 'get_company_info',
  'deep_research', 'code_interpreter_python', 'code_interpreter_node',
  'clipboard_read', 'window_list', 'watch_folder_list',
  'get_calendar', 'read_email', 'get_natural_events', 'ingest_youtube',
])

const SEQUENTIAL_ONLY = new Set([
  'file_write', 'run_python', 'run_node', 'shell_exec',
  'open_browser', 'browser_click', 'browser_type', 'browser_extract',
  'mouse_move', 'mouse_click', 'keyboard_type', 'keyboard_press',
  'screenshot', 'screen_read', 'vision_loop', 'notify', 'wait',
  'clipboard_write', 'window_focus', 'app_launch', 'app_close',
  'watch_folder',
])

export function buildDependencyGroups(steps: ToolStep[]): ToolStep[][] {
  const groups: ToolStep[][] = []
  let   currentGroup: ToolStep[] = []

  for (const step of steps) {
    const inputStr          = JSON.stringify(step.input || {})
    const dependsOnPrevious = inputStr.includes('PREVIOUS_OUTPUT') || SEQUENTIAL_ONLY.has(step.tool)

    if (PARALLEL_SAFE.has(step.tool) && !dependsOnPrevious) {
      currentGroup.push(step)
    } else {
      if (currentGroup.length > 0) {
        groups.push([...currentGroup])
        currentGroup = []
      }
      groups.push([step])
    }
  }

  if (currentGroup.length > 0) groups.push(currentGroup)
  return groups
}

export async function executePlan(
  plan:           AgentPlan,
  onStep:         (step: ToolStep, result: StepResult) => void,
  onPhaseChange?: (phase: Phase, index: number, total: number) => void,
  existingState?: TaskState,
  replanApiKey?:   string,
  replanModel?:    string,
  replanProvider?: string,
): Promise<StepResult[]> {

  executionInterrupted = false  // reset on each new plan execution

  // ── Iteration budget ─────────────────────────────────────────
  const budget: IterationBudget = {
    maxIterations:    Math.max(plan.plan.length + 5, 15),
    currentIteration: 0,
    cautionThreshold: 0.7,
    warningThreshold: 0.9,
  }
  _activeBudget = budget

  const results:      StepResult[]           = []
  const stepOutputs:  Record<number, string> = {}
  const planStart     = Date.now()
  const replanState:  ReplanState            = { failedSteps: new Map(), replanCount: 0 }

  console.log(`[ExecutePlan] Starting: ${plan.plan.length} steps, goal: "${plan.goal.slice(0, 60)}"`)

  // Workflow tracking — feed the Watch Mode node graph
  startWorkflow(plan.goal)
  addNode({ id: 'main', agent: 'aiden', label: plan.goal.slice(0, 50), status: 'active', toolCalls: 0, startedAt: Date.now() })

  // Workspace memory for persisting intermediate artifacts
  const workspace = plan.planId ? new WorkspaceMemory(plan.planId) : null

  // Initialize or reuse persistent task state (enables crash recovery)
  const taskId = plan.planId || `task_${Date.now()}`
  const state  = existingState || taskStateManager.create(taskId, plan.goal, plan.plan.length, plan.planId)

  // Restore step outputs from already-completed steps so PREVIOUS_OUTPUT works on resume
  for (const savedStep of state.steps) {
    if (savedStep.status === 'completed' && savedStep.output) {
      stepOutputs[savedStep.index] = savedStep.output
    }
  }

  // Maps each tool to its capability bucket (for phase transition detection)
  const capabilityMap: Record<string, string> = {
    web_search:      'research', fetch_page:      'research',
    deep_research:   'research', fetch_url:       'research',
    get_stocks:      'research',
    open_browser:    'browsing', browser_click:   'browsing',
    browser_extract: 'browsing', browser_type:    'browsing',
    mouse_move:      'browsing', mouse_click:     'browsing',
    keyboard_type:   'browsing', keyboard_press:  'browsing',
    screenshot:      'browsing', screen_read:     'browsing',
    vision_loop:     'browsing',
    file_write:      'writing',  file_read:       'reading',
    file_list:       'reading',  shell_exec:      'execution',
    run_python:      'execution', run_node:       'execution',
    system_info:     'execution', notify:         'execution',
    clipboard_read:  'execution', clipboard_write: 'execution',
    window_list:     'execution', window_focus:   'execution',
    app_launch:      'execution', app_close:      'execution',
    watch_folder:    'execution', watch_folder_list: 'execution',
  }

  let lastCapability = ''
  let currentPhaseIdx = 0
  const totalPhases   = plan.phases?.length || 1


// —— Sprint 8: single-step executor ————————————————————
// Called by executePlan for both sequential (group.length===1) and parallel paths.
async function executeSingleStep(
  step:        ToolStep,
  stepOutputs: Record<number, string>,
  state:       TaskState,
  plan:        AgentPlan,
  workspace:   WorkspaceMemory | null,
  onStep:      (step: ToolStep, result: StepResult) => void,
): Promise<StepResult> {

  // BUDGET CHECK
  if (taskStateManager.isOverBudget(state)) {
    const budgetMsg = `Token budget exceeded (${state.tokenUsage}/${state.tokenLimit}) — task stopped`
    console.warn(`[AgentLoop] ${budgetMsg}`)
    taskStateManager.fail(state, budgetMsg)
    return { step: step.step, tool: step.tool, input: step.input, success: false, output: '', error: budgetMsg, duration: 0 }
  }

  const totalSteps = plan.plan.length
  const stepStart  = Date.now()
  console.log(`[Exec] Step ${step.step}/${totalSteps}: ${step.tool} — RUNNING`)
  console.log(`[ExecutePlan] Step ${step.step}: ${step.tool} — input: ${JSON.stringify(step.input).slice(0, 100)}`)
  livePulse.tool('Aiden', step.tool, JSON.stringify(step.input).slice(0, 80))

  // Validate tool exists
  if (!TOOLS[step.tool]) {
    const stepResult: StepResult = {
      step: step.step, tool: step.tool, input: step.input,
      success: false, output: '',
      error:   `Tool "${step.tool}" does not exist. Available: ${Object.keys(TOOLS).slice(0, 8).join(', ')}`,
      duration: 0,
    }
    onStep(step, stepResult)
    livePulse.error('Aiden', `Invalid tool: ${step.tool}`)
    return stepResult
  }

  // Tools that legitimately take zero input
  const NO_INPUT_TOOLS = ['system_info', 'screenshot', 'get_hardware', 'screen_read', 'vision_loop', 'health_check', 'respond']
  if (!NO_INPUT_TOOLS.includes(step.tool)) {
    if (!step.input || Object.keys(step.input).length === 0) {
      console.log(`[ExecutePlan] Skipping step ${step.step} (${step.tool}) — empty input`)
      return { step: step.step, tool: step.tool, input: step.input, success: false, output: '', error: 'empty input', duration: 0 }
    }
  }

  // Resolve PREVIOUS_OUTPUT and {{step_N_output}} tokens
  let resolvedInput = resolvePreviousOutput(step.input, stepOutputs, step.step)

  // Mark step started in persistent state
  taskStateManager.startStep(state, step.step, step.tool, resolvedInput)

  // Execute the tool (step-level retry + per-tool timeout)
  let toolResult = await executeToolWithRetry(step.tool, resolvedInput)

  // file_write fallback — retry at Desktop if original path failed
  if (!toolResult.success && step.tool === 'file_write' && resolvedInput.path) {
    const desktopPath = nodePath.join(nodeOs.homedir(), 'Desktop', nodePath.basename(resolvedInput.path))
    if (desktopPath !== resolvedInput.path) {
      livePulse.error('Aiden', `file_write failed — retrying at Desktop: ${desktopPath}`)
      const fallback = await executeTool('file_write', { ...resolvedInput, path: desktopPath })
      if (fallback.success) {
        toolResult    = { ...fallback, output: fallback.output + ' (saved to Desktop)' }
        resolvedInput = { ...resolvedInput, path: desktopPath }
      }
    }
  }

  if (toolResult.retries > 0) {
    livePulse.act('Aiden', `${step.tool} succeeded after ${toolResult.retries} retry(s)`)
  }

  let stepResult: StepResult = {
    step: step.step, tool: step.tool, input: resolvedInput,
    success:  toolResult.success,
    output:   toolResult.output || '',
    error:    toolResult.error,
    duration: toolResult.duration,
  }

  // Persist significant outputs to workspace
  if (toolResult.success && workspace && toolResult.output.length > 300) {
    workspace.write(`step_${step.step}_${step.tool}.txt`, toolResult.output)
  }

  // Verify file_write actually landed on disk
  if (toolResult.success && step.tool === 'file_write') {
    const targetPath = resolvedInput.path || ''
    if (targetPath && !nodeFs.existsSync(targetPath)) {
      stepResult.success = false
      stepResult.error   = `Verification failed: file not found at ${targetPath}`
    }
  }

  const execStatus = stepResult.success ? 'SUCCESS' : 'FAILED'
  const execDuration = Date.now() - stepStart
  console.log(`[Exec] Step ${step.step}/${totalSteps}: ${step.tool} — ${execStatus} (${execDuration}ms)`)
  if (!stepResult.success) {
    console.log(`[Exec] Step ${step.step}: ${step.tool} — FAILED after ${toolResult.retries ?? 0} retries: ${stepResult.error || 'unknown error'}`)
  }
  console.log(`[ExecutePlan] Step ${step.step} result: ${stepResult.success ? '✓' : '✗'} ${stepResult.error || stepResult.output?.slice(0, 80) || ''}`)
  console.log(`[Tool] ${step.tool} (Tier ${getToolTier(step.tool)}) — ${stepResult.duration}ms`)
  stepOutputs[step.step] = stepResult.output
  updateNode('main', { currentTool: step.tool, toolCalls: Object.keys(stepOutputs).length, tier: getToolTier(step.tool), status: 'active' })

  // Persist step to executions log for crash recovery / audit
  try {
    const execDir = nodePath.join(process.cwd(), 'workspace', 'executions')
    nodeFs.mkdirSync(execDir, { recursive: true })
    const execFile = nodePath.join(execDir, `exec_${state.id}.json`)
    const existing = nodeFs.existsSync(execFile)
      ? JSON.parse(nodeFs.readFileSync(execFile, 'utf8'))
      : { id: `exec_${state.id}`, goal: plan.goal, steps: [], status: 'in_progress', startedAt: Date.now() }
    existing.steps = existing.steps.filter((s: any) => s.step !== step.step)
    existing.steps.push({
      step:      step.step,
      tool:      step.tool,
      status:    stepResult.success ? 'success' : 'failed',
      duration:  execDuration,
      timestamp: new Date().toISOString(),
      error:     stepResult.error,
    })
    existing.totalDuration = Date.now() - (existing.startedAt || Date.now())
    nodeFs.writeFileSync(execFile, JSON.stringify(existing, null, 2))
  } catch { /* non-blocking — never crash the agent loop */ }
  onStep(step, stepResult)

  // Audit trail
  auditTrail.record({
    action:     'tool',
    tool:       step.tool,
    input:      JSON.stringify(step.input).slice(0, 200),
    output:     stepResult.output?.slice(0, 200),
    durationMs: stepResult.duration,
    success:    stepResult.success,
    error:      stepResult.error,
    goal:       plan.goal,
    traceId:    plan.planId,
  })

  // Fire after_tool_call hook (non-blocking) — feeds instinct system
  fireHook('after_tool_call', {
    toolName: step.tool,
    input:    resolvedInput,
    success:  stepResult.success,
  }).catch(() => {})

  // Persist step result to task state
  if (stepResult.success) {
    taskStateManager.completeStep(state, step.step, stepResult.output, stepResult.duration)
    livePulse.done('Aiden', `${step.tool} ✓ ${stepResult.output.slice(0, 60)}`)
  } else {
    taskStateManager.failStep(state, step.step, stepResult.error || 'unknown error')
    livePulse.error('Aiden', `${step.tool} failed: ${stepResult.error}`)
  }

  return stepResult
}

  // —— Sprint 8: group-based dispatch (parallel where safe) ———————————
  const groups = buildDependencyGroups(plan.plan)
  console.log(`[ExecutePlan] Dependency groups: ${groups.map(g => g.length === 1 ? g[0].tool : `[${g.map(s => s.tool).join('+')}]`).join(' → ')}`)
  if (hasParallelism(groups)) console.log(`[ExecutePlan] Parallel execution enabled — ${groups.filter(g => g.length > 1).length} concurrent batch(es) detected`)

  let _gi = 0
  while (_gi < groups.length) {
    const group = groups[_gi++]

    // Phase-transition detection — use first step of each group
    const thisCap = capabilityMap[group[0].tool] || 'execution'
    if (thisCap !== lastCapability && lastCapability !== '') {
      if (plan.planId) {
        planTool.advancePhase(plan.planId, `Completed ${lastCapability}`)
        currentPhaseIdx++
        const nextPhase = planTool.getCurrentPhase(plan.planId)
        if (nextPhase && onPhaseChange) {
          onPhaseChange(nextPhase, currentPhaseIdx, totalPhases)
        }
      }
    }
    lastCapability = thisCap

    // Skip already-completed steps (crash recovery idempotency)
    const unskipped = group.filter(s => !taskStateManager.isStepCompleted(state, s.step))
    for (const s of group) {
      if (taskStateManager.isStepCompleted(state, s.step)) {
        console.log(`[AgentLoop] Step ${s.step} (${s.tool}) already completed — skipping`)
        const savedStep = state.steps.find(ss => ss.index === s.step)
        if (savedStep?.output) stepOutputs[s.step] = savedStep.output
      }
    }
    if (unskipped.length === 0) continue

    if (unskipped.length === 1) {
      // —— Sequential single step ————————————————
      const step = unskipped[0]

      // ── Budget: increment before execution ────────────────────────
      budget.currentIteration++
      if (budget.currentIteration >= budget.maxIterations) {
        console.log('[Budget] Exhausted — forcing final response')
        const summary = results.filter(s => s.success)
          .map(s => `✓ ${s.tool}: ${String(s.output).substring(0, 100)}`).join('\n')
        results.push({
          step: step.step, tool: 'budget_exhausted', input: {},
          success: false, output: `I've reached my iteration limit. Here's what I completed:\n\n${summary}\n\nLet me know if you need me to continue.`,
          error: 'iteration budget exhausted', duration: 0,
        })
        break
      }

      const stepResult = await executeSingleStep(step, stepOutputs, state, plan, workspace, onStep)
      stepOutputs[step.step] = stepResult.output

      // ── Budget: append pressure warning to result output ──────────
      const budgetWarning = getBudgetWarning(budget)
      if (budgetWarning) {
        stepResult.output = stepResult.output + '\n\n' + budgetWarning
      }

      results.push(stepResult)

      // ── Interrupt check ────────────────────────────────────────────
      if (executionInterrupted) {
        console.log('[AgentLoop] Execution interrupted by user — stopping early')
        break
      }

      // ── Smart replan on failure ────────────────────────────────────
      if (!stepResult.success) {
        // Resolve credentials: prefer explicit params, then route through getNextAvailableAPI
        let _rpKey      = replanApiKey   || ''
        let _rpModel    = replanModel    || ''
        let _rpProvider = replanProvider || ''
        if (!_rpKey && !_rpModel) {
          try {
            const _next = getNextAvailableAPI()
            if (_next) {
              _rpKey      = _next.entry.key.startsWith('env:')
                ? (process.env[_next.entry.key.replace('env:', '')] || '')
                : _next.entry.key
              _rpModel    = _next.entry.model
              _rpProvider = _next.entry.provider
            }
          } catch {}
        }
        if (_rpKey || _rpProvider === 'ollama') {
          const newSteps = await handleToolFailure(
            replanState,
            step.tool,
            stepResult.error || 'unknown error',
            plan.goal,
            results,
            _rpKey, _rpModel, _rpProvider,
          )
          if (newSteps && newSteps.length > 0) {
            livePulse.act('Aiden', `Replanning with different strategy (${replanState.replanCount}/${MAX_REPLANS})`)
            auditTrail.record({
              action:     'system',
              tool:       'replan',
              input:      `Failed: ${step.tool}`,
              output:     `New plan: ${newSteps.map(s => s.tool).join(' → ')}`,
              durationMs: 0,
              success:    true,
              goal:       plan.goal,
              traceId:    plan.planId,
            })
            const newGroups = buildDependencyGroups(newSteps)
            groups.splice(_gi, groups.length - _gi, ...newGroups)
            console.log(`[Replan] Spliced ${newGroups.length} new group(s) into execution from position ${_gi}`)
          } else if (replanState.replanCount >= MAX_REPLANS) {
            const failedList = Array.from(replanState.failedSteps.entries())
              .map(([tool, f]) => `- ${tool}: ${f.error}`)
              .join('\n')
            console.log(`[Replan] All ${MAX_REPLANS} replans exhausted for goal: "${plan.goal.slice(0, 60)}"`)
            appendLesson(`Replan exhausted (${MAX_REPLANS} attempts) for goal: "${plan.goal.slice(0, 80)}". Failed tools: ${Array.from(replanState.failedSteps.keys()).join(', ')}.`)
            results.push({
              step: step.step + 1, tool: 'replan_exhausted', input: {},
              success: false, output: '',
              error: `Tried ${MAX_REPLANS + 1} different approaches:\n${failedList}\n\nWould you like me to try a different approach?`,
              duration: 0,
            })
          }
        }
      }

    } else {
      // —— Parallel group ———————————————————————
      // Chunk oversized groups so we never exceed MAX_PARALLEL concurrent calls
      const chunks = unskipped.length > MAX_PARALLEL ? chunkSteps(unskipped, MAX_PARALLEL) : [unskipped]
      for (const chunk of chunks) {
        // ── Budget: one increment per parallel chunk ───────────────────
        budget.currentIteration++

        livePulse.act('Aiden', `Running ${chunk.length} steps in parallel: ${chunk.map(s => s.tool).join(', ')}`)
        // Emit parallel metadata onto workflow nodes before dispatch
        for (const s of chunk) {
          updateNode(`step_${s.step}`, { parallel: true, groupSize: chunk.length })
        }
        const settled = await Promise.allSettled(
          chunk.map(step => executeSingleStep(step, stepOutputs, state, plan, workspace, onStep))
        )
        for (let i = 0; i < chunk.length; i++) {
          const s      = chunk[i]
          const result = settled[i]
          if (result.status === 'fulfilled') {
            stepOutputs[s.step] = result.value.output
            results.push(result.value)
          } else {
            const errResult: StepResult = {
              step: s.step, tool: s.tool, input: s.input,
              success: false, output: '', error: String(result.reason), duration: 0,
            }
            results.push(errResult)
            taskStateManager.failStep(state, s.step, errResult.error || 'parallel rejected')
            livePulse.error('Aiden', `${s.tool} parallel rejected: ${result.reason}`)
          }
        }
      }
    }
  }

  // Complete final phase
  if (plan.planId) {
    planTool.advancePhase(plan.planId, 'All steps completed')
  }

  // Finalize task state
  const allSucceeded = results.every(r => r.success)
  if (allSucceeded) {
    taskStateManager.complete(state)
  } else {
    const failed = results.filter(r => !r.success).map(r => r.tool).join(', ')
    taskStateManager.fail(state, failed ? `Steps failed: ${failed}` : 'Incomplete execution')
  }

  // Workflow tracking — close the node graph
  updateNode('main', { status: allSucceeded ? 'completed' : 'failed', completedAt: Date.now() })
  completeWorkflow(allSucceeded ? 'completed' : 'failed')

  // Record experience for self-learning
  const filesCreatedInPlan = results
    .filter(r => r.tool === 'file_write' && r.success && r.input?.path)
    .map(r => r.input.path as string)
    .filter(Boolean)

  learningMemory.record({
    task:         plan.goal,
    success:      allSucceeded,
    steps:        results.map(r => r.tool),
    duration:     Date.now() - planStart,
    tokenUsage:   state.tokenUsage,
    filesCreated: filesCreatedInPlan,
    errorMessage: !allSucceeded
      ? results.find(r => !r.success)?.error
      : undefined,
  })

  // Self-teaching — generate/update SKILL.md for this tool sequence
  const executedTools  = results.map(r => r.tool)
  const totalDuration  = results.reduce((s, r) => s + (r.duration || 0), 0)
  const anyFailed      = results.some(r => !r.success)

  if (allSucceeded && executedTools.length > 0) {
    // GrowthEngine — record success for gap-resolution tracking
    growthEngine.logSuccess(plan.goal, executedTools)

    try {
      const next = getNextAvailableAPI()
      if (next) {
        const key = next.entry.key.startsWith('env:')
          ? (process.env[next.entry.key.replace('env:', '')] || '')
          : next.entry.key
        skillTeacher.recordSuccess(
          plan.goal, executedTools, totalDuration,
          callLLM, key, next.entry.model, next.entry.provider,
        ).catch(() => {})
      }
    } catch {}
  } else if (anyFailed) {
    // GrowthEngine — record failure with full error context
    const firstError = results.find(r => !r.success)?.error ?? 'Unknown error'
    growthEngine.logFailure(plan.goal, firstError, executedTools)

    skillTeacher.recordFailure(plan.goal, executedTools)
  }

  // Execution summary
  const successCount    = results.filter(r => r.success).length
  const execTotalMs     = Date.now() - planStart
  console.log(`[Exec] Complete: ${successCount}/${results.length} steps succeeded in ${execTotalMs}ms`)

  // Finalize executions log
  try {
    const execFile = nodePath.join(process.cwd(), 'workspace', 'executions', `exec_${state.id}.json`)
    if (nodeFs.existsSync(execFile)) {
      const log = JSON.parse(nodeFs.readFileSync(execFile, 'utf8'))
      log.status        = allSucceeded ? 'completed' : 'failed'
      log.totalDuration = execTotalMs
      nodeFs.writeFileSync(execFile, JSON.stringify(log, null, 2))
    }
  } catch { /* non-blocking */ }

  return results
}

// ── Step ordering fixer ────────────────────────────────────────
// Ensures research/fetch steps always run before file_write steps.
// Prevents file_write from executing before deep_research has data.

function fixStepOrdering(steps: ToolStep[]): ToolStep[] {
  const researchTools = ['web_search', 'deep_research', 'fetch_url', 'fetch_page']
  const writeTools    = ['file_write']

  const research = steps.filter(s => researchTools.includes(s.tool))
  const writes   = steps.filter(s => writeTools.includes(s.tool))
  const others   = steps.filter(s => !researchTools.includes(s.tool) && !writeTools.includes(s.tool))

  // Order: research → other → write — re-number steps
  return [...research, ...others, ...writes]
    .map((s, i) => ({ ...s, step: i + 1 }))
}

// Resolve PREVIOUS_OUTPUT and {{step_N_output}} in step inputs
function resolvePreviousOutput(
  input:       Record<string, any>,
  stepOutputs: Record<number, string>,
  currentStep: number,
): Record<string, any> {
  const resolved: Record<string, any> = {}
  const lastOutput = stepOutputs[currentStep - 1] || ''

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') {
      resolved[key] = value
        .replace(/PREVIOUS_OUTPUT/g, lastOutput)
        .replace(/\{\{step_(\d+)_output\}\}/g, (_, n) => stepOutputs[parseInt(n, 10)] || '')
    } else {
      resolved[key] = value
    }
  }
  return resolved
}

// ── STEP 3: respondWithResults ────────────────────────────────

function responderSystem(userName: string, date: string): string {
  return AIDEN_RESPONDER_SYSTEM(userName, date)
}

export async function respondWithResults(
  originalMessage: string,
  plan:            AgentPlan,
  results:         StepResult[],
  history:         { role: string; content: string }[],
  userName:        string,
  apiKey:          string,
  model:           string,
  providerName:    string,
  onToken:         (token: string) => void,
  sessionId?:      string,
  goals?:          string[],   // Phase 1: multi-goal numbered output
): Promise<void> {

  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  // Load skill guidance for the response
  const responseSkills = skillLoader.findRelevant(originalMessage, 2)
  const responseSkillContext = responseSkills.length > 0
    ? `\nSkill guidance for this response:\n${responseSkills.map(s => `- ${s.name}: ${s.description}`).join('\n')}\n`
    : ''

  // Selective skill injection — simple messages (< 15 words, no tool keywords) get no skills;
  // complex messages get only the relevant subset (already filtered by findRelevant above).
  // Replaces the old loadAll() dump that injected all ~96 skills into every prompt.
  const capabilitiesSection = isSimpleMessage(originalMessage)
    ? ''
    : (responseSkills.length > 0
        ? `Relevant skills for this task: ${responseSkills.map(s => `${s.name} (${s.description})`).join(', ')}\n\n`
        : ''
      )


  // Knowledge context — relevant chunks from user's uploaded files
  const knowledgeCtxResponder = knowledgeBase.buildContext(originalMessage || '')
  const knowledgeResponderSection = knowledgeCtxResponder
    ? `\nRELEVANT KNOWLEDGE FROM YOUR FILES:\n${knowledgeCtxResponder}\n`
    : ''

  // ── Depth scoring: detect research tasks and force deep analysis ──
  const isResearch = results.some(r =>
    r.tool === 'deep_research' ||
    r.tool === 'run_agent'     ||
    (r.tool === 'web_search' && results.length > 1),
  )

  const depthInstruction = isResearch
    ? `\n\nRESEARCH RESPONSE REQUIREMENTS:
- Minimum 500 words
- Must include: Overview, Comparison (table or structured list), Key findings, Trends, Recommendation
- Compare entities explicitly: "X is better than Y for Z because..."
- Extract specific facts and numbers from the research data
- End with a clear Verdict or Recommendation section
- DO NOT just summarize — ANALYZE and provide INSIGHTS`
    : ''

  // Phase 1: multi-goal numbered output instruction
  const _goalsToUse   = goals && goals.length >= 2 ? goals : (plan.goals && plan.goals.length >= 2 ? plan.goals : null)
  const multiGoalInstruction = _goalsToUse
    ? `\n\nMULTI-GOAL RESPONSE — the user had ${_goalsToUse.length} distinct goals:\n${_goalsToUse.map((g, i) => `${i + 1}. ${g}`).join('\n')}\nStructure your response with numbered sections (1., 2., …) that match each goal above. Do not skip any goal.`
    : ''

  const executionSummary = results.length
    ? results.map((r, i) =>
        `Step ${i + 1} [${r.tool}]: ${r.success ? r.output.slice(0, 500) : 'FAILED — ' + r.error}`,
      ).join('\n\n')
    : ''

  // Inject conversation memory only when the message references past context
  // (reduces prompt size for routine messages — "hi", "thanks", etc.)
  const memCtx    = needsMemory(originalMessage) ? conversationMemory.buildContext() : ''
  const memSection = memCtx
    ? `\nCONVERSATION HISTORY:\n${memCtx}\n\nIf the user asks what we worked on, what was researched, or references previous work — answer from this history.\n`
    : ''

  // Entity graph — 1-line summary only (never dump full graph into prompt)
  const entityStats   = entityGraph.getStats()
  const entitySummary = entityStats.nodes > 0
    ? `You know ${entityStats.nodes} entities across your work.\n\n`
    : ''

  // Build a tool-results context block for the system prompt
  const toolResultsContext = results.length
    ? results.map(r => `[${r.tool} result]: ${r.success ? r.output.slice(0, 1000) : 'FAILED: ' + r.error}`).join('\n')
    : ''

  const systemWithResults = toolResultsContext
    ? `${capabilitiesSection}${entitySummary}${responderSystem(userName, date)}${responseSkillContext}${knowledgeResponderSection}${multiGoalInstruction}

YOU JUST RAN THESE TOOLS AND GOT THESE RESULTS:
${toolResultsContext}

CRITICAL RULES FOR YOUR RESPONSE:
- Include the ACTUAL output from the tools above in your response
- Do NOT say "I ran the tool" — show the RESULT
- If run_python returned a number, say that number
- If file_read returned text, show that text
- If system_info returned hardware data, show the data
- Be direct: show the actual output, then provide context if needed
- If a tool failed, say it failed and why`
    : `${capabilitiesSection}${entitySummary}${responderSystem(userName, date)}${responseSkillContext}${knowledgeResponderSection}${multiGoalInstruction}`

  const userContent = executionSummary
    ? `User asked: "${originalMessage}"\n\nReal execution results:\n${executionSummary}\n\nRespond naturally based on these real results only. Show the actual output, not a description of it.${depthInstruction}${memSection}`
    : `${originalMessage}${memSection}`

  let messages: { role: string; content: string }[] = [
    { role: 'system', content: systemWithResults },
    ...history.slice(-6),
    { role: 'user',   content: userContent },
  ]
  messages = await preflightCompressionCheck(messages, model, sessionId)
  messages = sanitizeMessages(messages)

  if (executionInterrupted) return
  const _respCtrl = new AbortController()
  currentAbortController = _respCtrl

  try {
    if (providerName === 'gemini') {
      const contents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
      const system = messages.find(m => m.role === 'system')?.content

      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          }),
          signal: AbortSignal.any([AbortSignal.timeout(30000), _respCtrl.signal]),
        },
      )
      if (!r.ok) {
        const errText = await r.text().catch(() => '')
        if (r.status === 429) { try { markRateLimited(providerName) } catch {} }
        throw new Error(`Responder ${r.status}: ${errText}`)
      }
      await streamGeminiResponse(r, onToken)

    } else if (providerName === 'ollama') {
      const ollamaMs = Math.min(getOllamaTimeout(model || ''), 15000) // cap at 15s for chat
      const _t0 = Date.now()
      console.log(`[Router] respondWithResults → ollama, model: ${model}, timeout: ${ollamaMs}ms`)
      const r = await fetch('http://localhost:11434/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, stream: true, messages }),
        signal:  AbortSignal.any([AbortSignal.timeout(ollamaMs), _respCtrl.signal]),
      })
      if (!r.body) throw new Error('Ollama: no response body')
      const reader  = (r.body as any).getReader()
      const decoder = new TextDecoder()
      let   ollamaTokens = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const line = decoder.decode(value)
        try {
          const parsed = JSON.parse(line) as any
          if (parsed?.message?.content) { onToken(parsed.message.content); ollamaTokens++ }
        } catch {}
      }
      console.log(`[Router] Ollama responded in ${Date.now() - _t0}ms (${ollamaTokens} tokens)`)
      if (ollamaTokens === 0) throw new Error('Ollama: empty response — no tokens emitted')

    } else {
      // OpenAI-compatible
      const url = OPENAI_COMPAT_ENDPOINTS[providerName] || OPENAI_COMPAT_ENDPOINTS.groq
      const r   = await fetch(url, {
        method:  'POST',
        headers: buildHeaders(providerName, apiKey),
        body: JSON.stringify({ model, messages, stream: true }),
        signal: AbortSignal.any([AbortSignal.timeout(30000), _respCtrl.signal]),
      })
      if (!r.ok) {
        const errText = await r.text().catch(() => '')
        if (r.status === 429) { try { markRateLimited(providerName) } catch {} }
        throw new Error(`Responder ${r.status}: ${errText}`)
      }
      await streamOpenAIResponse(r, onToken)
    }
  } catch (e: any) {
    if (e.name === 'AbortError') return
    console.error('[Responder] Error:', e.message)
    if (
      e.message?.includes('timeout') ||
      e.message?.includes('429') ||
      e.message?.includes('rate') ||
      e.message?.includes('aborted')
    ) {
      try { markRateLimited(providerName) } catch {}
    }

    // If Ollama was primary and failed/timed out, fall back to best cloud provider
    if (providerName === 'ollama') {
      const cloudFallback = getModelForTask('responder')
      if (cloudFallback.providerName !== 'ollama' && cloudFallback.apiKey) {
        console.log(`[Router] Ollama timeout/error — falling back to ${cloudFallback.providerName} (${cloudFallback.model})`)
        try {
          const url     = OPENAI_COMPAT_ENDPOINTS[cloudFallback.providerName] || OPENAI_COMPAT_ENDPOINTS.groq
          const headers = buildHeaders(cloudFallback.providerName, cloudFallback.apiKey)
          const r = await fetch(url, {
            method:  'POST',
            headers,
            body:    JSON.stringify({ model: cloudFallback.model, messages, stream: true }),
            signal:  AbortSignal.timeout(15000),
          })
          if (r.ok) { await streamOpenAIResponse(r, onToken); return }
        } catch (fbErr: any) {
          console.error(`[Router] Cloud fallback also failed: ${fbErr.message}`)
        }
      }
    }

    // If the cloud provider failed and we haven't tried Ollama yet, try it
    let ollamaResponded = false
    if (providerName !== 'ollama') {
      try {
        // Discover installed model via api/tags
        const cfg = loadConfig()
        let ollamaModel = process.env.OLLAMA_MODEL || cfg.ollama?.model || 'gemma4:e4b'
        try {
          const _ob = (process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434').replace(/\/$/, '')
          const tagsRes = await fetch(`${_ob}/api/tags`, { signal: AbortSignal.timeout(3000) })
          if (tagsRes.ok) {
            const tagsData = await tagsRes.json() as any
            const firstModel = tagsData?.models?.[0]?.name
            if (firstModel) ollamaModel = firstModel
          }
        } catch { /* Ollama not running */ }
        console.log(`[Responder] Cloud provider failed — falling back to Ollama (${ollamaModel})`)
        const r = await fetch('http://localhost:11434/api/chat', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: ollamaModel, stream: true, messages }),
          signal: AbortSignal.timeout(getOllamaTimeout(ollamaModel)),
        })
        if (r.ok && r.body) {
          const reader  = (r.body as any).getReader()
          const decoder = new TextDecoder()
          let   tokensEmitted = 0
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            try {
              const parsed = JSON.parse(decoder.decode(value)) as any
              if (parsed?.message?.content) { onToken(parsed.message.content); tokensEmitted++ }
            } catch {}
          }
          if (tokensEmitted > 0) { ollamaResponded = true }
        }
      } catch (ollamaErr: any) {
        console.warn(`[Responder] Ollama fallback also failed: ${ollamaErr.message}`)
      }
    }

    if (ollamaResponded) return

    // Last resort: return raw tool output if tools ran successfully
    if (results && results.length > 0 && results.some(r => r.success)) {
      const successResults = results.filter(r => r.success)
      const lastResult     = successResults[successResults.length - 1]
      onToken(lastResult.output || 'Here are the results.')
      return
    }

    // Include error info from failed tools if any
    if (results && results.length > 0) {
      const failedResult = results[results.length - 1]
      if (failedResult.error) {
        onToken(`Error: ${failedResult.error}`)
        return
      }
    }

    const degraded = enterDegradedMode(e.message || 'unknown error')
    onToken(degraded.message)
  }
}

// ── Non-streaming LLM helper (used by deepResearch) ──────────

export async function callLLM(
  prompt:       string,
  apiKey:       string,
  model:        string,
  providerName: string,
  opts?: { traceId?: string; isSystem?: boolean },
): Promise<string> {
  if (executionInterrupted) return ''
  const _ctrl = new AbortController()
  currentAbortController = _ctrl
  const messages = [{ role: 'user', content: prompt }]
  try {
    if (providerName === 'gemini') {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 2000 },
          }),
          signal: AbortSignal.any([AbortSignal.timeout(12000), _ctrl.signal]),
        },
      )
      if (r.status === 429) {
        try { markRateLimited(providerName) } catch {}
        throw new Error(`Rate limited (429): ${providerName}`)
      }
      if (!r.ok) {
        throw new Error(`HTTP ${r.status} from ${providerName}`)
      }
      const d = await r.json() as any
      try {
        costTracker.trackUsage(
          providerName, model,
          d?.usageMetadata?.promptTokenCount    ?? 0,
          d?.usageMetadata?.candidatesTokenCount ?? 0,
          opts?.traceId, opts?.isSystem ?? false,
        )
      } catch {}
      return d?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    } else if (providerName === 'ollama') {
      const r = await fetch('http://localhost:11434/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: model || 'mistral:7b', stream: false, messages }),
        signal: AbortSignal.any([AbortSignal.timeout(getOllamaTimeout(model || '')), _ctrl.signal]),
      })
      if (r.status === 429) {
        try { markRateLimited(providerName) } catch {}
        throw new Error(`Rate limited (429): ${providerName}`)
      }
      if (!r.ok) {
        throw new Error(`HTTP ${r.status} from ${providerName}`)
      }
      const d = await r.json() as any
      try {
        costTracker.trackUsage(
          providerName, model,
          d?.prompt_eval_count ?? 0,
          d?.eval_count        ?? 0,
          opts?.traceId, opts?.isSystem ?? false,
        )
      } catch {}
      return d?.message?.content || ''

    } else if (providerName === 'cloudflare') {
      // Cloudflare Workers AI — accountId|modelName stored in model field
      const [accountId, cfModel] = model.split('|')
      const r = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${cfModel || '@cf/meta/llama-3.1-8b-instruct'}`,
        {
          method:  'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify({ messages }),
          signal:  AbortSignal.any([AbortSignal.timeout(20000), _ctrl.signal]),
        }
      )
      if (r.status === 429) {
        try { markRateLimited(providerName) } catch {}
        throw new Error(`Rate limited (429): ${providerName}`)
      }
      if (!r.ok) throw new Error(`cloudflare ${r.status}`)
      const d = await r.json() as any
      try {
        costTracker.trackUsage(providerName, model, 0, 0, opts?.traceId, opts?.isSystem ?? false)
      } catch {}
      return d?.result?.response || ''

    } else {
      // OpenAI-compatible: groq, openrouter, cerebras, nvidia, github
      const url     = OPENAI_COMPAT_ENDPOINTS[providerName] || OPENAI_COMPAT_ENDPOINTS.groq
      const headers = buildHeaders(providerName, apiKey)
      const r = await fetch(url, {
        method:  'POST',
        headers,
        body: JSON.stringify({ model, messages, stream: false, max_tokens: 2000 }),
        signal: AbortSignal.any([AbortSignal.timeout(12000), _ctrl.signal]),
      })
      if (r.status === 429) {
        try { markRateLimited(providerName) } catch {}
        throw new Error(`Rate limited (429): ${providerName}`)
      }
      if (!r.ok) {
        throw new Error(`HTTP ${r.status} from ${providerName}`)
      }
      const d = await r.json() as any
      try {
        costTracker.trackUsage(
          providerName, model,
          d?.usage?.prompt_tokens    ?? 0,
          d?.usage?.completion_tokens ?? 0,
          opts?.traceId, opts?.isSystem ?? false,
        )
      } catch {}
      return d?.choices?.[0]?.message?.content || ''
    }
  } catch (e: any) {
    if (e.name === 'AbortError') return ''
    console.error('[callLLM] error:', e.message)
    return ''
  }
}

// ── Deep research: 3-pass LLM-assisted research loop ─────────
// Called directly (e.g. from a /api/research endpoint) or as
// a high-level entry point when the planner picks deep_research.

export async function deepResearch(
  topic:      string,
  apiKey:     string,
  model:      string,
  provider:   string,
  onProgress: (msg: string) => void,
): Promise<string> {

  const allResults: string[] = []
  let   currentQuery = topic
  const maxPasses    = 7

  for (let pass = 1; pass <= maxPasses; pass++) {
    onProgress(`Pass ${pass}: Searching "${currentQuery}"...`)

    const searchResult = await executeTool('web_search', { query: currentQuery })
    if (!searchResult.success || !searchResult.output) break

    allResults.push(`=== Pass ${pass}: ${currentQuery} ===\n${searchResult.output}`)

    // Reflection: what gaps remain?
    const reflectionPrompt = `You are researching: "${topic}"

So far you have found:
${allResults.join('\n\n').slice(0, 3000)}

Analyze the gaps:
1. What important aspects of "${topic}" are still missing?
2. What contradictions need resolving?
3. What specific follow-up query would fill the biggest gap?

Respond in JSON:
{
  "gaps": ["gap1", "gap2"],
  "nextQuery": "specific search query to fill the biggest gap",
  "complete": true/false
}`

    const reflection = await callLLM(reflectionPrompt, apiKey, model, provider)

    let reflectionData: any = {}
    try {
      const match = reflection.match(/\{[\s\S]*\}/)
      reflectionData = JSON.parse(match?.[0] || '{}')
    } catch {}

    if (reflectionData.complete === true || !reflectionData.nextQuery) break

    currentQuery = reflectionData.nextQuery
    onProgress(`Filling gap: ${reflectionData.gaps?.[0] || currentQuery}`)

    // Source quality scoring
    const isHighQuality = searchResult.output.includes('wikipedia') ||
      searchResult.output.includes('.gov') ||
      searchResult.output.includes('reuters') ||
      searchResult.output.includes('bloomberg')

    if (isHighQuality) onProgress('✓ High-quality source found')
  }

  return allResults.join('\n\n')
}


