// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// personality/responseComposer.ts — Streaming response generation (AsyncGenerator)

import { wrapWithPersona } from './devosPersonality'
import { IntentType }      from './intentClassifier'
import { getChatModel }    from '../core/autoModelSelector'

const MAX_WORDS = 300

/** Build an intent-aware instruction suffix so DevOS stays on-brand */
function intentHint(intent: IntentType): string {
  switch (intent) {
    case 'build':     return 'Respond as a builder. Outline a concrete execution plan with steps. Be brief.'
    case 'deploy':    return 'Respond as a deployment engineer. Mention specific commands or tools. Be precise.'
    case 'debug':     return 'Respond as a debugger. Ask clarifying questions if needed, then propose a fix.'
    case 'status':    return 'Respond with a concise status summary. Use plain text — no markdown tables.'
    case 'configure': return 'Respond with exact config instructions. Be direct.'
    case 'explain':   return 'Explain clearly and concisely. No filler. Max 3 paragraphs.'
    default:          return 'Respond naturally. Keep it short.'
  }
}

class ResponseComposer {

  /** Compose a response as an AsyncGenerator<string> that yields words one by one */
  async *compose(
    userMessage: string,
    intent:      IntentType,
    context?:    string,    // optional recent conversation context
  ): AsyncGenerator<string> {
    const contextBlock = context
      ? `\nRecent conversation:\n${context}\n`
      : ''

    const userContent = `${contextBlock}User: ${userMessage}\n\n${intentHint(intent)}`

    const { system, user } = wrapWithPersona(userContent)

    // True streaming — yield tokens as they arrive from Ollama
    const http  = require('http') as typeof import('http')
    const model = getChatModel()

    let streamedText = ''
    let hadError     = false

    await new Promise<void>((resolve) => {
      const body = JSON.stringify({
        model,
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: user }
        ],
        stream: true,
        options: { temperature: 0.3, num_predict: 300 }
      })

      const req = http.request({
        hostname: 'localhost',
        port: 11434,
        path: '/api/chat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      }, (res) => {
        let buffer = ''
        res.on('data', (chunk: Buffer) => {
          buffer += chunk.toString()
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const data  = JSON.parse(line)
              const token = data.message?.content || ''
              if (token) streamedText += token
            } catch {}
          }
        })
        res.on('end', () => resolve())
        res.on('error', () => { hadError = true; resolve() })
      })

      req.on('error', () => { hadError = true; resolve() })
      req.setTimeout(45000, () => { req.destroy(); resolve() })
      req.write(body)
      req.end()
    })

    if (hadError || !streamedText.trim()) {
      yield 'Unable to reach Ollama. Run: ollama serve'
      return
    }

    // Yield word by word so UI shows progress
    const words = streamedText.trim().split(/\s+/).slice(0, MAX_WORDS)
    for (const word of words) {
      yield word + ' '
    }
  }

  /** Collect the full response (for non-streaming contexts) */
  async compose_full(
    userMessage: string,
    intent:      IntentType,
    context?:    string,
  ): Promise<string> {
    const chunks: string[] = []
    for await (const chunk of this.compose(userMessage, intent, context)) {
      chunks.push(chunk)
    }
    return chunks.join('').trim()
  }
}

export const responseComposer = new ResponseComposer()
