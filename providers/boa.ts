// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// providers/boa.ts — BOA multi-cloud API gateway (OpenAI-compatible)

import { Provider, ToolDefinition, ToolCall } from './types'

const BOA_BASE = 'https://api.bayofassets.com/v1/chat/completions'

export function createBOAProvider(apiKey: string): Provider {
  return {
    name: 'boa',

    async generateWithTools(messages, model, tools) {
      const res = await fetch(BOA_BASE, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
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

    async generate(messages, model) {
      const res = await fetch(BOA_BASE, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, messages, stream: false }),
      })
      const data = await res.json() as any
      return data?.choices?.[0]?.message?.content || ''
    },

    async generateStream(messages, model, onToken) {
      try {
        const res = await fetch(BOA_BASE, {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ model, messages, stream: true }),
        })
        if (!res.ok) {
          const err = await res.text()
          throw new Error(`${res.status}: ${err}`)
        }
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
      } catch (err) {
        throw err
      }
    },
  }
}
