// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// providers/nvidia.ts — NVIDIA NIM provider (OpenAI-compatible)

import { Provider } from './types'

export function createNvidiaProvider(apiKey: string): Provider {
  return {
    name: 'nvidia',

    async generate(messages, model) {
      const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model: model || 'meta/llama-3.3-70b-instruct', messages, stream: false }),
      })
      const data = await res.json() as any
      return data?.choices?.[0]?.message?.content || ''
    },

    async generateStream(messages, model, onToken) {
      const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model: model || 'meta/llama-3.3-70b-instruct', messages, stream: true }),
      })
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
    },
  }
}
