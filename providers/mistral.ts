// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// providers/mistral.ts — Mistral AI cloud provider (OpenAI-compatible)

import { Provider, ToolCall } from './types'

const MISTRAL_CHAT_COMPLETIONS_URL = 'https://api.mistral.ai/v1/chat/completions'

function extractContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''

  return content
    .map(part => {
      if (typeof part === 'string') return part
      if (part && typeof part === 'object' && 'text' in part) {
        return typeof (part as any).text === 'string' ? (part as any).text : ''
      }
      return ''
    })
    .join('')
}

function parseToolArguments(args: unknown): Record<string, unknown> {
  if (!args) return {}
  if (typeof args === 'object') return args as Record<string, unknown>
  if (typeof args !== 'string') return {}
  try {
    return JSON.parse(args) as Record<string, unknown>
  } catch {
    return {}
  }
}

export function createMistralProvider(apiKey: string): Provider {
  const headers = (): Record<string, string> => ({
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${apiKey}`,
  })

  return {
    name: 'mistral',

    async generateWithTools(messages, model, tools) {
      const res = await fetch(MISTRAL_CHAT_COMPLETIONS_URL, {
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

      const message = data.choices?.[0]?.message
      const toolCalls: ToolCall[] = (message?.tool_calls || []).map((tc: any) => ({
        name:      tc.function.name,
        arguments: parseToolArguments(tc.function.arguments),
      }))

      return { content: extractContent(message?.content), toolCalls }
    },

    async generate(messages, model) {
      const res = await fetch(MISTRAL_CHAT_COMPLETIONS_URL, {
        method:  'POST',
        headers: headers(),
        body:    JSON.stringify({ model, messages, stream: false }),
      })
      if (!res.ok) {
        const err = await res.text()
        throw new Error(`${res.status}: ${err}`)
      }
      const data = await res.json() as any
      return extractContent(data?.choices?.[0]?.message?.content)
    },

    async generateStream(messages, model, onToken) {
      const res = await fetch(MISTRAL_CHAT_COMPLETIONS_URL, {
        method:  'POST',
        headers: headers(),
        body:    JSON.stringify({ model, messages, stream: true }),
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
            const parsed  = JSON.parse(raw) as any
            const content = parsed?.choices?.[0]?.delta?.content
            const token   = extractContent(content)
            if (token) onToken(token)
          } catch { /* skip malformed SSE chunks */ }
        }
      }
    },
  }
}
