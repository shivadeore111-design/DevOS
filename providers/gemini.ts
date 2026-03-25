// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// providers/gemini.ts — Google Gemini provider

import { Provider } from './types'

export function createGeminiProvider(apiKey: string): Provider {
  return {
    name: 'gemini',

    async generate(messages, model) {
      const geminiModel = model || 'gemini-1.5-flash'
      const contents    = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role:  m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }))
      const system = messages.find(m => m.role === 'system')?.content

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          }),
        },
      )
      if (!res.ok) {
        const err = await res.text()
        throw new Error(`${res.status}: ${err}`)
      }
      const data = await res.json() as any
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    },

    async generateStream(messages, model, onToken) {
      // Gemini streaming — generate full response and emit as single token
      const result = await this.generate(messages, model)
      onToken(result)
    },
  }
}
