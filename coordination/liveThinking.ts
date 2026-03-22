// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// coordination/liveThinking.ts — Streams agent reasoning to UI via SSE

import { eventBus } from '../core/eventBus'

interface ThinkingEvent {
  type:       'thinking' | 'acting' | 'done' | 'error'
  agent:      string
  message:    string
  timestamp:  string
  missionId?: string
}

class LiveThinking {
  private emit(event: ThinkingEvent): void {
    eventBus.emit('agent_thinking', event)
  }

  think(agent: string, message: string, missionId?: string): void {
    this.emit({ type: 'thinking', agent, message, timestamp: new Date().toISOString(), missionId })
  }

  act(agent: string, message: string, missionId?: string): void {
    this.emit({ type: 'acting', agent, message, timestamp: new Date().toISOString(), missionId })
  }

  done(agent: string, message: string, missionId?: string): void {
    this.emit({ type: 'done', agent, message, timestamp: new Date().toISOString(), missionId })
  }

  error(agent: string, message: string, missionId?: string): void {
    this.emit({ type: 'error', agent, message, timestamp: new Date().toISOString(), missionId })
  }
}

export const liveThinking = new LiveThinking()
