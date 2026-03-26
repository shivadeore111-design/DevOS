// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/taskState.ts — Persistent step-level task state.
// Enables crash recovery, idempotent execution, and token budgeting.

import fs   from 'fs'
import path from 'path'

// ── Types ──────────────────────────────────────────────────────

export type StepStatus = 'pending' | 'completed' | 'failed'
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface StepRecord {
  index:        number
  tool:         string
  input:        any
  status:       StepStatus
  output?:      string
  error?:       string
  duration?:    number
  completedAt?: number
}

export interface TaskState {
  id:           string
  goal:         string
  planId?:      string
  status:       TaskStatus
  currentStep:  number
  totalSteps:   number
  steps:        StepRecord[]
  tokenUsage:   number
  tokenLimit:   number
  createdAt:    number
  updatedAt:    number
  completedAt?: number
  error?:       string
}

const TASKS_DIR = path.join(process.cwd(), 'workspace', 'tasks')

// ── TaskStateManager ───────────────────────────────────────────

export class TaskStateManager {

  create(taskId: string, goal: string, totalSteps: number, planId?: string): TaskState {
    const state: TaskState = {
      id:          taskId,
      goal,
      planId,
      status:      'running',
      currentStep: 0,
      totalSteps,
      steps:       [],
      tokenUsage:  0,
      tokenLimit:  50000,
      createdAt:   Date.now(),
      updatedAt:   Date.now(),
    }
    this.save(state)
    return state
  }

  load(taskId: string): TaskState | null {
    try {
      const statePath = path.join(TASKS_DIR, taskId, 'state.json')
      if (!fs.existsSync(statePath)) return null
      return JSON.parse(fs.readFileSync(statePath, 'utf-8')) as TaskState
    } catch { return null }
  }

  save(state: TaskState): void {
    try {
      const taskDir  = path.join(TASKS_DIR, state.id)
      fs.mkdirSync(taskDir, { recursive: true })
      state.updatedAt = Date.now()
      // Atomic write — temp file then rename, avoids corruption on crash
      const statePath = path.join(taskDir, 'state.json')
      const tempPath  = path.join(taskDir, 'state.tmp.json')
      fs.writeFileSync(tempPath, JSON.stringify(state, null, 2))
      fs.renameSync(tempPath, statePath)
    } catch (e: any) {
      console.error(`[TaskState] Save failed for ${state.id}: ${e.message}`)
    }
  }

  startStep(state: TaskState, index: number, tool: string, input: any): void {
    const existing = state.steps.find(s => s.index === index)
    if (!existing) {
      state.steps.push({ index, tool, input, status: 'pending' })
    }
    state.currentStep = index
    this.save(state)
  }

  // NEVER overwrite a completed step — idempotency guard
  completeStep(state: TaskState, index: number, output: string, duration: number): void {
    const step = state.steps.find(s => s.index === index)
    if (step && step.status === 'completed') {
      console.log(`[TaskState] Step ${index} already completed — skipping overwrite`)
      return
    }
    if (step) {
      step.status      = 'completed'
      step.output      = output.slice(0, 2000) // cap stored output
      step.duration    = duration
      step.completedAt = Date.now()
    }
    // Estimate token usage — chars/4 is a reasonable approximation
    state.tokenUsage += Math.ceil(output.length / 4)
    this.save(state)
  }

  failStep(state: TaskState, index: number, error: string): void {
    const step = state.steps.find(s => s.index === index)
    if (step) {
      step.status      = 'failed'
      step.error       = error
      step.completedAt = Date.now()
    }
    this.save(state)
  }

  complete(state: TaskState): void {
    state.status      = 'completed'
    state.completedAt = Date.now()
    this.save(state)
  }

  fail(state: TaskState, error: string): void {
    state.status      = 'failed'
    state.error       = error
    state.completedAt = Date.now()
    this.save(state)
  }

  isStepCompleted(state: TaskState, index: number): boolean {
    const step = state.steps.find(s => s.index === index)
    return step?.status === 'completed'
  }

  isOverBudget(state: TaskState): boolean {
    return state.tokenUsage >= state.tokenLimit
  }

  // Find the first incomplete step index — used to find resume point after crash
  getResumePoint(state: TaskState): number {
    for (let i = 0; i < state.totalSteps; i++) {
      const step = state.steps.find(s => s.index === i)
      if (!step || step.status !== 'completed') return i
    }
    return state.totalSteps // all steps done
  }

  getRunningTasks(): TaskState[] {
    const running: TaskState[] = []
    try {
      if (!fs.existsSync(TASKS_DIR)) return []
      const dirs = fs.readdirSync(TASKS_DIR).filter(d => d.startsWith('task_'))
      for (const dir of dirs) {
        const state = this.load(dir)
        if (state && state.status === 'running') running.push(state)
      }
    } catch {}
    return running
  }

  listAll(): Partial<TaskState>[] {
    try {
      if (!fs.existsSync(TASKS_DIR)) return []
      return fs.readdirSync(TASKS_DIR)
        .filter(d => d.startsWith('task_'))
        .sort().reverse().slice(0, 20)
        .map(dir => {
          const state = this.load(dir)
          if (!state) return null
          return {
            id:          state.id,
            goal:        state.goal.slice(0, 80),
            status:      state.status,
            currentStep: state.currentStep,
            totalSteps:  state.totalSteps,
            tokenUsage:  state.tokenUsage,
            tokenLimit:  state.tokenLimit,
            createdAt:   state.createdAt,
            updatedAt:   state.updatedAt,
          }
        })
        .filter(Boolean) as Partial<TaskState>[]
    } catch { return [] }
  }
}

export const taskStateManager = new TaskStateManager()
