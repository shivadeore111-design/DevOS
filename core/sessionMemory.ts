// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/sessionMemory.ts — Per-session markdown log.
// After every 5 exchanges AND on conversation end, a background
// agent writes/updates workspace/sessions/{sessionId}.md.
// Injects last session context at conversation start.

import fs   from 'fs'
import path from 'path'
import { callBgLLM } from './bgLLM'

const SESSIONS_DIR = path.join(process.cwd(), 'workspace', 'sessions')

// ── Types ─────────────────────────────────────────────────────

interface Exchange {
  role:    'user' | 'assistant'
  content: string
  ts:      number
  files?:  string[]
  cmds?:   string[]
  errors?: string[]
}

interface SessionState {
  sessionId:      string
  startTs:        number
  exchanges:      Exchange[]
  lastWrittenAt?: number
}

// ── Section headers (must match exactly) ──────────────────────

const SECTION_HEADERS = [
  '# Session Title',
  '# Current State',
  '# What the User Asked',
  '# Files Touched',
  '# Commands Run',
  '# Errors & Fixes',
  '# Learnings',
  '# Results',
  '# Worklog',
]

// ── Helpers ───────────────────────────────────────────────────

function sessionPath(sessionId: string): string {
  return path.join(SESSIONS_DIR, `${sessionId}.md`)
}

function buildPrompt(state: SessionState): string {
  const msgs = state.exchanges.map(e =>
    `[${e.role.toUpperCase()}] ${e.content.slice(0, 600)}`,
  ).join('\n\n')

  const files   = state.exchanges.flatMap(e => e.files  ?? []).filter(Boolean)
  const cmds    = state.exchanges.flatMap(e => e.cmds   ?? []).filter(Boolean)
  const errors  = state.exchanges.flatMap(e => e.errors ?? []).filter(Boolean)

  return `You are a session memory writer for DevOS. Based on the conversation below, write a session summary in this exact format with these exact headers (never change the headers):

# Session Title
_A short 5-10 word title_

# Current State
_What's being worked on right now? Next steps?_

# What the User Asked
_The original goal. Design decisions made._

# Files Touched
_Important files and what was done to them._

# Commands Run
_Key commands and their purpose._

# Errors & Fixes
_What broke and how it was resolved._

# Learnings
_What worked, what didn't, what to avoid next time._

# Results
_Key outputs or answers produced._

# Worklog
_Terse step-by-step of what happened._

CONVERSATION:
${msgs}

FILES TOUCHED: ${files.join(', ') || 'none'}
COMMANDS RUN: ${cmds.join(', ') || 'none'}
ERRORS: ${errors.join(', ') || 'none'}

Write the session summary now. Use the exact headers shown above.`
}

// ── SessionMemory ─────────────────────────────────────────────

class SessionMemory {
  private sessions = new Map<string, SessionState>()

  constructor() {
    try { fs.mkdirSync(SESSIONS_DIR, { recursive: true }) } catch {}
  }

  // ── Start / get session ───────────────────────────────────

  private getOrCreate(sessionId: string): SessionState {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        sessionId,
        startTs:   Date.now(),
        exchanges: [],
      })
    }
    return this.sessions.get(sessionId)!
  }

  // ── Add exchange ──────────────────────────────────────────

  addExchange(
    sessionId: string,
    userMsg:   string,
    aiMsg:     string,
    files?:    string[],
    cmds?:     string[],
    errors?:   string[],
  ): void {
    const state = this.getOrCreate(sessionId)

    state.exchanges.push({ role: 'user',      content: userMsg, ts: Date.now() })
    state.exchanges.push({ role: 'assistant', content: aiMsg,   ts: Date.now(), files, cmds, errors })

    // Every 5 exchange pairs (10 messages), write in background
    const pairs = Math.floor(state.exchanges.length / 2)
    if (pairs > 0 && pairs % 5 === 0) {
      setTimeout(() => { this.writeSession(sessionId).catch(() => {}) }, 100)
    }
  }

  // ── End session ───────────────────────────────────────────

  endSession(sessionId: string): void {
    setTimeout(() => { this.writeSession(sessionId).catch(() => {}) }, 100)
  }

  // ── Write session file ────────────────────────────────────

  async writeSession(sessionId: string): Promise<void> {
    const state = this.sessions.get(sessionId)
    if (!state || state.exchanges.length === 0) return

    try {
      const prompt  = buildPrompt(state)
      const content = await callBgLLM(prompt, `session_${sessionId}`)
      if (!content || !content.includes('# Session Title')) return

      const filePath = sessionPath(sessionId)
      fs.writeFileSync(filePath, content, 'utf-8')
      state.lastWrittenAt = Date.now()
      console.log(`[SessionMemory] Written: ${filePath}`)
    } catch (e: any) {
      console.error('[SessionMemory] Write failed:', e.message)
    }
  }

  // ── Get last session context (inject at conversation start) ─

  getLastContext(sessionId: string): string {
    // Try exact session file first
    const exact = sessionPath(sessionId)
    if (fs.existsSync(exact)) {
      try { return fs.readFileSync(exact, 'utf-8').slice(0, 2000) } catch {}
    }

    // Fall back to most recent session file
    try {
      if (!fs.existsSync(SESSIONS_DIR)) return ''
      const files = fs.readdirSync(SESSIONS_DIR)
        .filter(f => f.endsWith('.md'))
        .map(f => ({
          name: f,
          mtime: fs.statSync(path.join(SESSIONS_DIR, f)).mtimeMs,
        }))
        .sort((a, b) => b.mtime - a.mtime)

      if (files.length === 0) return ''
      const latest = path.join(SESSIONS_DIR, files[0].name)
      return fs.readFileSync(latest, 'utf-8').slice(0, 2000)
    } catch {
      return ''
    }
  }

  // ── List sessions ──────────────────────────────────────────

  listSessions(): string[] {
    try {
      if (!fs.existsSync(SESSIONS_DIR)) return []
      return fs.readdirSync(SESSIONS_DIR)
        .filter(f => f.endsWith('.md'))
        .sort()
    } catch {
      return []
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────

export const sessionMemory = new SessionMemory()
