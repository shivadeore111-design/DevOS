// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/callbackSystem.ts — Typed callback system for all DevOS platforms.
//
// Provides a publish/subscribe registry for agent lifecycle events.
// Every platform (SSE dashboard, Telegram, TUI, plugins) can subscribe
// to the same typed event stream.
//
// Design principles:
//  • Additive layer — existing SSE send() calls are unchanged.
//  • Per-handler error isolation — one bad handler never blocks others.
//  • Synchronous unsubscription — on()/onAny() return an () => void.
//  • Fire-and-forget — emit() awaits all handlers but swallows errors.

// ── Event catalogue ───────────────────────────────────────────────────────────

export type CallbackEvent =
  | 'session_start'    // SSE connection opened; data: { message }
  | 'session_end'      // SSE connection closed; data: {}
  | 'memory_read'      // Memory layer consulted; data: { message }
  | 'thinking_start'   // LLM thinking/reasoning underway; data: { stage, message }
  | 'planning_start'   // Planner LLM invoked; data: { message }
  | 'planning_done'    // Plan produced; data: { steps, requiresExecution }
  | 'tool_start'       // Single tool about to run; data: { tool, input, message }
  | 'tool_end'         // Single tool finished; data: { tool, success, output }
  | 'activity'         // Generic activity update; data: { icon, agent, message, style }
  | 'token'            // Streamed response token; data: { token, provider }
  | 'stream_done'      // Full response complete; data: { provider }
  | 'error'            // Non-fatal error surfaced; data: { message, code? }
  | 'budget_update'    // Token/cost budget snapshot; data: { budget }
  | 'async_complete'   // Background async task finished; data: { taskId, status, elapsed, preview }

// ── Payload ───────────────────────────────────────────────────────────────────

export interface CallbackPayload {
  /** The event type that fired. */
  event:     CallbackEvent
  /** Unix milliseconds when emit() was called. */
  timestamp: number
  /** Identifies the agent session this event belongs to. */
  sessionId: string
  /** Event-specific data. Shape is described per CallbackEvent above. */
  data:      Record<string, any>
}

export type CallbackHandler = (payload: CallbackPayload) => Promise<void> | void

// ── Registry ──────────────────────────────────────────────────────────────────

class CallbackRegistry {
  private handlers    = new Map<CallbackEvent, CallbackHandler[]>()
  private anyHandlers: CallbackHandler[] = []

  /**
   * Subscribe to a specific event.
   * @returns An unsubscribe function — call it to remove this handler.
   */
  on(event: CallbackEvent, handler: CallbackHandler): () => void {
    const list = this.handlers.get(event) ?? []
    list.push(handler)
    this.handlers.set(event, list)
    return () => {
      const current = this.handlers.get(event) ?? []
      this.handlers.set(event, current.filter(h => h !== handler))
    }
  }

  /**
   * Subscribe to every event regardless of type.
   * @returns An unsubscribe function.
   */
  onAny(handler: CallbackHandler): () => void {
    this.anyHandlers.push(handler)
    return () => {
      this.anyHandlers = this.anyHandlers.filter(h => h !== handler)
    }
  }

  /**
   * Emit an event to all matching subscribers.
   * Errors thrown by individual handlers are caught and logged — they
   * never propagate back to the emitter.
   */
  async emit(
    event:     CallbackEvent,
    sessionId: string,
    data:      Record<string, any> = {},
  ): Promise<void> {
    const payload: CallbackPayload = {
      event,
      timestamp: Date.now(),
      sessionId,
      data,
    }

    const specific = this.handlers.get(event) ?? []
    const all      = [...specific, ...this.anyHandlers]
    if (all.length === 0) return

    for (const handler of all) {
      try {
        await handler(payload)
      } catch (e: any) {
        console.error(`[Callbacks] Handler error for "${event}": ${e.message}`)
      }
    }
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const callbacks = new CallbackRegistry()
