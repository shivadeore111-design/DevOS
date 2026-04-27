// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// providers/ollama.ts — Local Ollama provider

import { Provider } from './types'
import { getOllamaTimeout } from '../core/modelDiscovery'

/** Build Ollama options object from environment variables.
 *  Only includes keys that are explicitly set — Ollama uses its own defaults
 *  for anything omitted, so we never send NaN or out-of-range values. */
function getOllamaOptions(): Record<string, number> | undefined {
  const opts: Record<string, number> = {}

  const temp = parseFloat(process.env.OLLAMA_TEMPERATURE ?? '')
  if (!isNaN(temp) && temp >= 0 && temp <= 2) opts.temperature = temp

  const ctx = parseInt(process.env.OLLAMA_CONTEXT_LENGTH ?? '', 10)
  if (!isNaN(ctx) && ctx > 0) opts.num_ctx = ctx

  const gpu = parseInt(process.env.OLLAMA_NUM_GPU ?? '', 10)
  if (!isNaN(gpu) && gpu >= 0) opts.num_gpu = gpu

  const threads = parseInt(process.env.OLLAMA_NUM_THREAD ?? '', 10)
  if (!isNaN(threads) && threads > 0) opts.num_thread = threads

  const topP = parseFloat(process.env.OLLAMA_TOP_P ?? '')
  if (!isNaN(topP) && topP >= 0 && topP <= 1) opts.top_p = topP

  const repeatPenalty = parseFloat(process.env.OLLAMA_REPEAT_PENALTY ?? '')
  if (!isNaN(repeatPenalty) && repeatPenalty >= 0) opts.repeat_penalty = repeatPenalty

  return Object.keys(opts).length > 0 ? opts : undefined
}

export const ollamaProvider: Provider = {
  name: 'ollama',

  async generate(messages, model) {
    const options = getOllamaOptions()
    const res = await fetch('http://localhost:11434/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model, stream: false, messages, ...(options && { options }) }),
      signal:  AbortSignal.timeout(getOllamaTimeout(model || '')),
    })
    const data = await res.json() as any
    return data?.message?.content || ''
  },

  async generateStream(messages, model, onToken) {
    const options = getOllamaOptions()
    const res = await fetch('http://localhost:11434/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model, stream: true, messages, ...(options && { options }) }),
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
