// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/sessionManager.ts — Persistent session lifecycle for agent runs

import * as fs   from "fs"
import * as path from "path"

const SESSIONS_FILE = path.join(process.cwd(), "workspace", "sessions.json")

export interface AgentSession {
  id:            string
  goal:          string
  workspacePath: string
  history:       Array<{ role: "user" | "agent"; content: string; timestamp: Date }>
  memoryRefs:    string[]
  status:        "active" | "paused" | "completed" | "failed"
  createdAt:     Date
  updatedAt:     Date
}

function makeId(): string {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export class SessionManager {
  private sessions = new Map<string, AgentSession>()

  constructor() {
    this.load()
  }

  // ── CRUD ─────────────────────────────────────────────────

  create(goal: string, workspacePath: string): AgentSession {
    const now = new Date()
    const session: AgentSession = {
      id:            makeId(),
      goal,
      workspacePath,
      history:       [],
      memoryRefs:    [],
      status:        "active",
      createdAt:     now,
      updatedAt:     now,
    }
    this.sessions.set(session.id, session)
    this.persist()
    console.log(`[SessionManager] Session created: ${session.id}`)
    return session
  }

  get(sessionId: string): AgentSession | null {
    return this.sessions.get(sessionId) ?? null
  }

  list(): AgentSession[] {
    return Array.from(this.sessions.values())
  }

  getActive(): AgentSession[] {
    return this.list().filter(s => s.status === "active")
  }

  // ── History ───────────────────────────────────────────────

  addHistory(sessionId: string, role: "user" | "agent", content: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    session.history.push({ role, content, timestamp: new Date() })
    session.updatedAt = new Date()
    this.persist()
  }

  // ── Status transitions ────────────────────────────────────

  pause(sessionId: string): void {
    this.transition(sessionId, "paused")
  }

  resume(sessionId: string): AgentSession | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null
    if (session.status === "paused") {
      session.status    = "active"
      session.updatedAt = new Date()
      this.persist()
      console.log(`[SessionManager] Session resumed: ${sessionId}`)
    }
    return session
  }

  complete(sessionId: string): void {
    this.transition(sessionId, "completed")
    console.log(`[SessionManager] Session completed: ${sessionId}`)
  }

  fail(sessionId: string): void {
    this.transition(sessionId, "failed")
    console.log(`[SessionManager] Session failed: ${sessionId}`)
  }

  // ── Persistence ───────────────────────────────────────────

  private persist(): void {
    try {
      const dir = path.dirname(SESSIONS_FILE)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      const data = Array.from(this.sessions.values())
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2), "utf8")
    } catch (err) {
      console.warn("[SessionManager] Failed to persist sessions:", err)
    }
  }

  private load(): void {
    try {
      if (!fs.existsSync(SESSIONS_FILE)) return
      const raw  = fs.readFileSync(SESSIONS_FILE, "utf8")
      const data = JSON.parse(raw) as any[]
      for (const item of data) {
        // Revive Date fields
        item.createdAt = new Date(item.createdAt)
        item.updatedAt = new Date(item.updatedAt)
        if (Array.isArray(item.history)) {
          item.history = item.history.map((h: any) => ({ ...h, timestamp: new Date(h.timestamp) }))
        }
        this.sessions.set(item.id, item as AgentSession)
      }
      console.log(`[SessionManager] Loaded ${this.sessions.size} session(s)`)
    } catch {
      // Sessions file missing or corrupt — start fresh
    }
  }

  // ── Internal ──────────────────────────────────────────────

  private transition(sessionId: string, status: AgentSession["status"]): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    session.status    = status
    session.updatedAt = new Date()
    this.persist()
  }
}

export const sessionManager = new SessionManager()
