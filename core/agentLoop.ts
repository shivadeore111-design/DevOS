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
import { planTool }           from './planTool'
import type { Phase }         from './planTool'
import { WorkspaceMemory }    from './workspaceMemory'
import * as nodeFs             from 'fs'
import * as nodePath           from 'path'
import * as nodeOs             from 'os'

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
    open_browser:    'browsing', browser_click:   'browsing',
    browser_extract: 'browsing', browser_type:    'browsing',
    file_write:      'writing',  file_read:       'reading',
    file_list:       'reading',  shell_exec:      'execution',
    run_python:      'execution', run_node:       'execution',
    system_info:     'execution', notify:         'execution',
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

// ── STEP 1: planWithLLM ────────────────────────────────────────

export async function planWithLLM(
  message:      string,
  history:      { role: string; content: string }[],
  apiKey:       string,
  model:        string,
  provider:     string,
): Promise<AgentPlan> {

  const ALLOWED_TOOLS = [
    'web_search', 'fetch_page', 'open_browser', 'browser_extract',
    'browser_click', 'browser_type', 'file_write', 'file_read',
    'file_list', 'shell_exec', 'run_python', 'run_node',
    'system_info', 'notify', 'deep_research',
  ]

  const plannerPrompt = `You are DevOS Planner. Analyze the user request and output a JSON plan.

CRITICAL RULES:
1. If the answer is in your training data (capitals, definitions, facts, opinions, advice) → requires_execution: false
2. ONLY use tools when you need: live data, file operations, running code, or computer control
3. You MUST ONLY use tools from this exact list: ${ALLOWED_TOOLS.join(', ')}
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
{ "goal": "...", "requires_execution": false, "reasoning": "...", "plan": [] }`

  const messages = [
    { role: 'system', content: plannerPrompt },
    ...history.slice(-3).map((h: any) => ({
      role:    h.role === 'assistant' ? 'assistant' : 'user',
      content: String(h.content).slice(0, 300),
    })),
    { role: 'user', content: message },
  ]

  let raw = ''

  try {
    raw = await callLLM(
      messages.map(m => `${m.role}: ${m.content}`).join('\n'),
      apiKey, model, provider,
    )

    const jsonMatch = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in planner response')

    const parsed = JSON.parse(jsonMatch[0]) as any

    // Validate tool names — reject hallucinated tools
    const rawPlan = (parsed.plan || parsed.steps || []) as any[]
    const validatedPlan = rawPlan.filter((s: any) => {
      if (!ALLOWED_TOOLS.includes(s.tool)) {
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

    return {
      goal:               parsed.goal || message,
      requires_execution: parsed.requires_execution === true && orderedPlan.length > 0,
      plan:               orderedPlan,
      direct_response:    parsed.direct_response,
      planId:             taskPlan.id,
      workspaceDir:       taskPlan.workspaceDir,
      phases:             taskPlan.phases,
    }

  } catch (e: any) {
    console.error('[Planner] Failed:', e.message, '| Raw:', raw.slice(0, 200))
    return { goal: message, requires_execution: false, plan: [] }
  }
}

// ── STEP 2: executePlan ────────────────────────────────────────

export async function executePlan(
  plan:           AgentPlan,
  onStep:         (step: ToolStep, result: StepResult) => void,
  onPhaseChange?: (phase: Phase, index: number, total: number) => void,
): Promise<StepResult[]> {

  const results:     StepResult[]           = []
  const stepOutputs: Record<number, string> = {}

  // Workspace memory for persisting intermediate artifacts
  const workspace = plan.planId ? new WorkspaceMemory(plan.planId) : null

  // Maps each tool to its capability bucket (for phase transition detection)
  const capabilityMap: Record<string, string> = {
    web_search:      'research', fetch_page:      'research',
    deep_research:   'research', fetch_url:       'research',
    open_browser:    'browsing', browser_click:   'browsing',
    browser_extract: 'browsing', browser_type:    'browsing',
    file_write:      'writing',  file_read:       'reading',
    file_list:       'reading',  shell_exec:      'execution',
    run_python:      'execution', run_node:       'execution',
    system_info:     'execution', notify:         'execution',
  }

  let lastCapability = ''
  let currentPhaseIdx = 0
  const totalPhases   = plan.phases?.length || 1

  for (const step of plan.plan) {
    const stepStart = Date.now()

    // Detect phase transition — advance planTool when capability changes
    const thisCap = capabilityMap[step.tool] || 'execution'
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

    livePulse.tool('Aiden', step.tool, JSON.stringify(step.input).slice(0, 80))

    // Validate tool exists before running
    if (!TOOLS[step.tool]) {
      const stepResult: StepResult = {
        step: step.step, tool: step.tool, input: step.input,
        success:  false, output: '',
        error:    `Tool "${step.tool}" does not exist. Available: ${Object.keys(TOOLS).slice(0, 8).join(', ')}`,
        duration: 0,
      }
      results.push(stepResult)
      onStep(step, stepResult)
      livePulse.error('Aiden', `Invalid tool: ${step.tool}`)
      continue
    }

    // Resolve PREVIOUS_OUTPUT and {{step_N_output}} in input
    let resolvedInput = resolvePreviousOutput(step.input, stepOutputs, step.step)

    let stepResult: StepResult | null = null
    let attempts = 0
    const MAX_ATTEMPTS = 2

    // Self-healing retry loop
    while (attempts < MAX_ATTEMPTS) {
      attempts++
      try {
        const toolResult = await executeTool(step.tool, resolvedInput)

        stepResult = {
          step: step.step, tool: step.tool, input: resolvedInput,
          success:  toolResult.success,
          output:   toolResult.output || '',
          error:    toolResult.error,
          duration: Date.now() - stepStart,
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

        if (!stepResult.success && attempts < MAX_ATTEMPTS) {
          livePulse.error('Aiden', `Attempt ${attempts} failed: ${stepResult.error} — retrying...`)
          await new Promise(r => setTimeout(r, 800))
          // For file_write failures, fall back to Desktop path
          if (step.tool === 'file_write' && resolvedInput.path) {
            resolvedInput = {
              ...resolvedInput,
              path: nodePath.join(nodeOs.homedir(), 'Desktop', nodePath.basename(resolvedInput.path)),
            }
          }
        } else {
          break
        }

      } catch (e: any) {
        stepResult = {
          step: step.step, tool: step.tool, input: resolvedInput,
          success:  false, output: '',
          error:    e.message,
          duration: Date.now() - stepStart,
        }
        if (attempts < MAX_ATTEMPTS) {
          livePulse.error('Aiden', `Error attempt ${attempts}: ${e.message} — retrying...`)
          await new Promise(r => setTimeout(r, 800))
        } else {
          break
        }
      }
    }

    if (stepResult) {
      stepOutputs[step.step] = stepResult.output
      results.push(stepResult)
      onStep(step, stepResult)

      if (stepResult.success) {
        livePulse.done('Aiden', `${step.tool} ✓ ${stepResult.output.slice(0, 60)}`)
      } else {
        livePulse.error('Aiden', `${step.tool} failed after ${attempts} attempt(s): ${stepResult.error}`)
        // Continue to next step — don't abort the whole plan
      }
    }
  }

  // Complete final phase
  if (plan.planId) {
    planTool.advancePhase(plan.planId, 'All steps completed')
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
  return `You are Aiden — a personal AI OS running on ${userName}'s Windows machine. You are calm, direct, capable, and slightly witty. You speak like a trusted co-founder.
Current date: ${date}

RULES:
- You just executed real tools and have their real output
- Report results accurately — never add or invent information
- Be concise: 1-3 sentences for simple results, more only if the output is rich
- If a tool failed, say so honestly
- Never describe what you're about to do — report what was done`
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

  const userContent = executionSummary
    ? `User asked: "${originalMessage}"\n\nReal execution results:\n${executionSummary}\n\nRespond naturally based on these real results only.${depthInstruction}`
    : originalMessage

  const messages = [
    { role: 'system', content: responderSystem(userName, date) },
    ...history.slice(-6),
    { role: 'user',   content: userContent },
  ]

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
      const err = await r.text()
      throw new Error(`Responder ${r.status}: ${err}`)
    }
    await streamOpenAIResponse(r, onToken)
  }
}

// ── Non-streaming LLM helper (used by deepResearch) ──────────

async function callLLM(
  prompt:       string,
  apiKey:       string,
  model:        string,
  providerName: string,
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
          signal: AbortSignal.timeout(25000),
        },
      )
      const d = await r.json() as any
      return d?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    } else if (providerName === 'ollama') {
      const r = await fetch('http://localhost:11434/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: model || 'mistral:7b', stream: false, messages }),
        signal: AbortSignal.timeout(30000),
      })
      const d = await r.json() as any
      return d?.message?.content || ''

    } else {
      // OpenAI-compatible: groq, openrouter, cerebras, nvidia
      const url     = OPENAI_COMPAT_ENDPOINTS[providerName] || OPENAI_COMPAT_ENDPOINTS.groq
      const headers = buildHeaders(providerName, apiKey)
      const r = await fetch(url, {
        method:  'POST',
        headers,
        body: JSON.stringify({ model, messages, stream: false, max_tokens: 2000 }),
        signal: AbortSignal.timeout(25000),
      })
      const d = await r.json() as any
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

  // PASS 1: Broad search
  onProgress('Pass 1: Discovering sources...')
  const broadSearch = await executeTool('web_search', { query: topic })

  // LLM-assisted entity extraction
  const extractPrompt = `From this research data, extract a list of 4-6 specific entities/tools/products/companies that are mentioned.
Output ONLY a JSON array of strings: ["Entity1", "Entity2", ...]

Data: ${broadSearch.output.slice(0, 2000)}`

  let entities: string[] = []
  try {
    const raw   = await callLLM(extractPrompt, apiKey, model, provider)
    const match = raw.match(/\[[\s\S]*\]/)
    if (match) entities = JSON.parse(match[0]) as string[]
  } catch {}

  if (!entities.length) {
    // Heuristic fallback: capitalized proper nouns
    const patterns = (broadSearch.output).match(/\b([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)\b/g) || []
    const SKIP = new Set(['The','This','That','From','With','For','And','But','Source'])
    entities = [...new Set(patterns)].filter(e => e.length > 3 && !SKIP.has(e)).slice(0, 4)
  }

  // PASS 2: Deep dive each entity
  onProgress(`Pass 2: Deep diving ${entities.length} entities...`)
  const entityData: Record<string, string> = {}
  for (const entity of entities.slice(0, 4)) {
    const search = await executeTool('web_search', { query: `${entity} features pros cons review 2025` })
    entityData[entity] = search.output.slice(0, 1000)
  }

  // PASS 3: LLM synthesis — compare, analyze, conclude
  onProgress('Pass 3: Synthesizing insights...')

  const synthesizePrompt = `You are a research analyst. Based on this real web data, produce a DEEP research report.

Topic: "${topic}"

Broad research:
${broadSearch.output.slice(0, 1000)}

Entity deep dives:
${Object.entries(entityData).map(([name, data]) => `## ${name}\n${data}`).join('\n\n')}

YOUR OUTPUT MUST INCLUDE:
1. **Overview** — what's happening in this space right now
2. **Entity Comparison** — table or structured comparison of each entity found
3. **Strengths & Weaknesses** — for each major entity
4. **Key Trends** — patterns you see across the data
5. **Recommendation** — who should use what and why
6. **Verdict** — single strongest conclusion

Rules:
- DO NOT summarize. Provide ANALYSIS.
- Extract specific facts, numbers, features from the data
- Make comparisons explicit: "X is better than Y for Z because..."
- Minimum 600 words
- Use markdown headers, bullet points, bold for key points`

  const report = await callLLM(synthesizePrompt, apiKey, model, provider)
  return report
}
