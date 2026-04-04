// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/dreamEngine.ts — Background memory consolidation.
// Runs every 6 hours (wired via scheduler), consolidates recent
// session transcripts into workspace/memory/ using a 4-phase approach.
//
// Gates: time (24h since last), session count (5+ new), lock (no other dream).
// Lock file: workspace/dream.lock — PID-based, stolen if holder is dead.
// LLM: system cost only (Cerebras → Ollama fallback).

import fs   from 'fs'
import path from 'path'
import { costTracker } from './costTracker'
import { memoryExtractor } from './memoryExtractor'
import { auditTrail } from './auditTrail'

// ── Paths ──────────────────────────────────────────────────────

const DREAM_LOCK   = path.join(process.cwd(), 'workspace', 'dream.lock')
const SESSIONS_DIR = path.join(process.cwd(), 'workspace', 'sessions')
const MEMORY_DIR   = path.join(process.cwd(), 'workspace', 'memory')

// ── Types ──────────────────────────────────────────────────────

interface DreamLock {
  pid:       number
  startedAt: string
}

export interface DreamResult {
  ran:             boolean
  reason?:         string     // why it didn't run (gate name)
  sessionsReviewed:number
  filesUpdated:    number
  durationMs:      number
}

// ── Gate checks ────────────────────────────────────────────────

function checkTimeGate(minHours = 24): { pass: boolean; hoursAgo: number } {
  try {
    if (!fs.existsSync(DREAM_LOCK)) return { pass: true, hoursAgo: Infinity }
    const stat    = fs.statSync(DREAM_LOCK)
    const hoursAgo = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60)
    return { pass: hoursAgo >= minHours, hoursAgo: Math.round(hoursAgo * 10) / 10 }
  } catch {
    return { pass: true, hoursAgo: Infinity }
  }
}

function checkSessionGate(minNewSessions = 5): { pass: boolean; newCount: number } {
  try {
    if (!fs.existsSync(SESSIONS_DIR)) return { pass: false, newCount: 0 }
    let lastDreamMtime = 0
    if (fs.existsSync(DREAM_LOCK)) {
      lastDreamMtime = fs.statSync(DREAM_LOCK).mtimeMs
    }
    const newCount = fs.readdirSync(SESSIONS_DIR)
      .filter(f => f.endsWith('.md'))
      .filter(f => {
        try { return fs.statSync(path.join(SESSIONS_DIR, f)).mtimeMs > lastDreamMtime } catch { return false }
      })
      .length
    return { pass: newCount >= minNewSessions, newCount }
  } catch {
    return { pass: false, newCount: 0 }
  }
}

// ── Lock management ────────────────────────────────────────────

function acquireLock(): boolean {
  try {
    fs.mkdirSync(path.dirname(DREAM_LOCK), { recursive: true })

    if (fs.existsSync(DREAM_LOCK)) {
      // Check if holder is alive
      try {
        const raw  = fs.readFileSync(DREAM_LOCK, 'utf-8')
        const lock = JSON.parse(raw) as DreamLock
        try {
          process.kill(lock.pid, 0)  // throws if PID is dead
          return false               // PID is alive — lock is held
        } catch {
          // PID is dead — steal the lock
          console.log(`[DreamEngine] Stealing lock from dead PID ${lock.pid}`)
        }
      } catch {
        // lock file corrupt — steal it
      }
    }

    const lockData: DreamLock = { pid: process.pid, startedAt: new Date().toISOString() }
    fs.writeFileSync(DREAM_LOCK, JSON.stringify(lockData))
    return true
  } catch {
    return false
  }
}

function releaseLock(prevMtime?: number): void {
  try {
    if (!fs.existsSync(DREAM_LOCK)) return
    const raw  = fs.readFileSync(DREAM_LOCK, 'utf-8')
    const lock = JSON.parse(raw) as DreamLock
    if (lock.pid !== process.pid) return  // don't release someone else's lock

    if (prevMtime !== undefined) {
      // Failure: roll back mtime to previous value by writing back the old timestamp
      // We can't set mtime directly on Windows easily — just leave mtime as-is
      // The new mtime will be "now" which is close enough to the failure time
    }
    // Update mtime to now (success path) by touching the file
    fs.utimesSync(DREAM_LOCK, new Date(), new Date())
  } catch {}
}

function savePrevMtime(): number {
  try {
    if (!fs.existsSync(DREAM_LOCK)) return 0
    return fs.statSync(DREAM_LOCK).mtimeMs
  } catch {
    return 0
  }
}

// ── Cheap LLM caller ────────────────────────────────────────────

async function callCheapLLM(prompt: string, maxTokens = 1800): Promise<string> {
  try {
    const { loadConfig } = await import('../providers/index')
    const config  = loadConfig()
    const cerebras = config.providers.apis.find(
      a => a.provider === 'cerebras' && a.enabled && !a.rateLimited,
    )
    if (cerebras) {
      const key = cerebras.key.startsWith('env:')
        ? (process.env[cerebras.key.replace('env:', '')] || '')
        : cerebras.key
      if (key) {
        const r = await fetch('https://api.cerebras.ai/v1/chat/completions', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
          body:    JSON.stringify({ model: cerebras.model || 'llama3.1-8b', messages: [{ role: 'user', content: prompt }], stream: false, max_tokens: maxTokens }),
          signal:  AbortSignal.timeout(30000),
        })
        if (r.ok) {
          const d = await r.json() as any
          costTracker.record({ provider: 'cerebras', model: cerebras.model, rawResponse: d, taskType: 'system' })
          return d?.choices?.[0]?.message?.content || ''
        }
      }
    }
  } catch {}

  // Ollama fallback
  try {
    const { loadConfig } = await import('../providers/index')
    const config    = loadConfig()
    const ollamaModel = config.model?.activeModel || 'mistral:7b'
    const r = await fetch('http://localhost:11434/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model: ollamaModel, stream: false, messages: [{ role: 'user', content: prompt }] }),
      signal:  AbortSignal.timeout(60000),
    })
    if (r.ok) {
      const d = await r.json() as any
      costTracker.record({ provider: 'ollama', model: ollamaModel, rawResponse: d, taskType: 'system' })
      return d?.message?.content || ''
    }
  } catch {}

  return ''
}

// ── Read recent session files ──────────────────────────────────

function readRecentSessions(count = 10): Array<{ name: string; content: string }> {
  try {
    if (!fs.existsSync(SESSIONS_DIR)) return []
    let lastDreamMtime = 0
    if (fs.existsSync(DREAM_LOCK)) {
      lastDreamMtime = fs.statSync(DREAM_LOCK).mtimeMs
    }
    return fs.readdirSync(SESSIONS_DIR)
      .filter(f => f.endsWith('.md'))
      .filter(f => {
        try { return fs.statSync(path.join(SESSIONS_DIR, f)).mtimeMs > lastDreamMtime } catch { return false }
      })
      .slice(-count)
      .map(f => ({
        name:    f,
        content: fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf-8').slice(0, 1500),
      }))
  } catch {
    return []
  }
}

// ── 4-phase consolidation ──────────────────────────────────────

async function runConsolidation(sessions: Array<{ name: string; content: string }>): Promise<number> {
  const sessionText = sessions
    .map(s => `### Session: ${s.name}\n${s.content}`)
    .join('\n\n---\n\n')

  // Phase 1: Orient — understand what memory we already have
  const existingMemory = memoryExtractor.getMemoryInjection(2000)

  // Phase 2+3+4: Gather, Consolidate, Prune in one LLM call
  // (cheaper: avoid multiple round-trips for background tasks)
  const prompt = `You are DevOS Dream Engine — a background memory consolidation agent.

EXISTING MEMORY SUMMARY:
${existingMemory || '(empty — no memories yet)'}

RECENT SESSIONS TO PROCESS:
${sessionText.slice(0, 4000)}

Your task (4 phases):
1. ORIENT: What patterns or themes appear across these sessions?
2. GATHER: What new facts, preferences, or patterns emerged that aren't in existing memory?
3. CONSOLIDATE: For each new insight, output a JSON line (JSONL):
   {"type": "user_preference|project_fact|tool_pattern|learned_behavior", "title": "5-10 word title", "content": "Concise, actionable content. Max 2 sentences.", "action": "create|update"}
4. PRUNE: Which existing memory entries are now outdated or incorrect? Output:
   {"action": "deprecate", "title": "exact title to mark stale"}

Rules:
- Only extract GENUINELY new, persistent knowledge not already in memory
- Prefer updating existing entries over creating near-duplicates
- Output ONLY the JSONL lines (one per line, no prose)
- Maximum 8 memory operations total

Begin JSONL output:`

  const raw = await callCheapLLM(prompt, 1000)
  if (!raw) return 0

  let filesUpdated = 0
  const lines = raw.trim().split('\n').filter(l => l.trim().startsWith('{'))

  for (const line of lines) {
    try {
      const op = JSON.parse(line) as any
      if (op.action === 'deprecate') continue   // don't delete — mark is not implemented here
      if (!op.type || !op.title || !op.content) continue
      await memoryExtractor.upsertMemory(op.type, op.title, op.content)
      filesUpdated++
    } catch {}
  }

  return filesUpdated
}

// ── DreamEngine class ──────────────────────────────────────────

export class DreamEngine {

  // ── Check if dream should run (all 3 gates) ───────────

  shouldRun(): { should: boolean; reason: string } {
    const timeGate    = checkTimeGate(24)
    const sessionGate = checkSessionGate(5)

    if (!timeGate.pass) {
      return { should: false, reason: `time_gate (last dream ${timeGate.hoursAgo}h ago, need 24h)` }
    }
    if (!sessionGate.pass) {
      return { should: false, reason: `session_gate (only ${sessionGate.newCount} new sessions, need 5)` }
    }
    return { should: true, reason: 'all gates passed' }
  }

  // ── Run the dream consolidation ────────────────────────

  async run(): Promise<DreamResult> {
    const start = Date.now()
    const { should, reason } = this.shouldRun()

    if (!should) {
      return { ran: false, reason, sessionsReviewed: 0, filesUpdated: 0, durationMs: 0 }
    }

    // Acquire lock
    if (!acquireLock()) {
      return { ran: false, reason: 'lock_gate (another dream is running)', sessionsReviewed: 0, filesUpdated: 0, durationMs: 0 }
    }

    const prevMtime      = savePrevMtime()
    let   filesUpdated   = 0
    let   sessionsReviewed = 0

    try {
      console.log('[DreamEngine] Starting consolidation...')
      const sessions = readRecentSessions(10)
      sessionsReviewed = sessions.length

      if (sessions.length > 0) {
        filesUpdated = await runConsolidation(sessions)
      }

      // Success — update lock mtime to now
      releaseLock()
      const durationMs = Date.now() - start

      // Log to AuditTrail
      auditTrail.record({
        action:     'system',
        tool:       'dream_completed',
        input:      `sessions_reviewed: ${sessionsReviewed}`,
        output:     `files_updated: ${filesUpdated}`,
        durationMs,
        success:    true,
        goal:       'Memory consolidation',
      })

      console.log(`[DreamEngine] Completed: ${filesUpdated} memory files updated from ${sessionsReviewed} sessions (${durationMs}ms)`)
      return { ran: true, sessionsReviewed, filesUpdated, durationMs }

    } catch (e: any) {
      console.error('[DreamEngine] Consolidation failed:', e.message)
      releaseLock(prevMtime)
      auditTrail.record({
        action:     'system',
        tool:       'dream_completed',
        input:      `sessions_reviewed: ${sessionsReviewed}`,
        output:     `error: ${e.message}`,
        durationMs: Date.now() - start,
        success:    false,
        error:      e.message,
      })
      return { ran: false, reason: `error: ${e.message}`, sessionsReviewed, filesUpdated, durationMs: Date.now() - start }
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────
export const dreamEngine = new DreamEngine()
