// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/hooks.ts — Lifecycle hook registry.
// Provides register/fire primitives for system lifecycle events.

// ── Types ──────────────────────────────────────────────────────

export type HookEvent =
  | 'pre_compact'    // Fired when conversation history approaches context limit
  | 'session_stop'   // Fired when a session ends (process exit or explicit stop)

export type HookHandler = (payload?: Record<string, any>) => Promise<void> | void

// ── Registry ───────────────────────────────────────────────────

const registry = new Map<HookEvent, HookHandler[]>()

export function registerHook(event: HookEvent, handler: HookHandler): void {
  const handlers = registry.get(event) ?? []
  handlers.push(handler)
  registry.set(event, handlers)
}

export async function fireHook(event: HookEvent, payload?: Record<string, any>): Promise<void> {
  const handlers = registry.get(event)
  if (!handlers || handlers.length === 0) return

  console.log(`[Hooks] Firing "${event}" (${handlers.length} handler(s))`)

  for (const handler of handlers) {
    try {
      await handler(payload)
    } catch (e: any) {
      console.error(`[Hooks] Handler error for "${event}": ${e.message}`)
    }
  }
}
