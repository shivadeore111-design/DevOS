// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// coordination/livePulse.ts — Real-time agent pulse / activity log.
// Extends EventEmitter so subscribers (e.g. /api/chat) can stream
// live execution progress directly to the UI.
//
// Every public method fires both a named event AND a universal
// 'any' event carrying a typed PulseEvent — one subscriber
// handles everything.

import { EventEmitter } from 'events'

// ── Types ─────────────────────────────────────────────────────

export type PulseEventType =
  | 'act'
  | 'done'
  | 'error'
  | 'warn'
  | 'info'
  | 'thinking'
  | 'tool'

export interface PulseEvent {
  type:       PulseEventType
  agent:      string
  message:    string
  timestamp:  number
  missionId?: string
  /** Present only for 'tool' events */
  tool?:      string
  /** Present only for 'tool' events */
  command?:   string
  /** Present only for 'tool' events — output after execution */
  output?:    string
}

// ── Implementation ────────────────────────────────────────────

const HISTORY_MAX = 100

class LivePulse extends EventEmitter {
  private history: PulseEvent[] = []

  constructor() {
    super()
    // CRITICAL: register a no-op 'error' listener so Node doesn't throw
    // unhandled 'error' events when livePulse.emit('error', ...) is called.
    this.on('error', () => { /* swallow — never crash on pulse errors */ })
  }

  // ── Private event dispatcher ──────────────────────────────

  private emit_event(event: PulseEvent): void {
    try {
      this.history.push(event)
      if (this.history.length > HISTORY_MAX) this.history.shift()

      // Named event (backwards compat) — skip 'error' type to avoid throwing
      if (event.type !== 'error') {
        this.emit(event.type, event.agent, event.message)
      }
      // Universal subscriber — always fires
      this.emit('any', event)
    } catch {
      // Never throw from event dispatch
    }
  }

  // ── Public methods — all wrapped in try-catch so they NEVER throw ──

  act(agent: string, message: string, missionId?: string): void {
    try {
      console.log(`[${agent}] ${message}`)
      this.emit_event({ type: 'act', agent, message, timestamp: Date.now(), missionId })
    } catch {
      // Silent fail — never throw from pulse methods
    }
  }

  done(agent: string, message: string, missionId?: string): void {
    try {
      console.log(`[${agent}] ✓ ${message}`)
      this.emit_event({ type: 'done', agent, message, timestamp: Date.now(), missionId })
    } catch {
      // Silent fail — never throw from pulse methods
    }
  }

  error(agent: string, message: string, missionId?: string): void {
    try {
      console.error(`[${agent}] ✗ ${message}`)
      this.emit_event({ type: 'error', agent, message, timestamp: Date.now(), missionId })
    } catch {
      // Never throw from error handler — log to console only
      console.error(`[LivePulse] emit_event failed for error: ${message}`)
    }
  }

  warn(agent: string, message: string, missionId?: string): void {
    try {
      console.warn(`[${agent}] ⚠ ${message}`)
      this.emit_event({ type: 'warn', agent, message, timestamp: Date.now(), missionId })
    } catch {
      // Silent fail — never throw from pulse methods
    }
  }

  info(agent: string, message: string, missionId?: string): void {
    try {
      console.log(`[${agent}] ℹ ${message}`)
      this.emit_event({ type: 'info', agent, message, timestamp: Date.now(), missionId })
    } catch {
      // Silent fail — never throw from pulse methods
    }
  }

  thinking(agent: string, message: string, missionId?: string): void {
    try {
      console.log(`[${agent}] 💭 ${message}`)
      this.emit_event({ type: 'thinking', agent, message, timestamp: Date.now(), missionId })
    } catch {
      // Silent fail — never throw from pulse methods
    }
  }

  tool(agent: string, toolName: string, command: string, output?: string): void {
    try {
      const message = output
        ? `${toolName}: ${command} → ${output.slice(0, 120)}`
        : `${toolName}: ${command}`
      console.log(`[${agent}] 🔧 ${message}`)
      this.emit_event({
        type:      'tool',
        agent,
        message,
        timestamp: Date.now(),
        tool:      toolName,
        command,
        output,
      })
    } catch {
      // Silent fail — never throw from pulse methods
    }
  }

  // ── History helpers ───────────────────────────────────────

  getHistory(): PulseEvent[] {
    return [...this.history]
  }

  clear(): void {
    this.history = []
  }
}

export const livePulse = new LivePulse()
