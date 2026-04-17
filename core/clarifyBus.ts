// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
//
// core/clarifyBus.ts — Global event bus for mid-task clarification questions.
//
// When the `clarify` tool fires:
//   1. It posts a ClarifyRequest to this bus.
//   2. The CLI (or any registered handler) picks it up, shows the question,
//      collects an answer, and resolves the pending promise.
//   3. If no handler is registered, the bus auto-resolves with the first option
//      (or free-text fallback) after a short timeout so headless runs never hang.

import { EventEmitter } from 'events'

export interface ClarifyRequest {
  id:            string
  question:      string
  options?:      string[]
  allowFreeText: boolean
}

export type ClarifyAnswer = string

const bus = new EventEmitter()
bus.setMaxListeners(20)

// Pending requests keyed by id
const pending = new Map<string, (answer: ClarifyAnswer) => void>()

let handlerRegistered = false

/**
 * Called by the CLI (or any TUI layer) to claim clarify questions.
 * The handler receives a ClarifyRequest and must call `answer(id, text)`
 * when the user responds.
 */
export function registerClarifyHandler(
  handler: (req: ClarifyRequest) => void,
): void {
  bus.on('request', handler)
  handlerRegistered = true
}

/**
 * Provide the user's answer to a pending clarify request.
 * Called by the CLI handler after the user types their response.
 */
export function answer(id: string, text: ClarifyAnswer): void {
  const resolve = pending.get(id)
  if (resolve) {
    pending.delete(id)
    resolve(text)
  }
}

let seq = 1

/**
 * Ask a clarification question and wait for the answer.
 * Resolves immediately with the first option (or empty string) if no
 * TUI handler is registered (headless / API mode).
 */
export async function ask(
  question:      string,
  options?:      string[],
  allowFreeText: boolean = true,
): Promise<ClarifyAnswer> {
  const id = `clarify_${seq++}`

  const promise = new Promise<ClarifyAnswer>(resolve => {
    pending.set(id, resolve)

    if (!handlerRegistered) {
      // Headless fallback: use first option, or acknowledge text
      const fallback = options?.[0] ?? 'yes'
      pending.delete(id)
      resolve(fallback)
      return
    }

    // Emit to registered TUI handler
    bus.emit('request', { id, question, options, allowFreeText } satisfies ClarifyRequest)

    // Safety timeout — never hang the agent for more than 5 minutes
    const timer = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        resolve(options?.[0] ?? '')
      }
    }, 5 * 60 * 1000)
    if (typeof (timer as any).unref === 'function') (timer as any).unref()
  })

  return promise
}
