// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/sessionRouter.ts — Cross-channel session tracking.
// Maintains a stable sessionId per user so conversation history
// is shared regardless of whether the user is on Telegram,
// the dashboard, or any future channel.

import fs   from 'fs'
import path from 'path'
import type { ChannelType } from './gateway'

// ── Types ──────────────────────────────────────────────────────

export interface CrossChannelSession {
  sessionId:    string
  userId:       string
  channels:     ChannelType[]       // channels that have participated
  lastChannel:  ChannelType
  lastActivity: number
  messageCount: number
}

// ── SessionRouter class ────────────────────────────────────────

class SessionRouter {
  private sessions:      Map<string, CrossChannelSession> = new Map()
  private userToSession: Map<string, string>              = new Map()

  // ── Get or create session for a user ─────────────────────────

  getSession(userId: string, channel: ChannelType): CrossChannelSession {
    const existingId = this.userToSession.get(userId)

    if (existingId && this.sessions.has(existingId)) {
      const session        = this.sessions.get(existingId)!
      session.lastChannel  = channel
      session.lastActivity = Date.now()

      if (!session.channels.includes(channel)) {
        session.channels.push(channel)
        console.log(
          `[Session] User ${userId} continued on ${channel} ` +
          `(started on ${session.channels[0]})`,
        )
      }

      return session
    }

    // Create new session
    const session: CrossChannelSession = {
      sessionId:    `session_${Date.now()}`,
      userId,
      channels:     [channel],
      lastChannel:  channel,
      lastActivity: Date.now(),
      messageCount: 0,
    }

    this.sessions.set(session.sessionId, session)
    this.userToSession.set(userId, session.sessionId)

    return session
  }

  // ── Load persisted conversation history for a session ────────
  // Reads from workspace/sessions/<sessionId>.json if it exists.
  // The actual continuity comes from conversationMemory.setSession()
  // receiving the stable sessionId — this is a foundation for
  // future per-session file-based export / mobile sync.

  getHistory(userId: string): any[] {
    const sessionId = this.userToSession.get(userId)
    if (!sessionId) return []

    const sessionFile = path.join(
      process.cwd(), 'workspace', 'sessions', `${sessionId}.json`,
    )

    if (fs.existsSync(sessionFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(sessionFile, 'utf8'))
        return data.messages || []
      } catch {}
    }

    return []
  }

  // ── Log a cross-channel continuation event ───────────────────

  markContinuation(
    userId:      string,
    fromChannel: ChannelType,
    toChannel:   ChannelType,
  ): void {
    const session = this.getSession(userId, toChannel)
    console.log(
      `[Session] Continuation: ${fromChannel} → ${toChannel} ` +
      `(${session.messageCount} messages in history)`,
    )
  }

  // ── Return channels for a given session ID ───────────────────
  // Used by /api/sessions to enrich the session list response.

  getSessionChannels(sessionId: string): ChannelType[] {
    return this.sessions.get(sessionId)?.channels ?? []
  }

  // ── Expire sessions older than 24 h ──────────────────────────

  cleanup(): void {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    for (const [id, session] of this.sessions) {
      if (session.lastActivity < cutoff) {
        this.sessions.delete(id)
        this.userToSession.delete(session.userId)
      }
    }
  }
}

export const sessionRouter = new SessionRouter()
