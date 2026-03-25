// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/agentLoop.ts — 3-step agent loop:
//   STEP 1: PLAN   — LLM outputs JSON plan only (no execution)
//   STEP 2: EXECUTE — Code runs each tool, gets real results
//   STEP 3: RESPOND — LLM sees real results, streams natural language

import { executeTool }  from './toolRegistry'
import { livePulse }    from '../coordination/livePulse'

// ── Types ─────────────────────────────────────────────────────

export interface ToolStep {
  tool:        string
  args:        Record<string, any>
  description: string
}

export interface AgentPlan {
  requires_execution: boolean
  steps:              ToolStep[]
  direct_response?:   string   // populated when requires_execution is false
}

export interface StepResult {
  step:    number
  tool:    string
  args:    Record<string, any>
  success: boolean
  output:  string
  error?:  string
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

// ── STEP 1: planWithLLM ────────────────────────────────────────

const PLANNER_SYSTEM = `You are a task planner for DevOS, an AI OS running on Windows.
Analyze the user message and output a JSON execution plan ONLY.
No markdown fences, no explanation — ONLY valid JSON.

Available tools:
- open_browser      args: {"url":"https://..."}
- web_search        args: {"query":"..."}
- shell_exec        args: {"command":"powershell command"}
- file_write        args: {"path":"C:\\\\Users\\\\...\\\\file.txt","content":"..."}
- file_read         args: {"path":"C:\\\\Users\\\\...\\\\file.txt"}
- file_list         args: {"path":"C:\\\\Users\\\\..."}
- run_python        args: {"script":"python code"}
- run_node          args: {"script":"js code"}
- system_info       args: {}
- notify            args: {"message":"..."}
- fetch_url         args: {"url":"https://..."}
- browser_extract   args: {}
- browser_click     args: {"selector":"CSS selector or text"}
- browser_type      args: {"selector":"...","text":"..."}
- browser_screenshot args: {}

Output format (ONLY this JSON, nothing else):
{
  "requires_execution": true,
  "steps": [
    {"tool":"tool_name","args":{...},"description":"what this step does"}
  ]
}

OR for questions/greetings/knowledge answers:
{
  "requires_execution": false,
  "steps": [],
  "direct_response": "your answer here"
}

Rules:
- Questions, greetings, explanations, knowledge topics → requires_execution: false
- DO something real (open, create, run, find, search, notify) → requires_execution: true
- Use {{step_N_output}} (0-indexed) to pass output of one step as input to another
- Max 5 steps. Be precise with args.`

export async function planWithLLM(
  message:      string,
  history:      { role: string; content: string }[],
  apiKey:       string,
  model:        string,
  providerName: string,
): Promise<AgentPlan> {
  const messages = [
    { role: 'system', content: PLANNER_SYSTEM },
    ...history.slice(-4),
    { role: 'user', content: `Plan this task: ${message}` },
  ]

  try {
    let raw = ''

    if (providerName === 'gemini') {
      const contents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
      const system = messages.find(m => m.role === 'system')?.content

      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction: system ? { parts: [{ text: system }] } : undefined,
            generationConfig:  { maxOutputTokens: 600, temperature: 0 },
          }),
          signal: AbortSignal.timeout(14000),
        },
      )
      const d = await r.json() as any
      if (!r.ok) throw new Error(`Gemini plan ${r.status}: ${JSON.stringify(d)}`)
      raw = d?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    } else if (providerName === 'ollama') {
      const r = await fetch('http://localhost:11434/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, stream: false, messages }),
        signal: AbortSignal.timeout(30000),
      })
      const d = await r.json() as any
      raw = d?.message?.content || ''

    } else {
      // OpenAI-compatible: groq, openrouter, cerebras, nvidia
      const url = OPENAI_COMPAT_ENDPOINTS[providerName] || OPENAI_COMPAT_ENDPOINTS.groq
      const r   = await fetch(url, {
        method:  'POST',
        headers: buildHeaders(providerName, apiKey),
        body: JSON.stringify({
          model,
          messages,
          max_tokens:  600,
          temperature: 0,
          stream:      false,
        }),
        signal: AbortSignal.timeout(14000),
      })
      const d = await r.json() as any
      if (!r.ok) throw new Error(`Plan ${r.status}: ${JSON.stringify(d)}`)
      raw = d?.choices?.[0]?.message?.content || ''
    }

    // Strip markdown fences, extract first JSON object
    const cleaned   = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Planner returned no JSON')

    const plan = JSON.parse(jsonMatch[0]) as AgentPlan

    if (typeof plan.requires_execution !== 'boolean') plan.requires_execution = false
    if (!Array.isArray(plan.steps))                   plan.steps              = []

    return plan

  } catch (err: any) {
    console.error('[AgentLoop] planWithLLM error:', err.message)
    // Safe fallback — treat as chat with no tools
    return { requires_execution: false, steps: [] }
  }
}

// ── STEP 2: executePlan ────────────────────────────────────────

export async function executePlan(
  plan:   AgentPlan,
  onStep: (result: StepResult) => void,
): Promise<StepResult[]> {
  const results:     StepResult[] = []
  const stepOutputs: string[]     = []

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i]

    // Resolve {{step_N_output}} templates in every string arg
    const resolvedArgs: Record<string, any> = {}
    for (const [k, v] of Object.entries(step.args)) {
      resolvedArgs[k] = typeof v === 'string' ? resolveTemplates(v, stepOutputs) : v
    }

    livePulse.tool('Aiden', step.tool, JSON.stringify(resolvedArgs).slice(0, 100))

    const toolResult = await executeTool(step.tool, resolvedArgs)

    const result: StepResult = {
      step:    i,
      tool:    step.tool,
      args:    resolvedArgs,
      success: toolResult.success,
      output:  toolResult.success ? toolResult.output : '',
      error:   toolResult.error,
    }

    stepOutputs.push(
      toolResult.success
        ? toolResult.output
        : (toolResult.error || 'failed'),
    )
    results.push(result)
    onStep(result)

    if (toolResult.success) {
      livePulse.done('Aiden', `${step.tool}: ${toolResult.output.slice(0, 80)}`)
    } else {
      livePulse.error('Aiden', `${step.tool}: ${toolResult.error || 'failed'}`)
    }
  }

  return results
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

  const executionSummary = results.length
    ? results.map((r, i) =>
        `Step ${i + 1} [${r.tool}]: ${r.success ? r.output.slice(0, 500) : 'FAILED — ' + r.error}`,
      ).join('\n\n')
    : ''

  const userContent = executionSummary
    ? `User asked: "${originalMessage}"\n\nReal execution results:\n${executionSummary}\n\nRespond naturally based on these real results only.`
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
