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

import fs   from 'fs'
import path from 'path'
import { conversationMemory } from './conversationMemory'
import { getActiveGoalsSummary } from './goalTracker'
import { sessionMemory }         from './sessionMemory'

const USER_MD = path.join(process.env.AIDEN_USER_DATA || process.cwd(), 'workspace', 'USER.md')

function readUserName(): string | null {
  try {
    if (!fs.existsSync(USER_MD)) return null
    const content = fs.readFileSync(USER_MD, 'utf-8')
    const match   = content.match(/^Name:\s*(.+)/m)
    if (!match) return null
    const name = match[1].trim()
    if (!name || name.toLowerCase() === 'user') return null
    return name
  } catch { return null }
}

function extractLastSessionSummary(raw: string): string | null {
  if (!raw) return null
  const titleMatch = raw.match(/# Session Title\s*\n_?([^\n_#]+)/)
  const stateMatch = raw.match(/# Current State\s*\n_?([\s\S]*?)(?=\n#|$)/)
  const parts: string[] = []
  if (titleMatch?.[1]?.trim()) parts.push(`Last session: ${titleMatch[1].trim()}`)
  if (stateMatch?.[1]?.trim()) {
    const state = stateMatch[1].replace(/^_|_$/g, '').trim().slice(0, 120)
    if (state) parts.push(`State: ${state}`)
  }
  return parts.length > 0 ? parts.join(' — ') : null
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Build a compact preamble from live memory facts.
 * Returns null when there is nothing meaningful to surface
 * (e.g. a brand-new session with no prior history).
 */
export async function buildGreetingPreamble(sessionId?: string): Promise<string | null> {
  try {
    const facts = conversationMemory.getFacts()
    const goals = getActiveGoalsSummary()

    const parts: string[] = []

    // User name from USER.md
    const name = readUserName()
    if (name) parts.push(`User name: ${name}`)

    // Last session context
    if (sessionId) {
      const lastCtx       = sessionMemory.getLastContext(sessionId)
      const sessionSummary = extractLastSessionSummary(lastCtx)
      if (sessionSummary) parts.push(sessionSummary)
    }

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
