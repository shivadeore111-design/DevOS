// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// agents/agentRegistry.ts — Persistent registry of all agents

import * as fs   from 'fs'
import * as path from 'path'
import crypto    from 'crypto'
import { Agent, AgentRole, AgentStatus } from './types'
import { AGENT_DEFINITIONS }            from './agentDefinitions'

export class AgentRegistry {
  private filePath: string
  private agents: Map<string, Agent> = new Map()

  constructor() {
    const ws       = path.join(process.cwd(), 'workspace')
    this.filePath  = path.join(ws, 'agents.json')
    fs.mkdirSync(ws, { recursive: true })
    this.load()
  }

  // ── Persistence ───────────────────────────────────────────

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw  = fs.readFileSync(this.filePath, 'utf-8')
        const arr  = JSON.parse(raw) as Agent[]
        for (const a of arr) this.agents.set(a.role, a)
      }
    } catch { /* start fresh */ }

    // Seed built-in agents if not yet persisted
    for (const def of AGENT_DEFINITIONS) {
      if (!this.agents.has(def.role)) {
        const agent: Agent = {
          ...def,
          id:             crypto.randomBytes(6).toString('hex'),
          status:         'idle',
          completedTasks: 0,
          failedTasks:    0,
          createdAt:      new Date(),
        }
        this.agents.set(agent.role, agent)
      }
    }

    this.save()
  }

  private save(): void {
    const arr = Array.from(this.agents.values())
    fs.writeFileSync(this.filePath, JSON.stringify(arr, null, 2))
  }

  // ── Public API ────────────────────────────────────────────

  get(role: AgentRole | string): Agent | null {
    return this.agents.get(role) ?? null
  }

  list(): Agent[] {
    return Array.from(this.agents.values())
  }

  updateStatus(role: AgentRole | string, status: AgentStatus, taskId?: string): void {
    const agent = this.agents.get(role)
    if (!agent) return
    agent.status        = status
    agent.lastActiveAt  = new Date()
    if (taskId !== undefined) agent.currentTaskId = taskId
    if (status === 'idle') delete agent.currentTaskId
    this.agents.set(role, agent)
    this.save()
  }

  recordCompletion(role: AgentRole | string, success: boolean): void {
    const agent = this.agents.get(role)
    if (!agent) return
    if (success) agent.completedTasks++
    else         agent.failedTasks++
    this.agents.set(role, agent)
    this.save()
  }
}

export const agentRegistry = new AgentRegistry()
