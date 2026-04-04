// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/aidenIdentity.ts — Aiden's evolving identity system.
// Derives level (1-5), title, skillsLearned, streakDays, and
// topStrength from AuditTrail task counts. Persists to
// workspace/identity.json. Broadcasts identity_update via SSE.
//
// Called: on server start + after each completed chat/tool action.

import fs   from 'fs'
import path from 'path'
import { auditTrail } from './auditTrail'

// ── Paths ──────────────────────────────────────────────────────

const IDENTITY_PATH = path.join(process.cwd(), 'workspace', 'identity.json')

// ── Types ──────────────────────────────────────────────────────

export interface AidenIdentity {
  level:         number       // 1-5
  title:         string       // e.g. "Apprentice", "Operator", "Specialist", "Mastermind", "Architect"
  xp:            number       // total successful tasks
  nextLevelXp:   number       // XP needed to reach next level
  skillsLearned: number       // unique tools used successfully
  streakDays:    number       // consecutive days with ≥1 successful action
  topStrength:   string       // most-used tool name
  lastUpdated:   string       // ISO date
}

// ── Level thresholds ───────────────────────────────────────────

const LEVELS = [
  { level: 1, title: 'Apprentice',  minXp: 0   },
  { level: 2, title: 'Operator',    minXp: 25  },
  { level: 3, title: 'Specialist',  minXp: 100 },
  { level: 4, title: 'Mastermind',  minXp: 300 },
  { level: 5, title: 'Architect',   minXp: 750 },
] as const

function levelFromXp(xp: number): { level: number; title: string; nextLevelXp: number } {
  let current: { level: number; title: string; minXp: number } = LEVELS[0]
  for (const l of LEVELS) {
    if (xp >= l.minXp) current = l
  }
  const idx  = LEVELS.findIndex(l => l.level === current.level)
  const next = LEVELS[idx + 1]
  return {
    level:       current.level,
    title:       current.title,
    nextLevelXp: next ? next.minXp : current.minXp,
  }
}

// ── Streak calculation ─────────────────────────────────────────
// Reads audit log and counts consecutive days with ≥1 success
// working backwards from today.

function computeStreak(entries: Array<{ ts: number; success: boolean }>): number {
  if (entries.length === 0) return 0

  // Collect unique day strings that had at least one success
  const successDays = new Set<string>()
  for (const e of entries) {
    if (e.success) {
      successDays.add(new Date(e.ts).toDateString())
    }
  }

  let streak = 0
  const today = new Date()
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    if (successDays.has(d.toDateString())) {
      streak++
    } else {
      break
    }
  }
  return streak
}

// ── Load full audit history ────────────────────────────────────

function loadAllAuditEntries(): Array<{ ts: number; success: boolean; tool?: string }> {
  const auditDir  = path.join(process.cwd(), 'workspace', 'audit')
  const auditFile = path.join(auditDir, 'audit.jsonl')
  try {
    if (!fs.existsSync(auditFile)) return []
    return fs.readFileSync(auditFile, 'utf-8')
      .trim().split('\n').filter(Boolean)
      .map(l => { try { return JSON.parse(l) } catch { return null } })
      .filter(Boolean)
  } catch {
    return []
  }
}

// ── Compute identity from audit data ──────────────────────────

export function computeIdentity(): AidenIdentity {
  const entries = loadAllAuditEntries()

  // XP = number of successful non-system actions
  const successEntries = entries.filter(e => e.success)
  const xp             = successEntries.length

  // Top strength = most-used tool overall
  const toolCounts: Record<string, number> = {}
  for (const e of entries) {
    if (e.tool) toolCounts[e.tool] = (toolCounts[e.tool] || 0) + 1
  }
  const topStrength = Object.entries(toolCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'none'

  // Unique tools used successfully
  const uniqueTools = new Set(successEntries.filter(e => e.tool).map(e => e.tool))
  const skillsLearned = uniqueTools.size

  // Streak
  const streakDays = computeStreak(entries)

  // Level
  const { level, title, nextLevelXp } = levelFromXp(xp)

  return {
    level,
    title,
    xp,
    nextLevelXp,
    skillsLearned,
    streakDays,
    topStrength,
    lastUpdated: new Date().toISOString().slice(0, 10),
  }
}

// ── Persist identity ───────────────────────────────────────────

export function saveIdentity(identity: AidenIdentity): void {
  try {
    fs.mkdirSync(path.dirname(IDENTITY_PATH), { recursive: true })
    fs.writeFileSync(IDENTITY_PATH, JSON.stringify(identity, null, 2))
  } catch (e: any) {
    console.warn('[AidenIdentity] Failed to save:', e.message)
  }
}

export function loadIdentity(): AidenIdentity | null {
  try {
    if (!fs.existsSync(IDENTITY_PATH)) return null
    return JSON.parse(fs.readFileSync(IDENTITY_PATH, 'utf-8')) as AidenIdentity
  } catch {
    return null
  }
}

// ── AidenIdentityManager class ─────────────────────────────────

export class AidenIdentityManager {
  private listeners: Array<(identity: AidenIdentity) => void> = []

  // ── Refresh identity from audit data ──────────────────
  refresh(): AidenIdentity {
    const identity = computeIdentity()
    saveIdentity(identity)
    this.notifyListeners(identity)
    return identity
  }

  // ── Get current identity (from cache or compute) ───────
  get(): AidenIdentity {
    const cached = loadIdentity()
    if (cached && cached.lastUpdated === new Date().toISOString().slice(0, 10)) {
      return cached
    }
    return this.refresh()
  }

  // ── Subscribe to identity updates (used by SSE broadcast) ─
  onChange(listener: (identity: AidenIdentity) => void): () => void {
    this.listeners.push(listener)
    return () => { this.listeners = this.listeners.filter(l => l !== listener) }
  }

  // ── Format identity for system prompt injection ─────────
  formatForPrompt(): string {
    const id = this.get()
    return `Aiden Identity: Level ${id.level} ${id.title} | XP: ${id.xp} | Skills: ${id.skillsLearned} | Streak: ${id.streakDays}d | Top strength: ${id.topStrength}`
  }

  private notifyListeners(identity: AidenIdentity): void {
    for (const l of this.listeners) {
      try { l(identity) } catch {}
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────
export const aidenIdentity = new AidenIdentityManager()
