// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/asyncTasks.ts — Background task execution with completion notifications.
//
// Usage:
//   const task = asyncTasks.spawn('research top AI frameworks 2026')
//   // returns immediately; task runs in background
//   // emits callbacks.async_complete when done → forwarded to all open SSE clients

import { planWithLLM, executePlan, respondWithResults } from './agentLoop'
import type { StepResult, ToolStep }                    from './agentLoop'
import { getModelForTask }                              from '../providers/router'
import { conversationMemory }                           from './conversationMemory'
import { callbacks }                                    from './callbackSystem'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AsyncTask {
  id:           string
  prompt:       string
  status:       'running' | 'complete' | 'failed'
  startedAt:    number
  completedAt?: number
  result?:      string
  error?:       string
}

// ── Manager ───────────────────────────────────────────────────────────────────

class AsyncTaskManager {
  private tasks: Map<string, AsyncTask> = new Map()

  /**
   * Spawn a new background task. Returns the task record immediately;
   * execution runs asynchronously. A `callbacks.async_complete` event
   * fires when it finishes (success or failure).
   */
  spawn(prompt: string): AsyncTask {
    const id   = `async_${Date.now()}`
    const task: AsyncTask = { id, prompt, status: 'running', startedAt: Date.now() }
    this.tasks.set(id, task)

    // Fire-and-forget — top-level error captured here so it never becomes an
    // unhandled rejection; execute() also updates the task internally on throw.
    this.execute(task).catch(() => { /* task already marked failed inside execute */ })

    return task
  }

  private async execute(task: AsyncTask): Promise<void> {
    const start = task.startedAt

    try {
      const planner   = getModelForTask('planner')
      const responder = getModelForTask('responder')
      const memCtx    = conversationMemory.buildContext()

      // ── Step 1: Plan ────────────────────────────────────────────
      const plan = await planWithLLM(
        task.prompt, [], planner.apiKey, planner.model, planner.providerName, memCtx,
      )

      // ── Step 2: Execute ─────────────────────────────────────────
      const results: StepResult[] = plan.requires_execution && plan.plan.length > 0
        ? await executePlan(plan, (_step: ToolStep, _result: StepResult) => { /* silent */ })
        : []

      // ── Step 3: Respond ─────────────────────────────────────────
      const tokens: string[] = []
      await respondWithResults(
        task.prompt, plan, results, [], 'User',
        responder.apiKey, responder.model, responder.providerName,
        (t) => tokens.push(t),
      )

      task.result      = tokens.join('').trim()
      task.status      = 'complete'
      task.completedAt = Date.now()

    } catch (err: any) {
      task.status      = 'failed'
      task.error       = err?.message || String(err)
      task.completedAt = Date.now()
      // re-throw so the spawn() .catch() fires for logging
      throw err
    } finally {
      // Notify all open SSE clients regardless of success/failure
      await callbacks.emit('async_complete', 'async', {
        taskId:  task.id,
        status:  task.status,
        elapsed: Date.now() - start,
        preview: (task.result || task.error || '').slice(0, 200),
      })
    }
  }

  /** Return all tasks (running, complete, failed). */
  list(): AsyncTask[] {
    return Array.from(this.tasks.values()).sort((a, b) => b.startedAt - a.startedAt)
  }

  /** Return a single task by ID, or undefined if not found. */
  get(id: string): AsyncTask | undefined {
    return this.tasks.get(id)
  }
}

export const asyncTasks = new AsyncTaskManager()
