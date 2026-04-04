// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/sessionMemory.ts — Per-session memory in structured Markdown.
// After every 5 exchanges AND on conversation end, a background agent writes /
// updates workspace/sessions/{sessionId}.md.  On next session start, the last
// session file is read and injected into the system context.
//
// LLM usage: cheapest available (Cerebras first, then Ollama). Tracked as
// "system" cost — excluded from user daily budget.

import fs   from 'fs'
import path from 'path'
import { costTracker } from './costTracker'

// ── Paths ──────────────────────────────────────────────────────

const SESSIONS_DIR = path.join(process.cwd(), 'workspace', 'sessions')

// ── Types ──────────────────────────────────────────────────────

export interface SessionMessage {
  role:    'user' | 'assistant'
  content: string
  ts?:     number
}

export interface SessionSummary {
  sessionId:    string
  title:        string
  currentState: string
  filePath:     string
}

// ── Section names (never mutate these headers) ─────────────────

const SECTIONS = [
  'Session Title',
  'Current State',
  'What the User Asked',
  'Files Touched',
  'Commands Run',
  'Errors & Fixes',
  'Learnings',
  'Results',
  'Worklog',
] as const

// ── Cheapest-provider LLM caller ───────────────────────────────
// Returns text or empty string on failure. Never throws.

async function callCheapLLM(prompt: string): Promise<string> {
  // Try Cerebras first (fastest + free)
  try {
    const { loadConfig } = await import('../providers/index')
    const config = loadConfig()
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
          body:    JSON.stringify({ model: cerebras.model || 'llama3.1-8b', messages: [{ role: 'user', content: prompt }], stream: false, max_tokens: 1500 }),
          signal:  AbortSignal.timeout(20000),
        })
        if (r.ok) {
          const d = await r.json() as any
          costTracker.record({ provider: 'cerebras', model: cerebras.model, rawResponse: d, taskType: 'system' })
          return d?.choices?.[0]?.message?.content || ''
        }
      }
    }
  } catch {}

  // Fallback: Ollama
  try {
    const { loadConfig } = await import('../providers/index')
    const config = loadConfig()
    const ollamaModel = config.model?.activeModel || 'mistral:7b'
    const r = await fetch('http://localhost:11434/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model: ollamaModel, stream: false, messages: [{ role: 'user', content: prompt }] }),
      signal:  AbortSignal.timeout(30000),
    })
    if (r.ok) {
      const d = await r.json() as any
      costTracker.record({ provider: 'ollama', model: ollamaModel, rawResponse: d, taskType: 'system' })
      return d?.message?.content || ''
    }
  } catch {}

  return ''
}

// ── Session file builder ────────────────────────────────────────

function buildSessionPrompt(sessionId: string, messages: SessionMessage[], existingMd?: string): string {
  const history = messages
    .slice(-30)  // last 30 messages for context window
    .map(m => `[${m.role.toUpperCase()}]: ${m.content.slice(0, 500)}`)
    .join('\n\n')

  const existing = existingMd
    ? `\n\nEXISTING SESSION FILE (update, do not replace wholesale):\n${existingMd.slice(0, 2000)}`
    : ''

  return `You are a session memory agent for DevOS. Analyse the conversation below and produce a structured session summary in Markdown.

RULES:
1. Use EXACTLY these section headers (no changes): ${SECTIONS.map(s => `# ${s}`).join(', ')}
2. Under each header write a brief italic description line first (e.g. _What was accomplished_), then the content.
3. Keep each section under 200 words.
4. Worklog: terse chronological bullets (8 words max per bullet).
5. Current State: always end with "Next steps: ..."
6. Output ONLY the Markdown. No preamble, no code fences.${existing}

CONVERSATION (session ${sessionId}):
${history}

Now produce the full Markdown session file:`
}

// ── Write / update a session file ────────────────────────────────

async function writeSessionFile(sessionId: string, messages: SessionMessage[]): Promise<void> {
  try {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true })
    const filePath = path.join(SESSIONS_DIR, `${sessionId}.md`)
    const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : undefined
    const prompt   = buildSessionPrompt(sessionId, messages, existing)
    const md       = await callCheapLLM(prompt)
    if (!md || md.trim().length < 50) return  // LLM returned garbage — skip

    // Validate all sections are present
    const hasSections = SECTIONS.every(s => md.includes(`# ${s}`))
    if (!hasSections) {
      // Scaffold missing sections into the output
      let scaffolded = md
      for (const s of SECTIONS) {
        if (!scaffolded.includes(`# ${s}`)) {
          scaffolded += `\n\n# ${s}\n_No data_\n`
        }
      }
      fs.writeFileSync(filePath, scaffolded, 'utf-8')
    } else {
      fs.writeFileSync(filePath, md, 'utf-8')
    }
  } catch (e: any) {
    console.warn('[SessionMemory] Failed to write session file:', e.message)
  }
}

// ── Extract title and current state from a session file ────────

function parseSessionFile(md: string): { title: string; currentState: string } {
  const titleMatch   = md.match(/# Session Title\s*\n.*?\n([\s\S]*?)(?=\n#|$)/)?.[1]?.trim() || ''
  const stateMatch   = md.match(/# Current State\s*\n.*?\n([\s\S]*?)(?=\n#|$)/)?.[1]?.trim() || ''
  return {
    title:        titleMatch.slice(0, 100)  || 'Untitled Session',
    currentState: stateMatch.slice(0, 300)  || 'No state recorded',
  }
}

// ── SessionMemory class ─────────────────────────────────────────

export class SessionMemory {
  private sessionId:    string = ''
  private messages:     SessionMessage[] = []
  private exchangeCount:number = 0
  private flushTimer:   NodeJS.Timeout | null = null
  private readonly FLUSH_EVERY = 5  // every N exchanges

  // ── Start a new session ────────────────────────────────

  startSession(sessionId: string): void {
    this.sessionId     = sessionId
    this.messages      = []
    this.exchangeCount = 0
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null }
  }

  // ── Record a message exchange ──────────────────────────

  addMessage(role: 'user' | 'assistant', content: string): void {
    this.messages.push({ role, content, ts: Date.now() })
    if (role === 'assistant') {
      this.exchangeCount++
      if (this.exchangeCount % this.FLUSH_EVERY === 0) {
        this.scheduleFlush()
      }
    }
  }

  // ── Flush on conversation end ──────────────────────────

  endSession(): void {
    if (this.sessionId && this.messages.length > 0) {
      this.scheduleFlush(0)
    }
  }

  // ── Get last session summary for injection into system context ─

  getLastSessionSummary(): string {
    try {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true })
      const files = fs.readdirSync(SESSIONS_DIR)
        .filter(f => f.endsWith('.md'))
        .map(f => ({ name: f, mtime: fs.statSync(path.join(SESSIONS_DIR, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime)

      // Skip the current session's file
      const others = files.filter(f => !f.name.includes(this.sessionId))
      if (others.length === 0) return ''

      const lastFile = path.join(SESSIONS_DIR, others[0].name)
      const md       = fs.readFileSync(lastFile, 'utf-8')
      const { title, currentState } = parseSessionFile(md)
      return `Last session: "${title}"\nState: ${currentState}`
    } catch {
      return ''
    }
  }

  // ── List all sessions ──────────────────────────────────

  listSessions(): SessionSummary[] {
    try {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true })
      return fs.readdirSync(SESSIONS_DIR)
        .filter(f => f.endsWith('.md'))
        .map(f => {
          const filePath = path.join(SESSIONS_DIR, f)
          const md       = fs.readFileSync(filePath, 'utf-8')
          const { title, currentState } = parseSessionFile(md)
          const sessionId = f.replace('.md', '')
          return { sessionId, title, currentState, filePath }
        })
        .sort((a, b) => {
          const ma = fs.statSync(a.filePath).mtimeMs
          const mb = fs.statSync(b.filePath).mtimeMs
          return mb - ma
        })
    } catch {
      return []
    }
  }

  // ── Get last session info for dashboard card ───────────

  getLastSessionInfo(): { title: string; currentState: string } | null {
    const sessions = this.listSessions()
    if (sessions.length === 0) return null
    const last = sessions[0]
    return { title: last.title, currentState: last.currentState }
  }

  // ── Internal ───────────────────────────────────────────

  private scheduleFlush(delayMs = 100): void {
    if (this.flushTimer) clearTimeout(this.flushTimer)
    const sid  = this.sessionId
    const msgs = [...this.messages]
    this.flushTimer = setTimeout(async () => {
      this.flushTimer = null
      await writeSessionFile(sid, msgs)
    }, delayMs)
  }
}

// ── Singleton ──────────────────────────────────────────────────
export const sessionMemory = new SessionMemory()
