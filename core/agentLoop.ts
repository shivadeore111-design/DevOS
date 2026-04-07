// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/agentLoop.ts — 3-step agent loop:
//   STEP 1: PLAN   — LLM outputs JSON plan only (no execution)
//   STEP 2: EXECUTE — Code runs each tool, gets real results
//   STEP 3: RESPOND — LLM sees real results, streams natural language

import { executeTool, TOOLS } from './toolRegistry'
import { livePulse }          from '../coordination/livePulse'
import { planTool }                        from './planTool'
import type { Phase }                      from './planTool'
import { WorkspaceMemory }                 from './workspaceMemory'
import { taskStateManager, TaskState }     from './taskState'
import { skillLoader }                     from './skillLoader'
import { learningMemory }                  from './learningMemory'
import { conversationMemory }             from './conversationMemory'
import { getNextAvailableAPI, markRateLimited, incrementUsage, getModelForTask, getOllamaModelForTask } from '../providers/router'
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
import { semanticMemory } from './semanticMemory'
import * as nodeFs             from 'fs'
import * as nodePath           from 'path'
import * as nodeOs             from 'os'

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
  requires_execution: boolean
  plan:               ToolStep[]
  direct_response?:   string
  planId?:            string
  workspaceDir?:      string
  phases?:            Phase[]
  reason?:            string
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
      return k.length > 0 && a.provider !== 'ollama'
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

// ── STEP 1: planWithLLM ────────────────────────────────────────

export async function planWithLLM(
  message:       string,
  history:       { role: string; content: string }[],
  apiKey:        string,
  model:         string,
  provider:      string,
  memoryContext?: string,
): Promise<AgentPlan> {

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
  ]

  // Sprint 13: append discovered MCP tools
  const mcpToolNames = mcpClient.getAllCachedTools().map(t => t.name)
  const allTools     = mcpToolNames.length > 0
    ? [...ALLOWED_TOOLS, ...mcpToolNames]
    : ALLOWED_TOOLS

  // Load any relevant skills to guide planning
  const relevantSkills = skillLoader.findRelevant(message)
  const skillContext   = skillLoader.formatForPrompt(relevantSkills)

  // Build memory section — inject when available
  const memorySection = memoryContext && memoryContext.trim()
    ? `\n\nCONVERSATION MEMORY (use to resolve references like "that file", "the report", "it"):\n${memoryContext}\n\nWhen the user says "that file", "the report", "the script" etc., use the paths/queries above to resolve them into concrete values in your plan inputs.\n`
    : ''

  // Build learning context — past experiences with similar tasks
  const learningCtx     = learningMemory.buildLearningContext(message)
  const learningSection = learningCtx ? `\n${learningCtx}\n` : ''

  // Build knowledge context — relevant chunks from user's knowledge base files
  const knowledgeCtxPlanner = knowledgeBase.buildContext(message)
  const knowledgeSection    = knowledgeCtxPlanner
    ? `\n\n${knowledgeCtxPlanner}\n`
    : ''

  // Sprint 21: unified memory recall — inject relevant memories into planner
  let memoryRecallSection = ''
  try {
    const recalled       = await unifiedMemoryRecall(message, 3)
    const memoryInjected = buildMemoryInjection(recalled)
    if (memoryInjected) {
      memoryRecallSection = memoryInjected
    }
  } catch {}

  const plannerPrompt = `You are DevOS Planner. Analyze the user request and output a JSON plan.

CRITICAL RULES:
1. If the answer is in your training data (capitals, definitions, facts, opinions, advice) → requires_execution: false
2. ONLY use tools when you need: live data, file operations, running code, or computer control
3. You MUST ONLY use tools from this exact list: ${allTools.join(', ')}
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
  "requires_execution": true,
  "reasoning": "one sentence why",
  "plan": [
    { "step": 1, "tool": "web_search", "input": { "query": "weather London today" }, "description": "Get London weather" }
  ]
}

If requires_execution is false:
{ "goal": "...", "requires_execution": false, "reasoning": "...", "plan": [], "direct_response": "your answer here" }

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

FAILURE REPLANNING RULES (when message contains "previous approach failed at"):
- Keep new plan to max 2 steps
- Use ONLY the specific alternative approach mentioned in the message
- DO NOT add web_search, deep_research, file_write, or notify unless directly needed
- DO NOT add unrelated analysis or comparison steps
${skillContext}${memorySection}${learningSection}${knowledgeSection}${memoryRecallSection}
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
          contextHistory = [{ role: 'system', content: `Earlier conversation summary: ${summary}` }, ...recent]
          console.log(`[Planner] Context window: summarized ${older.length} older messages`)
        } else {
          contextHistory = recent
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
  let raw         = ''
  let parsed: any = null

  for (let attempt = 0; attempt < 3; attempt++) {
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
        console.warn(`[Planner] Empty response attempt ${attempt + 1} (${curProvider}) — marking and rotating`)
        try {
          markRateLimited(curProvider)
        } catch {}
      } else {
        const jsonMatch = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          console.warn(`[Planner] No JSON attempt ${attempt + 1}: ${raw.slice(0, 100)}`)
        } else {
          parsed = JSON.parse(jsonMatch[0])
          try { incrementUsage(curProvider) } catch {}
          break // success — exit retry loop
        }
      }
    } catch (e: any) {
      console.warn(`[Planner] Attempt ${attempt + 1} error (${curProvider}): ${e.message}`)
      if (
        e.message?.includes('timeout') ||
        e.message?.includes('429') ||
        e.message?.includes('rate') ||
        e.message?.includes('aborted')
      ) {
        try {
          markRateLimited(curProvider)
          console.log(`[Planner] Marked ${curProvider} as rate limited — will rotate away`)
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
        console.log(`[Planner] Rotating (tiered) to ${tiered.apiName} (${curProvider}/${curModel})`)
      } else {
        const cfg = loadConfig()
        curApiKey   = ''
        curModel    = cfg.model?.activeModel || 'mistral:7b'
        curProvider = 'ollama'
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
        const tagsRes = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) })
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
    // Check tool name is valid
    if (!VALID_TOOLS.includes(step.tool)) {
      errors.push(`Step ${step.step}: unknown tool "${step.tool}"`)
      continue
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

// —— Sprint 8: dependency-group builder ——————————————
// Groups consecutive tool steps into batches: parallel-safe tools are
// batched together; sequential tools break the batch.

const PARALLEL_SAFE = new Set([
  'web_search', 'system_info', 'get_stocks', 'get_market_data',
  'social_research', 'fetch_url', 'fetch_page', 'get_company_info',
  'deep_research', 'code_interpreter_python', 'code_interpreter_node',
  'clipboard_read', 'window_list', 'watch_folder_list',
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

  const results:     StepResult[]           = []
  const stepOutputs: Record<number, string> = {}
  const planStart    = Date.now()

  console.log(`[ExecutePlan] Starting: ${plan.plan.length} steps, goal: "${plan.goal.slice(0, 60)}"`)

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

  // Execute the tool (retries + per-tool timeout handled internally)
  let toolResult = await executeTool(step.tool, resolvedInput)

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

  console.log(`[ExecutePlan] Step ${step.step} result: ${stepResult.success ? '✓' : '✗'} ${stepResult.error || stepResult.output?.slice(0, 80) || ''}`)
  stepOutputs[step.step] = stepResult.output
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
      const step       = unskipped[0]
      const stepResult = await executeSingleStep(step, stepOutputs, state, plan, workspace, onStep)
      stepOutputs[step.step] = stepResult.output
      results.push(stepResult)

      // ── Sprint 28: mid-execution replan on failure ─────────────────
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
          const replanDecision = await shouldReplan(
            plan.goal,
            results,
            step,
            stepResult.error || 'unknown error',
            _rpKey, _rpModel, _rpProvider,
          )
          if (replanDecision.replan && replanDecision.newApproach) {
            livePulse.act('Aiden', `Replanning: ${replanDecision.newApproach}`)
            auditTrail.record({
              action:     'system',
              tool:       'replan',
              input:      `Failed: ${step.tool}`,
              output:     replanDecision.newApproach,
              durationMs: 0,
              success:    true,
              goal:       plan.goal,
              traceId:    plan.planId,
            })
            try {
              const newPlan = await planWithLLM(
                `${plan.goal} — previous approach failed at ${step.tool}: ${replanDecision.newApproach}`,
                [],
                _rpKey, _rpModel, _rpProvider,
              )
              if (newPlan && newPlan.plan && newPlan.plan.length > 0) {
                const newGroups = buildDependencyGroups(newPlan.plan)
                // Replace remaining groups with the new plan's groups
                groups.splice(_gi, groups.length - _gi, ...newGroups)
                console.log(`[ExecutePlan] Replan spliced ${newGroups.length} new group(s) from step ${_gi}`)
              }
            } catch (e: any) {
              console.warn(`[ExecutePlan] Replan planWithLLM failed: ${e.message}`)
            }
          }
        }
      }

    } else {
      // —— Parallel group ———————————————————————
      livePulse.act('Aiden', `Running ${unskipped.length} steps in parallel: ${unskipped.map(s => s.tool).join(', ')}`)
      const settled = await Promise.allSettled(
        unskipped.map(step => executeSingleStep(step, stepOutputs, state, plan, workspace, onStep))
      )
      for (let i = 0; i < unskipped.length; i++) {
        const s      = unskipped[i]
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
): Promise<void> {

  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  // Load skill guidance for the response
  const responseSkills = skillLoader.findRelevant(originalMessage, 2)
  const responseSkillContext = responseSkills.length > 0
    ? `\nSkill guidance for this response:\n${responseSkills.map(s => `- ${s.name}: ${s.description}`).join('\n')}\n`
    : ''

  // Build loaded-skills addendum (personality core is in AIDEN_RESPONDER_SYSTEM)
  const loadedSkills = skillLoader.loadAll()
  const capabilitiesSection = loadedSkills.length > 0
    ? `Loaded skills for this task: ${loadedSkills.map(s => `${s.name} (${s.description})`).join(', ')}\n\n`
    : ''


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

  const executionSummary = results.length
    ? results.map((r, i) =>
        `Step ${i + 1} [${r.tool}]: ${r.success ? r.output.slice(0, 500) : 'FAILED — ' + r.error}`,
      ).join('\n\n')
    : ''

  // Inject conversation memory so responder can answer questions about past work
  const memCtx    = conversationMemory.buildContext()
  const memSection = memCtx
    ? `\nCONVERSATION HISTORY:\n${memCtx}\n\nIf the user asks what we worked on, what was researched, or references previous work — answer from this history.\n`
    : ''

  // Build a tool-results context block for the system prompt
  const toolResultsContext = results.length
    ? results.map(r => `[${r.tool} result]: ${r.success ? r.output.slice(0, 1000) : 'FAILED: ' + r.error}`).join('\n')
    : ''

  const systemWithResults = toolResultsContext
    ? `${capabilitiesSection}${responderSystem(userName, date)}${responseSkillContext}${knowledgeResponderSection}

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
    : `${capabilitiesSection}${responderSystem(userName, date)}${responseSkillContext}${knowledgeResponderSection}`

  const userContent = executionSummary
    ? `User asked: "${originalMessage}"\n\nReal execution results:\n${executionSummary}\n\nRespond naturally based on these real results only. Show the actual output, not a description of it.${depthInstruction}${memSection}`
    : `${originalMessage}${memSection}`

  const messages = [
    { role: 'system', content: systemWithResults },
    ...history.slice(-6),
    { role: 'user',   content: userContent },
  ]

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
        },
      )
      if (!r.ok) {
        const errText = await r.text().catch(() => '')
        if (r.status === 429) { try { markRateLimited(providerName) } catch {} }
        throw new Error(`Responder ${r.status}: ${errText}`)
      }
      await streamGeminiResponse(r, onToken)

    } else if (providerName === 'ollama') {
      const r = await fetch('http://localhost:11434/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, stream: true, messages }),
      })
      if (!r.body) return
      const reader  = (r.body as any).getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const line = decoder.decode(value)
        try {
          const parsed = JSON.parse(line) as any
          if (parsed?.message?.content) onToken(parsed.message.content)
        } catch {}
      }

    } else {
      // OpenAI-compatible
      const url = OPENAI_COMPAT_ENDPOINTS[providerName] || OPENAI_COMPAT_ENDPOINTS.groq
      const r   = await fetch(url, {
        method:  'POST',
        headers: buildHeaders(providerName, apiKey),
        body: JSON.stringify({ model, messages, stream: true }),
      })
      if (!r.ok) {
        const errText = await r.text().catch(() => '')
        if (r.status === 429) { try { markRateLimited(providerName) } catch {} }
        throw new Error(`Responder ${r.status}: ${errText}`)
      }
      await streamOpenAIResponse(r, onToken)
    }
  } catch (e: any) {
    console.error('[Responder] Error:', e.message)
    if (
      e.message?.includes('timeout') ||
      e.message?.includes('429') ||
      e.message?.includes('rate') ||
      e.message?.includes('aborted')
    ) {
      try { markRateLimited(providerName) } catch {}
    }

    // If the cloud provider failed and we haven't tried Ollama yet, try it
    let ollamaResponded = false
    if (providerName !== 'ollama') {
      try {
        // Discover installed model via api/tags
        const cfg = loadConfig()
        let ollamaModel = process.env.OLLAMA_MODEL || cfg.ollama?.model || 'gemma4:e4b'
        try {
          const tagsRes = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) })
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
      onToken(lastResult.output || 'Done.')
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

    onToken('\n\nI encountered an error generating a response. Please try again.')
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
          signal: AbortSignal.timeout(12000),
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
        signal: AbortSignal.timeout(getOllamaTimeout(model || '')),
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
          signal:  AbortSignal.timeout(20000),
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
        signal: AbortSignal.timeout(12000),
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


