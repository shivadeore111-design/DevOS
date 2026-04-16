// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/memoryPreamble.ts — Phase 4: Greeting fast-path memory surface.
//
// When the user sends a greeting ("hi", "good morning", etc.) the semantic
// memory recall in streamChat produces no matches because there is no
// substantive query to match against.  This module builds a compact
// "what I know right now" preamble from the live conversation facts so
// Aiden can open with context-aware continuity even on the very first
// sentence of a new session.
//
// Usage:
//   const preamble = await buildGreetingPreamble()
//   // => "GREETING CONTEXT:\nRecent files: report.py\nActive goals: ..." | null

import { conversationMemory } from './conversationMemory'
import { getActiveGoalsSummary } from './goalTracker'

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Build a compact preamble from live memory facts.
 * Returns null when there is nothing meaningful to surface
 * (e.g. a brand-new session with no prior history).
 */
export async function buildGreetingPreamble(): Promise<string | null> {
  try {
    const facts = conversationMemory.getFacts()
    const goals = getActiveGoalsSummary()

    const parts: string[] = []

    if (facts.lastFilesCreated.length > 0) {
      parts.push(`Recent files: ${facts.lastFilesCreated.slice(-3).join(', ')}`)
    }
    if (facts.lastSearchQueries.length > 0) {
      parts.push(`Recent searches: ${facts.lastSearchQueries.slice(-2).join(', ')}`)
    }
    if (facts.mentionedEntities.length > 0) {
      parts.push(`Recent topics: ${facts.mentionedEntities.slice(-6).join(', ')}`)
    }
    if (facts.preferredPaths.length > 0) {
      parts.push(`Frequent paths: ${facts.preferredPaths.slice(-2).join(', ')}`)
    }
    if (goals) {
      parts.push(`Active goals: ${goals}`)
    }

    if (parts.length === 0) return null

    return `GREETING CONTEXT (reference naturally if relevant — do not recite mechanically):\n${parts.join('\n')}`
  } catch {
    return null
  }
}
