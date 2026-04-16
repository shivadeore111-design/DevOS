// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/privateMode.ts — Phase 5: Per-turn and per-session memory opacity toggle.
//
// When private mode is active for a session, all memory writes are suppressed:
//   - memoryLayers.write()
//   - sessionMemory.addExchange()
//   - memoryExtractor.extractFromSession()
//   - conversationMemory.addAssistantMessage() (skipped at call site)
//
// Two granularities:
//   Session-level  — ALL turns in the session are private until explicitly toggled off.
//   Turn-level     — Only the NEXT turn is private; flag auto-clears after that turn.
//
// Usage (server.ts):
//   if (!isCurrentTurnPrivate(sessionId)) {
//     sessionMemory.addExchange(...)
//     memoryLayers.write(...)
//   }
//   clearTurnPrivate(sessionId)   // always call after turn completes
//
// Usage (CLI, /private command):
//   const nowPrivate = toggleSessionPrivate(sessionId)
//   console.log(nowPrivate ? '🔒 Private mode ON' : '🔓 Private mode OFF')

// ── State ─────────────────────────────────────────────────────────────────────

/** Sessions where every turn is private until explicitly cleared. */
const sessionPrivate = new Set<string>()

/** Sessions where only the NEXT single turn is private (auto-clears). */
const nextTurnPrivate = new Set<string>()

// ── Session-level API ─────────────────────────────────────────────────────────

/** Mark all future turns in `sessionId` as private. */
export function setSessionPrivate(sessionId: string): void {
  sessionPrivate.add(sessionId)
}

/** Remove session-level private flag (turns private mode off for the session). */
export function clearSessionPrivate(sessionId: string): void {
  sessionPrivate.delete(sessionId)
}

/**
 * Toggle session-level private mode.
 * @returns true when private mode is now ON, false when now OFF.
 */
export function toggleSessionPrivate(sessionId: string): boolean {
  if (sessionPrivate.has(sessionId)) {
    sessionPrivate.delete(sessionId)
    return false
  }
  sessionPrivate.add(sessionId)
  return true
}

/** True when the entire session is set to private. */
export function isSessionPrivate(sessionId: string): boolean {
  return sessionPrivate.has(sessionId)
}

// ── Turn-level API ────────────────────────────────────────────────────────────

/** Mark only the NEXT turn for `sessionId` as private. Auto-clears after that turn. */
export function markNextTurnPrivate(sessionId: string): void {
  nextTurnPrivate.add(sessionId)
}

/**
 * Returns true when the current turn should suppress all memory writes.
 * Checks both session-level and turn-level flags.
 */
export function isCurrentTurnPrivate(sessionId: string): boolean {
  return sessionPrivate.has(sessionId) || nextTurnPrivate.has(sessionId)
}

/**
 * Clear the one-turn private flag for `sessionId`.
 * Call this after every turn completes, regardless of private state —
 * it is a no-op when the flag is not set.
 */
export function clearTurnPrivate(sessionId: string): void {
  nextTurnPrivate.delete(sessionId)
}
