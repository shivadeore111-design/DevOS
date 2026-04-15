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
  | 'after_tool_call' // Fired after every tool execution (toolName, input, success)

export type HookHandler = (payload?: Record<string, any>) => Promise<void> | void

// ── Registry ───────────────────────────────────────────────────

const registry = new Map<HookEvent, HookHandler[]>()

export function registerHook(event: HookEvent, handler: HookHandler): void {
  const handlers = registry.get(event) ?? []
  handlers.push(handler)
  registry.set(event, handlers)
}

export function getHookCount(event: HookEvent): number {
  return registry.get(event)?.length ?? 0
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

// ── Plugin hook registration ───────────────────────────────────
// Validates the event is a known HookEvent before delegating to registerHook.

const VALID_HOOK_EVENTS: HookEvent[] = ['pre_compact', 'session_stop', 'after_tool_call']

export function registerExternalHook(
  event:   string,
  handler: HookHandler,
  source:  string,
): void {
  if (!VALID_HOOK_EVENTS.includes(event as HookEvent)) {
    console.warn(`[Hooks] Plugin "${source}" tried unknown event "${event}" — valid: ${VALID_HOOK_EVENTS.join(', ')}`)
    return
  }
  registerHook(event as HookEvent, handler)
  console.log(`[Hooks] Plugin "${source}" registered hook for "${event}"`)
}
