// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// providers/custom.ts — Universal custom OpenAI-compatible provider factory
// Any endpoint that speaks POST <url> with Bearer auth and OpenAI chat-completions
// schema works here: Together AI, Fireworks, DeepInfra, Perplexity, LM Studio,
// local Ollama (/api/chat/completions), vLLM, TabbyAPI, etc.

import { Provider, ToolDefinition, ToolCall } from './types'

export function createCustomProvider(
  baseUrl: string,
  apiKey:  string,
  name:    string,
): Provider {
  const headers = (): Record<string, string> => ({
    'Content-Type':  'application/json',
    ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
  })

  return {
    name,

    async generateWithTools(
      messages: { role: string; content: string }[],
      model:    string,
      tools:    ToolDefinition[],
    ): Promise<{ content: string; toolCalls: ToolCall[] }> {
      const res = await fetch(baseUrl, {
        method:  'POST',
        headers: headers(),
        body: JSON.stringify({
          model,
          messages,
          tools:       tools.map(t => ({ type: 'function', function: t })),
          tool_choice: 'auto',
          stream:      false,
        }),
      })
      const data = await res.json() as any
      if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data)}`)
      const message    = data.choices?.[0]?.message
      const toolCalls: ToolCall[] = (message?.tool_calls || []).map((tc: any) => ({
        name:      tc.function.name,
        arguments: JSON.parse(tc.function.arguments || '{}'),
      }))
      return { content: message?.content || '', toolCalls }
    },

    async generate(
      messages: { role: string; content: string }[],
      model:    string,
    ): Promise<string> {
      const res = await fetch(baseUrl, {
        method:  'POST',
        headers: headers(),
        body: JSON.stringify({ model, messages, stream: false }),
      })
      if (!res.ok) {
        const err = await res.text()
        throw new Error(`${res.status}: ${err}`)
      }
      const data = await res.json() as any
      return data?.choices?.[0]?.message?.content || ''
    },

    async generateStream(
      messages: { role: string; content: string }[],
      model:    string,
      onToken:  (t: string) => void,
    ): Promise<void> {
      const res = await fetch(baseUrl, {
        method:  'POST',
        headers: headers(),
        body: JSON.stringify({ model, messages, stream: true }),
      })
      if (!res.ok) {
        const err = await res.text()
        throw new Error(`${res.status}: ${err}`)
      }
      if (!res.body) return

      const reader  = (res.body as any).getReader()
      const decoder = new TextDecoder()
      let   buf     = ''

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
          } catch { /* skip malformed SSE chunks */ }
        }
      }
    },
  }
}
