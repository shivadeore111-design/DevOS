// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/planTool.ts — Manus-style phased task planner.
// Tracks multi-phase task execution with workspace persistence.

import fs   from 'fs'
import path from 'path'

// ── Types ──────────────────────────────────────────────────────

export type PhaseStatus     = 'pending' | 'running' | 'done' | 'failed'
export type PhaseCapability = 'research' | 'execution' | 'analysis' | 'writing' | 'reading' | 'browsing' | 'coding' | 'delivery'

export interface Phase {
  id:           string
  title:        string
  capabilities: PhaseCapability[]
  status:       PhaseStatus
  tools:        string[]
  result?:      string
  startedAt?:   number
  completedAt?: number
}

export interface TaskPlan {
  id:                string
  goal:              string
  phases:            Phase[]
  currentPhaseIndex: number
  status:            'planning' | 'running' | 'done' | 'failed'
  createdAt:         number
  completedAt?:      number
  workspaceDir:      string
}

// ── PlanTool singleton ────────────────────────────────────────

class PlanTool {
  private activePlans: Map<string, TaskPlan> = new Map()

  create(
    goal:   string,
    phases: Omit<Phase, 'status' | 'result' | 'startedAt' | 'completedAt'>[],
  ): TaskPlan {
    const id           = `task_${Date.now()}`
    const workspaceDir = path.join(process.cwd(), 'workspace', 'tasks', id)
    fs.mkdirSync(workspaceDir, { recursive: true })

    const plan: TaskPlan = {
      id,
      goal,
      phases: phases.map((p, i) => ({
        ...p,
        status:    i === 0 ? 'running' : 'pending',
        startedAt: i === 0 ? Date.now() : undefined,
      })),
      currentPhaseIndex: 0,
      status:            'running',
      createdAt:         Date.now(),
      workspaceDir,
    }

    this.activePlans.set(id, plan)
    this.savePlan(plan)
    return plan
  }

  advancePhase(planId: string, result?: string): Phase | null {
    const plan = this.activePlans.get(planId)
    if (!plan) return null

    const current = plan.phases[plan.currentPhaseIndex]
    if (current) {
      current.status      = 'done'
      current.result      = result
      current.completedAt = Date.now()
    }

    plan.currentPhaseIndex++

    if (plan.currentPhaseIndex >= plan.phases.length) {
      plan.status      = 'done'
      plan.completedAt = Date.now()
      this.savePlan(plan)
      return null
    }

    const next      = plan.phases[plan.currentPhaseIndex]
    next.status     = 'running'
    next.startedAt  = Date.now()

    this.savePlan(plan)
    return next
  }

  failPhase(planId: string, error: string): void {
    const plan = this.activePlans.get(planId)
    if (!plan) return
    const current = plan.phases[plan.currentPhaseIndex]
    if (current) {
      current.status = 'failed'
      current.result = error
    }
    plan.status = 'failed'
    this.savePlan(plan)
  }

  getCurrentPhase(planId: string): Phase | null {
    const plan = this.activePlans.get(planId)
    if (!plan) return null
    return plan.phases[plan.currentPhaseIndex] || null
  }

  getPlan(planId: string): TaskPlan | null {
    return this.activePlans.get(planId) || this.loadPlan(planId)
  }

  formatSummary(plan: TaskPlan): string {
    return plan.phases.map((p, i) => {
      const icon = p.status === 'done' ? '✓' : p.status === 'running' ? '▶' : p.status === 'failed' ? '✗' : '○'
      return `${icon} Phase ${i + 1}: ${p.title}`
    }).join(' → ')
  }

  private savePlan(plan: TaskPlan): void {
    try {
      fs.writeFileSync(
        path.join(plan.workspaceDir, 'plan.json'),
        JSON.stringify(plan, null, 2),
      )
    } catch {}
  }

  private loadPlan(planId: string): TaskPlan | null {
    try {
      const planPath = path.join(process.cwd(), 'workspace', 'tasks', planId, 'plan.json')
      if (!fs.existsSync(planPath)) return null
      const loaded = JSON.parse(fs.readFileSync(planPath, 'utf-8')) as TaskPlan
      this.activePlans.set(planId, loaded)
      return loaded
    } catch { return null }
  }
}

export const planTool = new PlanTool()
