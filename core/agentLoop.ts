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

const PLANNER_SYSTEM = `You are a planning agent for DevOS, an AI OS running on Windows.
Your ONLY job is to output a JSON execution plan — no markdown, no explanation, ONLY valid JSON.

AVAILABLE TOOLS:

Basic tools:
- web_search:         { "query": "..." }                        — search web, fetches real page content
- fetch_page:         { "url": "https://..." }                  — fetch and clean a specific URL
- open_browser:       { "url": "https://..." }                  — open URL in Chromium
- browser_extract:    {}                                        — extract text from current browser page
- browser_click:      { "selector": "..." }                     — click element on current page
- browser_type:       { "selector": "...", "text": "..." }      — type into input on current page
- browser_screenshot: {}                                        — screenshot current page
- file_write:         { "path": "C:\\\\Users\\\\...\\\\file.txt", "content": "..." }
- file_read:          { "path": "C:\\\\Users\\\\...\\\\file.txt" }
- file_list:          { "path": "C:\\\\Users\\\\..." }
- shell_exec:         { "command": "powershell command" }
- run_python:         { "script": "python code" }
- run_node:           { "script": "js code" }
- system_info:        {}
- notify:             { "message": "..." }

Specialist tools (use these for complex tasks):
- deep_research:      { "topic": "..." }  — 3-pass research with entity extraction and comparison. ALWAYS use for any research, analysis, or comparison task
- run_agent:          { "agent": "engineer|security|data_analyst|designer|researcher|debugger", "task": "..." } — activate specialist agent persona

ROUTING RULES:
- Research / analysis / comparison → ALWAYS use deep_research (not web_search)
- Simple factual lookup (weather, definitions, current info) → web_search
- Create / build / code task → shell_exec or run_agent with agent="engineer"
- Questions / greetings / explanation → requires_execution: false
- Use {{step_N_output}} (0-indexed) to pass a step's output to the next step as input
- Desktop path: C:\\\\Users\\\\shiva\\\\Desktop\\\\
- Max 4 steps

Output format (ONLY this JSON, nothing else):
{
  "goal": "original user goal",
  "requires_execution": true,
  "steps": [
    { "tool": "deep_research", "args": { "topic": "best AI coding assistants 2025" }, "description": "3-pass research with entity comparison" },
    { "tool": "file_write", "args": { "path": "C:\\\\Users\\\\shiva\\\\Desktop\\\\research.md", "content": "{{step_0_output}}" }, "description": "Save report to Desktop" }
  ]
}

OR for chat/questions:
{
  "goal": "original user goal",
  "requires_execution": false,
  "steps": [],
  "direct_response": "your answer here"
}`

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

    const parsed = JSON.parse(jsonMatch[0]) as any

    // Normalize: handle both "steps"/"args" and "plan"/"input" field names
    const stepArray: any[] = Array.isArray(parsed.steps)
      ? parsed.steps
      : Array.isArray(parsed.plan) ? parsed.plan : []

    const plan: AgentPlan = {
      requires_execution: typeof parsed.requires_execution === 'boolean' ? parsed.requires_execution : false,
      direct_response:    parsed.direct_response,
      steps: stepArray.map((s: any) => ({
        tool:        s.tool        || '',
        args:        s.args        || s.input || {},
        description: s.description || '',
      })),
    }

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
