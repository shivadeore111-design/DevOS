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
  type:      PulseEventType
  agent:     string
  message:   string
  timestamp: number
  /** Present only for 'tool' events */
  tool?:     string
  /** Present only for 'tool' events */
  command?:  string
  /** Present only for 'tool' events — output after execution */
  output?:   string
}

// ── Implementation ────────────────────────────────────────────

const HISTORY_MAX = 100

class LivePulse extends EventEmitter {
  private history: PulseEvent[] = []

  // ── Private event dispatcher ──────────────────────────────

  private emit_event(event: PulseEvent): void {
    this.history.push(event)
    if (this.history.length > HISTORY_MAX) this.history.shift()

    // Named event (backwards compat)
    this.emit(event.type, event.agent, event.message)
    // Universal subscriber
    this.emit('any', event)
  }

  // ── Public methods ────────────────────────────────────────

  act(agent: string, message: string): void {
    console.log(`[${agent}] ${message}`)
    this.emit_event({ type: 'act', agent, message, timestamp: Date.now() })
  }

  done(agent: string, message: string): void {
    console.log(`[${agent}] ✓ ${message}`)
    this.emit_event({ type: 'done', agent, message, timestamp: Date.now() })
  }

  error(agent: string, message: string): void {
    console.error(`[${agent}] ✗ ${message}`)
    this.emit_event({ type: 'error', agent, message, timestamp: Date.now() })
  }

  warn(agent: string, message: string): void {
    console.warn(`[${agent}] ⚠ ${message}`)
    this.emit_event({ type: 'warn', agent, message, timestamp: Date.now() })
  }

  info(agent: string, message: string): void {
    console.log(`[${agent}] ℹ ${message}`)
    this.emit_event({ type: 'info', agent, message, timestamp: Date.now() })
  }

  thinking(agent: string, message: string): void {
    console.log(`[${agent}] 💭 ${message}`)
    this.emit_event({ type: 'thinking', agent, message, timestamp: Date.now() })
  }

  tool(agent: string, toolName: string, command: string, output?: string): void {
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
