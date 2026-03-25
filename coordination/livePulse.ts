// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// coordination/livePulse.ts — Real-time agent pulse / activity log.
// Extends EventEmitter so subscribers (e.g. /api/chat) can stream
// live execution progress directly to the UI.

import { EventEmitter } from 'events'

class LivePulse extends EventEmitter {
  act(agent: string, message: string): void {
    console.log(`[${agent}] ${message}`)
    this.emit('act', agent, message)
  }

  done(agent: string, message: string): void {
    console.log(`[${agent}] ✓ ${message}`)
    this.emit('done', agent, message)
  }

  error(agent: string, message: string): void {
    console.error(`[${agent}] ✗ ${message}`)
    this.emit('error', agent, message)
  }

  warn(agent: string, message: string): void {
    console.warn(`[${agent}] ⚠ ${message}`)
    this.emit('warn', agent, message)
  }

  info(agent: string, message: string): void {
    console.log(`[${agent}] ℹ ${message}`)
    this.emit('info', agent, message)
  }
}

export const livePulse = new LivePulse()
