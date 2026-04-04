// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/dreamEngine.ts — Background memory consolidation.
// Runs when: time since last dream >= 24h AND 5+ new sessions AND no lock.
// 4-phase: Orient → Gather → Consolidate → Prune.
// Restricted to read-only bash + write to workspace/memory/ only.

import fs   from 'fs'
import path from 'path'
import { callBgLLM }    from './bgLLM'
import { auditTrail }   from './auditTrail'

const LOCK_FILE    = path.join(process.cwd(), 'workspace', 'dream.lock')
const MEMORY_DIR   = path.join(process.cwd(), 'workspace', 'memory')
const SESSIONS_DIR = path.join(process.cwd(), 'workspace', 'sessions')
const INDEX_PATH   = path.join(MEMORY_DIR, 'MEMORY_INDEX.md')

const GATE_HOURS    = 24   // hours since last dream
const GATE_SESSIONS = 5    // new sessions required

// ── Lock helpers ──────────────────────────────────────────────

interface LockData {
  pid:       number
  startedAt: string
}

function acquireLock(): boolean {
  try {
    fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true })

    if (fs.existsSync(LOCK_FILE)) {
      // Check if the lock holder is still alive
      const raw  = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf-8')) as LockData
      const alive = isPidAlive(raw.pid)
      if (alive) {
        console.log(`[DreamEngine] Lock held by PID ${raw.pid} — skipping`)
        return false
      }
      // PID is dead — steal the lock
      console.log(`[DreamEngine] Stale lock (PID ${raw.pid} dead) — stealing`)
    }

    const data: LockData = { pid: process.pid, startedAt: new Date().toISOString() }
    fs.writeFileSync(LOCK_FILE, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

function releaseLock(prevMtime?: number): void {
  try {
    if (prevMtime !== undefined) {
      // Update mtime to now (marks lastConsolidatedAt)
      const now = Date.now() / 1000
      fs.utimesSync(LOCK_FILE, now, now)
    } else {
      // On failure — restore prev mtime or just remove
      fs.unlinkSync(LOCK_FILE)
    }
  } catch {}
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function getLockMtime(): number {
  try {
    if (!fs.existsSync(LOCK_FILE)) return 0
    return fs.statSync(LOCK_FILE).mtimeMs
  } catch {
    return 0
  }
}

// ── Gate checks ───────────────────────────────────────────────

function checkTimeGate(lockMtime: number): boolean {
  if (lockMtime === 0) return true // never run
  const hoursSince = (Date.now() - lockMtime) / (1000 * 60 * 60)
  return hoursSince >= GATE_HOURS
}

function checkSessionGate(lockMtime: number): boolean {
  try {
    if (!fs.existsSync(SESSIONS_DIR)) return false
    const cutoff = lockMtime || 0
    const newSessions = fs.readdirSync(SESSIONS_DIR)
      .filter(f => f.endsWith('.md'))
      .filter(f => {
        try {
          return fs.statSync(path.join(SESSIONS_DIR, f)).mtimeMs > cutoff
        } catch {
          return false
        }
      })
    return newSessions.length >= GATE_SESSIONS
  } catch {
    return false
  }
}

function allGatesPass(): boolean {
  const lockMtime = getLockMtime()
  return checkTimeGate(lockMtime) && checkSessionGate(lockMtime)
}

// ── Dream phases ──────────────────────────────────────────────

async function phaseOrient(): Promise<string> {
  // List memory dir, read index, get overview
  try {
    const indexContent = fs.existsSync(INDEX_PATH)
      ? fs.readFileSync(INDEX_PATH, 'utf-8')
      : '(empty)'

    const memFiles = fs.existsSync(MEMORY_DIR)
      ? fs.readdirSync(MEMORY_DIR).filter(f => f.endsWith('.md') && f !== 'MEMORY_INDEX.md')
      : []

    return `MEMORY DIRECTORY (${memFiles.length} files):\n${memFiles.join('\n')}\n\nCURRENT INDEX:\n${indexContent.slice(0, 2000)}`
  } catch {
    return '(unable to read memory directory)'
  }
}

async function phaseGather(lockMtime: number): Promise<string> {
  // Scan recent session transcripts for signal
  try {
    if (!fs.existsSync(SESSIONS_DIR)) return '(no sessions)'

    const recentSessions = fs.readdirSync(SESSIONS_DIR)
      .filter(f => f.endsWith('.md'))
      .filter(f => {
        try { return fs.statSync(path.join(SESSIONS_DIR, f)).mtimeMs > lockMtime } catch { return false }
      })
      .slice(0, 10)

    if (recentSessions.length === 0) return '(no new sessions)'

    const excerpts = recentSessions.map(f => {
      try {
        const content = fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf-8')
        return `=== ${f} ===\n${content.slice(0, 800)}`
      } catch {
        return `=== ${f} === (unreadable)`
      }
    })

    return excerpts.join('\n\n')
  } catch {
    return '(unable to gather sessions)'
  }
}

async function phaseConsolidate(orientData: string, gatherData: string): Promise<{ filesUpdated: number }> {
  const prompt = `You are the DevOS Dream Engine performing memory consolidation.

CURRENT MEMORY STATE:
${orientData}

RECENT SESSION SIGNALS:
${gatherData}

Your job: identify facts from the sessions that should be preserved in long-term memory.

For each memory to write/update, output JSON:
[
  {
    "filename": "type_descriptor.md (e.g. user_coding_style.md, project_api_structure.md)",
    "title": "Short descriptive title",
    "type": "user_preference|project_fact|tool_pattern|learned_behavior",
    "content": "Concise actionable content. 2-6 sentences. Convert relative dates to absolute (e.g. 'last week' → '2026-03-25').",
    "summary": "One-line summary"
  }
]

Rules:
- Merge with existing rather than create duplicates
- Focus on patterns, not one-off events
- Absolute dates only
- Output ONLY valid JSON array`

  try {
    const raw  = await callBgLLM(prompt, 'dream_consolidate')
    if (!raw) return { filesUpdated: 0 }

    const jsonMatch = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').match(/\[[\s\S]*\]/)
    if (!jsonMatch) return { filesUpdated: 0 }

    const items = JSON.parse(jsonMatch[0]) as Array<{
      filename: string
      title:    string
      type:     string
      content:  string
      summary:  string
    }>

    if (!Array.isArray(items)) return { filesUpdated: 0 }

    let filesUpdated = 0
    const now = new Date().toISOString().split('T')[0]

    for (const item of items) {
      if (!item.filename || !item.content) continue
      const filePath = path.join(MEMORY_DIR, item.filename)

      let created = now
      if (fs.existsSync(filePath)) {
        try {
          const existing = fs.readFileSync(filePath, 'utf-8')
          const m        = existing.match(/^created:\s*(.+)$/m)
          if (m) created = m[1].trim()
        } catch {}
      }

      const fileContent = `---
title: ${item.title}
type: ${item.type}
created: ${created}
updated: ${now}
---

${item.content.trim()}
`
      try {
        fs.writeFileSync(filePath, fileContent, 'utf-8')
        filesUpdated++
      } catch {}
    }

    return { filesUpdated }
  } catch (e: any) {
    console.error('[DreamEngine] Consolidate phase failed:', e.message)
    return { filesUpdated: 0 }
  }
}

async function phasePrune(filesUpdated: number): Promise<void> {
  // Rebuild MEMORY_INDEX.md — max 100 entries
  try {
    if (!fs.existsSync(MEMORY_DIR)) return

    const files = fs.readdirSync(MEMORY_DIR)
      .filter(f => f.endsWith('.md') && f !== 'MEMORY_INDEX.md')
      .map(f => {
        try {
          const content = fs.readFileSync(path.join(MEMORY_DIR, f), 'utf-8')
          const titleM  = content.match(/^title:\s*(.+)$/m)
          const sumM    = content.match(/---\n+([\s\S]+?)(?:\n\n|$)/)
          const title   = titleM ? titleM[1].trim() : f.replace('.md', '')
          const summary = sumM
            ? sumM[1].trim().replace(/\n/g, ' ').slice(0, 80)
            : ''
          return `- [${title}](${f}) — ${summary}`
        } catch {
          return null
        }
      })
      .filter((l): l is string => l !== null)
      .slice(0, 100)

    fs.writeFileSync(INDEX_PATH, files.join('\n') + '\n', 'utf-8')
    console.log(`[DreamEngine] Pruned index to ${files.length} entries (${filesUpdated} files updated)`)
  } catch (e: any) {
    console.error('[DreamEngine] Prune phase failed:', e.message)
  }
}

// ── Main dream runner ─────────────────────────────────────────

export async function runDream(): Promise<void> {
  if (!allGatesPass()) {
    console.log('[DreamEngine] Gates not met — skipping')
    return
  }

  const prevMtime = getLockMtime()
  if (!acquireLock()) return

  const traceId = `dream_${Date.now()}`
  console.log('[DreamEngine] Dream starting...')

  let sessionsReviewed = 0
  let filesUpdated     = 0

  try {
    fs.mkdirSync(MEMORY_DIR, { recursive: true })

    // Phase 1: Orient
    console.log('[DreamEngine] Phase 1: Orient')
    const orientData = await phaseOrient()

    // Phase 2: Gather
    console.log('[DreamEngine] Phase 2: Gather')
    const gatherData = await phaseGather(prevMtime)
    sessionsReviewed = (gatherData.match(/=== .+\.md ===/g) || []).length

    // Phase 3: Consolidate
    console.log('[DreamEngine] Phase 3: Consolidate')
    const result = await phaseConsolidate(orientData, gatherData)
    filesUpdated = result.filesUpdated

    // Phase 4: Prune
    console.log('[DreamEngine] Phase 4: Prune')
    await phasePrune(filesUpdated)

    // Update lock mtime = lastConsolidatedAt
    releaseLock(prevMtime)

    // Log to AuditTrail
    try {
      auditTrail.record({
        action:     'system',
        tool:       'dream_completed',
        input:      JSON.stringify({ traceId }),
        output:     JSON.stringify({ filesUpdated, sessionsReviewed }),
        durationMs: 0,
        success:    true,
        traceId,
      })
    } catch {}

    console.log(`[DreamEngine] Dream complete — ${filesUpdated} files updated, ${sessionsReviewed} sessions reviewed`)

  } catch (e: any) {
    console.error('[DreamEngine] Dream failed:', e.message)
    // Roll back lock mtime
    try {
      if (prevMtime > 0) {
        const t = prevMtime / 1000
        fs.utimesSync(LOCK_FILE, t, t)
      } else {
        fs.unlinkSync(LOCK_FILE)
      }
    } catch {}
  }
}

// ── Check and run (called by scheduler) ───────────────────────

export function checkAndRunDream(): void {
  if (!allGatesPass()) return
  runDream().catch(e => console.error('[DreamEngine] Unhandled error:', e.message))
}
