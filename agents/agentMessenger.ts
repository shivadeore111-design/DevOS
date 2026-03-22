// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// agents/agentMessenger.ts — Inter-agent message bus with persistence

import * as fs   from 'fs'
import * as path from 'path'
import crypto    from 'crypto'
import { AgentMessage, AgentRole } from './types'
import { eventBus }                from '../core/eventBus'

export class AgentMessenger {
  private filePath: string
  private messages: AgentMessage[] = []
  private readonly MAX_MESSAGES    = 500

  constructor() {
    const ws      = path.join(process.cwd(), 'workspace')
    this.filePath = path.join(ws, 'agent-messages.json')
    fs.mkdirSync(ws, { recursive: true })
    this.load()
  }

  // ── Persistence ───────────────────────────────────────────

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8')
        this.messages = JSON.parse(raw) as AgentMessage[]
      }
    } catch { this.messages = [] }
  }

  private save(): void {
    // Keep only last MAX_MESSAGES
    if (this.messages.length > this.MAX_MESSAGES) {
      this.messages = this.messages.slice(-this.MAX_MESSAGES)
    }
    fs.writeFileSync(this.filePath, JSON.stringify(this.messages, null, 2))
  }

  // ── Public API ────────────────────────────────────────────

  send(
    from:    AgentRole | 'user',
    to:      AgentRole | 'all' | 'user',
    content: string,
    type:    AgentMessage['type'],
    taskId?: string,
    goalId?: string,
  ): AgentMessage {
    const msg: AgentMessage = {
      id:        crypto.randomBytes(6).toString('hex'),
      fromAgent: from,
      toAgent:   to,
      content,
      type,
      taskId,
      goalId,
      timestamp: new Date(),
    }

    this.messages.push(msg)
    this.save()

    // Emit on event bus for SSE streaming
    eventBus.emit('agent_message', msg)

    const toLabel = (to === 'all' || to === 'user') ? to.toUpperCase() : to.toUpperCase()
    console.log(`[AgentMessenger] ${from.toUpperCase()} → ${toLabel} [${type}]: ${content.slice(0, 80)}${content.length > 80 ? '…' : ''}`)

    return msg
  }

  getThread(taskId: string): AgentMessage[] {
    return this.messages.filter(m => m.taskId === taskId || m.goalId === taskId)
  }

  getRecent(limit = 50): AgentMessage[] {
    return this.messages.slice(-limit)
  }
}

export const agentMessenger = new AgentMessenger()
