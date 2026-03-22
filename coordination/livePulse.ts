// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// coordination/livePulse.ts — Real-time agent activity stream via SSE
// Emits 'agent_pulse' events on eventBus.
// The /api/stream SSE endpoint forwards all eventBus events automatically,
// so any UI subscribing to the stream will receive these in real time.

import { eventBus } from '../core/eventBus'
import { AgentRole } from '../agents/types'

// ── Types ──────────────────────────────────────────────────────

export interface PulseEvent {
  type:      'thinking' | 'acting' | 'done' | 'error'
  agent:     AgentRole
  message:   string
  timestamp: string
  missionId?: string
}

// ── LivePulse ──────────────────────────────────────────────────

class LivePulse {

  private emit(event: PulseEvent): void {
    eventBus.emit('agent_pulse', event)
  }

  /** Agent is reasoning / planning before calling a tool */
  think(agent: AgentRole, message: string, missionId?: string): void {
    this.emit({
      type:      'thinking',
      agent,
      message,
      timestamp: new Date().toISOString(),
      missionId,
    })
  }

  /** Agent is executing a tool call or taking an action */
  act(agent: AgentRole, message: string, missionId?: string): void {
    this.emit({
      type:      'acting',
      agent,
      message,
      timestamp: new Date().toISOString(),
      missionId,
    })
  }

  /** Agent completed its task successfully */
  done(agent: AgentRole, message: string, missionId?: string): void {
    this.emit({
      type:      'done',
      agent,
      message,
      timestamp: new Date().toISOString(),
      missionId,
    })
  }

  /** Agent encountered an error */
  error(agent: AgentRole, message: string, missionId?: string): void {
    this.emit({
      type:      'error',
      agent,
      message,
      timestamp: new Date().toISOString(),
      missionId,
    })
  }
}

export const livePulse = new LivePulse()
