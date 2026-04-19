// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// providers/ollama.ts — Local Ollama provider

import { Provider } from './types'
import { getOllamaTimeout } from '../core/modelDiscovery'

export const ollamaProvider: Provider = {
  name: 'ollama',

  async generate(messages, model) {
    const res = await fetch('http://localhost:11434/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model, stream: false, messages }),
      signal:  AbortSignal.timeout(getOllamaTimeout(model || '')),
    })
    const data = await res.json() as any
    return data?.message?.content || ''
  },

  async generateStream(messages, model, onToken) {
    const res = await fetch('http://localhost:11434/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model, stream: true, messages }),
      signal:  AbortSignal.timeout(getOllamaTimeout(model || '')),
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
        if (!line.trim()) continue
        try {
          const parsed = JSON.parse(line) as any
          if (parsed.message?.content) onToken(parsed.message.content)
        } catch { /* skip malformed */ }
      }
    }
    // flush remaining
    if (buf.trim()) {
      try {
        const parsed = JSON.parse(buf) as any
        if (parsed.message?.content) onToken(parsed.message.content)
      } catch {}
    }
  },

  async listModels() {
    try {
      const ollamaBase = (process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434').replace(/\/$/, '')
      const res  = await fetch(`${ollamaBase}/api/tags`, { signal: AbortSignal.timeout(3000) })
      const data = await res.json() as any
      return data.models?.map((m: any) => m.name) || []
    } catch { return [] }
  },
}
