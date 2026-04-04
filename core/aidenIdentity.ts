// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/aidenIdentity.ts — Aiden's persistent identity and level system.
// Computed from AuditTrail (XP) + SkillTeacher (skills learned) + sessions (streak).
// Persisted to workspace/identity.json. Emits identity_update via eventBus.

import fs   from 'fs'
import path from 'path'
import { auditTrail }  from './auditTrail'
import { skillTeacher } from './skillTeacher'
import { eventBus }    from './eventBus'

// ── Types ─────────────────────────────────────────────────────

export interface AidenIdentity {
  level:         number   // 1–5
  title:         string   // Apprentice | Assistant | Specialist | Expert | Architect
  xp:            number   // total successful tasks from AuditTrail
  skillsLearned: number   // from skillTeacher
  streakDays:    number   // consecutive days with sessions
  topStrength:   string   // Research | Code | Automation | Analysis
  xpToNextLevel: number   // XP needed to reach next level
  xpProgress:    number   // 0.0–1.0 progress toward next level
  lastUpdated:   string   // ISO date
}

// ── Constants ─────────────────────────────────────────────────

const IDENTITY_PATH = path.join(process.cwd(), 'workspace', 'identity.json')
const AUDIT_PATH    = path.join(process.cwd(), 'workspace', 'audit', 'audit.jsonl')
const SESSIONS_DIR  = path.join(process.cwd(), 'workspace', 'sessions')

const LEVEL_THRESHOLDS = [0, 10, 50, 200, 500]   // XP needed for levels 1–5
const TITLES           = ['Apprentice', 'Assistant', 'Specialist', 'Expert', 'Architect']

// ── Level helpers ─────────────────────────────────────────────

function computeLevel(xp: number): number {
  if (xp < 10)  return 1
  if (xp < 50)  return 2
  if (xp < 200) return 3
  if (xp < 500) return 4
  return 5
}

function computeProgress(xp: number, level: number): { xpToNext: number; progress: number } {
  if (level >= 5) return { xpToNext: 0, progress: 1 }
  const floor = LEVEL_THRESHOLDS[level - 1]
  const ceil  = LEVEL_THRESHOLDS[level]
  const span  = ceil - floor
  const done  = xp - floor
  return {
    xpToNext: Math.max(0, ceil - xp),
    progress: Math.min(1, Math.max(0, done / span)),
  }
}

// ── XP: count successful tasks from audit trail ───────────────

function computeXP(): number {
  try {
    if (!fs.existsSync(AUDIT_PATH)) return 0
    return fs.readFileSync(AUDIT_PATH, 'utf-8')
      .trim().split('\n').filter(Boolean)
      .map(l => { try { return JSON.parse(l) } catch { return null } })
      .filter((e): e is { success: boolean } => e !== null && e.success === true)
      .length
  } catch {
    return 0
  }
}

// ── Top strength: most frequent tool category ─────────────────

function computeTopStrength(): string {
  try {
    if (!fs.existsSync(AUDIT_PATH)) return 'Research'

    const entries = fs.readFileSync(AUDIT_PATH, 'utf-8')
      .trim().split('\n').filter(Boolean)
      .map(l => { try { return JSON.parse(l) } catch { return null } })
      .filter(Boolean)

    const counts: Record<string, number> = {
      Research:   0,
      Code:       0,
      Automation: 0,
      Analysis:   0,
    }

    for (const e of entries) {
      const tool = (e.tool || '') as string
      if (/web_search|deep_research|fetch/.test(tool))           counts.Research++
      else if (/file_write|run_python|run_node|shell/.test(tool)) counts.Code++
      else if (/mouse|keyboard|browser|vision/.test(tool))        counts.Automation++
      else if (/system_info|get_stocks|get_market/.test(tool))    counts.Analysis++
    }

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])[0][0] as string
  } catch {
    return 'Research'
  }
}

// ── Streak: consecutive days with session files ───────────────

function computeStreakDays(): number {
  try {
    if (!fs.existsSync(SESSIONS_DIR)) return 0

    const sessionDates = new Set<string>()
    for (const f of fs.readdirSync(SESSIONS_DIR)) {
      if (!f.endsWith('.md')) continue
      try {
        const mtime = fs.statSync(path.join(SESSIONS_DIR, f)).mtime
        sessionDates.add(mtime.toISOString().slice(0, 10))
      } catch {}
    }

    if (sessionDates.size === 0) return 0

    // Also count today's audit entries
    const auditDates = new Set<string>()
    if (fs.existsSync(AUDIT_PATH)) {
      for (const line of fs.readFileSync(AUDIT_PATH, 'utf-8').trim().split('\n').filter(Boolean)) {
        try {
          const e = JSON.parse(line)
          if (e.ts) auditDates.add(new Date(e.ts).toISOString().slice(0, 10))
        } catch {}
      }
    }

    const allDates = new Set([...sessionDates, ...auditDates])
    const sorted   = Array.from(allDates).sort().reverse()

    let streak = 0
    let cursor = new Date()
    cursor.setHours(0, 0, 0, 0)

    for (const d of sorted) {
      const dateStr = cursor.toISOString().slice(0, 10)
      if (d === dateStr) {
        streak++
        cursor.setDate(cursor.getDate() - 1)
      } else {
        break
      }
    }

    return streak
  } catch {
    return 0
  }
}

// ── Main compute ──────────────────────────────────────────────

export function computeIdentity(): AidenIdentity {
  const xp     = computeXP()
  const level  = computeLevel(xp)
  const title  = TITLES[level - 1]
  const { xpToNext, progress } = computeProgress(xp, level)

  const stats        = skillTeacher.getStats()
  const skillsLearned = stats.learned + stats.approved

  const identity: AidenIdentity = {
    level,
    title,
    xp,
    skillsLearned,
    streakDays:   computeStreakDays(),
    topStrength:  computeTopStrength(),
    xpToNextLevel: xpToNext,
    xpProgress:    progress,
    lastUpdated:   new Date().toISOString(),
  }

  return identity
}

// ── Persist & emit ─────────────────────────────────────────────

export function refreshIdentity(): AidenIdentity {
  const identity = computeIdentity()

  try {
    fs.mkdirSync(path.dirname(IDENTITY_PATH), { recursive: true })
    fs.writeFileSync(IDENTITY_PATH, JSON.stringify(identity, null, 2))
  } catch (e: any) {
    console.error('[AidenIdentity] Write failed:', e.message)
  }

  try {
    eventBus.emit('identity_update', identity)
  } catch {}

  return identity
}

// ── Load persisted (fast, no compute) ─────────────────────────

export function loadIdentity(): AidenIdentity | null {
  try {
    if (!fs.existsSync(IDENTITY_PATH)) return null
    return JSON.parse(fs.readFileSync(IDENTITY_PATH, 'utf-8')) as AidenIdentity
  } catch {
    return null
  }
}

// ── getIdentity: load cached or compute fresh ─────────────────

export function getIdentity(): AidenIdentity {
  return loadIdentity() ?? refreshIdentity()
}

// ── Singleton initialisation on import ────────────────────────

try {
  fs.mkdirSync(path.dirname(IDENTITY_PATH), { recursive: true })
} catch {}
