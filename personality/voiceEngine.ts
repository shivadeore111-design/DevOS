// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// personality/voiceEngine.ts — Streaming LLM response generator
//
// Uses wrapWithPersona() so the system prompt is always static (KV-cache safe).
// Dynamic context goes in the user turn.
// Streams via mistral-nemo:12b (falls back to getChatModel() if needed).
// Returns AsyncGenerator<string> — yields tokens as they arrive.

import { wrapWithPersona }  from './devosPersonality'
import { IntentType }        from './intentEngine'
import { getChatModel }      from '../core/autoModelSelector'
import { skillLoader }       from '../skills/skillLoader'

const CHAT_MODEL  = 'mistral-nemo:12b'
const MAX_TOKENS  = 350

// ── Intent-aware instruction hints (stay on-brand) ────────────────────────

function intentHint(intent: IntentType): string {
  switch (intent) {
    case 'run_goal':       return 'You are launching a goal. Confirm briefly — one sentence max.'
    case 'ask_question':   return 'Answer clearly and concisely. No filler. Max 3 short paragraphs.'
    case 'status_check':   return 'Give a concise status summary. Plain text, no markdown tables.'
    case 'system_command': return 'Confirm the command you received and what will happen next.'
    case 'feedback':       return 'Acknowledge the feedback directly. Offer to redo or adjust.'
    case 'chitchat':       return 'Respond naturally and briefly. One or two sentences.'
    default:               return 'Respond naturally. Be direct.'
  }
}

// ── VoiceEngine class ──────────────────────────────────────────────────────

class VoiceEngine {

  /**
   * Stream a response as tokens.
   * Context goes in the user turn — never in the system prompt.
   */
  async *stream(
    userMessage: string,
    intent:      IntentType,
    context?:    string,
  ): AsyncGenerator<string> {
    // Build user content: context + message + intent hint + skills block
    const skillsBlock    = skillLoader.buildPromptBlock()
    const intentSuffix   = `\n\n${intentHint(intent)}`
    const skillsSuffix   = skillsBlock ? `\n\n${skillsBlock}` : ''
    const userContent    = `${userMessage}${intentSuffix}${skillsSuffix}`

    const { system, user } = wrapWithPersona(userContent, context)

    const model = CHAT_MODEL || getChatModel()

    let streamedText = ''
    let hadError     = false

    // ── Ollama streaming HTTP request ────────────────────────────────────
    const http = require('http') as typeof import('http')

    await new Promise<void>((resolve) => {
      const body = JSON.stringify({
        model,
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: user },
        ],
        stream:  true,
        options: { temperature: 0.35, num_predict: MAX_TOKENS },
      })

      const req = http.request(
        {
          hostname: 'localhost',
          port:     11434,
          path:     '/api/chat',
          method:   'POST',
          headers:  {
            'Content-Type':   'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
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
              } catch { /* ignore partial JSON */ }
            }
          })
          res.on('end',   () => resolve())
          res.on('error', () => { hadError = true; resolve() })
        },
      )

      req.on('error', () => { hadError = true; resolve() })
      req.setTimeout(45_000, () => { req.destroy(); resolve() })
      req.write(body)
      req.end()
    })

    if (hadError || !streamedText.trim()) {
      yield 'Unable to reach Ollama. Run: ollama serve'
      return
    }

    // Yield word-by-word so the UI shows streaming progress
    const words = streamedText.trim().split(/\s+/).slice(0, MAX_TOKENS)
    for (const word of words) {
      yield word + ' '
    }
  }

  /** Collect full response (non-streaming contexts, e.g. CLI) */
  async streamFull(
    userMessage: string,
    intent:      IntentType,
    context?:    string,
  ): Promise<string> {
    const chunks: string[] = []
    for await (const chunk of this.stream(userMessage, intent, context)) {
      chunks.push(chunk)
    }
    return chunks.join('').trim()
  }
}

export const voiceEngine = new VoiceEngine()
