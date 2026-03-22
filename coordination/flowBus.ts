// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// coordination/flowBus.ts — System-wide task dispatch bus with no-double-execution guarantee

import * as fs     from 'fs'
import * as path   from 'path'
import * as crypto from 'crypto'
import { AgentRole } from '../agents/types'
import { eventBus }  from '../core/eventBus'

// ── Types ──────────────────────────────────────────────────────

export type FlowTaskStatus = 'queued' | 'claimed' | 'completed' | 'failed' | 'escalated'

export interface FlowTask {
  id:          string
  missionId?:  string
  title:       string
  description: string
  assignedTo?: AgentRole
  status:      FlowTaskStatus
  priority:    1 | 2 | 3
  isDangerous: boolean
  createdAt:   string
  claimedAt?:  string
  completedAt?: string
  result?:     any
  error?:      string
  retryCount:  number
}

// ── Constants ──────────────────────────────────────────────────

const DATA_FILE = path.join(process.cwd(), 'workspace', 'flowbus.json')

// ── FlowBus ────────────────────────────────────────────────────

class FlowBus {
  private tasks: Map<string, FlowTask> = new Map()

  constructor() {
    this._load()
  }

  // ── Persistence ────────────────────────────────────────────

  private _load(): void {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')) as FlowTask[]
        for (const t of raw) this.tasks.set(t.id, t)
        console.log(`[FlowBus] Loaded ${this.tasks.size} task(s)`)
      }
    } catch { /* start fresh */ }
  }

  private _save(): void {
    try {
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
      fs.writeFileSync(DATA_FILE, JSON.stringify([...this.tasks.values()], null, 2), 'utf-8')
    } catch (err: any) {
      console.warn(`[FlowBus] Save failed: ${err?.message}`)
    }
  }

  // ── Enqueue ────────────────────────────────────────────────

  enqueue(
    tasks: Omit<FlowTask, 'id' | 'status' | 'createdAt' | 'retryCount'>[],
  ): FlowTask[] {
    const created: FlowTask[] = []
    for (const t of tasks) {
      const task: FlowTask = {
        ...t,
        id:         crypto.randomUUID(),
        status:     'queued',
        createdAt:  new Date().toISOString(),
        retryCount: 0,
      }
      this.tasks.set(task.id, task)
      created.push(task)
    }
    this._save()
    console.log(`[FlowBus] Enqueued ${created.length} task(s)`)
    return created
  }

  // ── Claim — returns false if already claimed (no double-execution) ──

  claim(taskId: string, role: AgentRole): boolean {
    const task = this.tasks.get(taskId)
    if (!task) {
      console.warn(`[FlowBus] claim: task not found: ${taskId}`)
      return false
    }
    if (task.status !== 'queued') {
      console.warn(`[FlowBus] claim: task ${taskId} already ${task.status} — skipping`)
      return false
    }
    task.status     = 'claimed'
    task.assignedTo = role
    task.claimedAt  = new Date().toISOString()
    this._save()
    console.log(`[FlowBus] 🔒 Claimed task ${taskId.slice(0, 8)} by ${role}`)
    return true
  }

  // ── Complete ───────────────────────────────────────────────

  complete(taskId: string, result: any): void {
    const task = this.tasks.get(taskId)
    if (!task) return
    task.status      = 'completed'
    task.result      = result
    task.completedAt = new Date().toISOString()
    this._save()
    eventBus.emit('task_completed', { taskId, missionId: task.missionId, result })
    console.log(`[FlowBus] ✅ Completed: ${task.title}`)
  }

  // ── Fail ───────────────────────────────────────────────────

  fail(taskId: string, reason: string): void {
    const task = this.tasks.get(taskId)
    if (!task) return
    task.status = 'failed'
    task.error  = reason
    task.retryCount++
    this._save()
    eventBus.emit('task_failed', { taskId, missionId: task.missionId, reason })
    console.log(`[FlowBus] ❌ Failed: ${task.title} — ${reason}`)
  }

  // ── Escalate ───────────────────────────────────────────────

  escalate(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (!task) return
    task.status = 'escalated'
    this._save()
    eventBus.emit('approval_required', {
      taskId,
      missionId:         task.missionId,
      actionDescription: task.title,
      reason:            `Task escalated after ${task.retryCount} attempts`,
    })
    console.log(`[FlowBus] ⚠️  Escalated: ${task.title}`)
  }

  // ── Queue reads ────────────────────────────────────────────

  /** All tasks (optionally filtered by missionId) */
  getQueue(missionId?: string): FlowTask[] {
    const all = [...this.tasks.values()]
    return missionId ? all.filter(t => t.missionId === missionId) : all
  }

  /** Next queued task for a mission (highest priority first) */
  getNext(missionId?: string): FlowTask | null {
    const queued = [...this.tasks.values()]
      .filter(t => t.status === 'queued' && (!missionId || t.missionId === missionId))
      .sort((a, b) => a.priority - b.priority)
    return queued[0] ?? null
  }

  getPending(missionId?: string): FlowTask[] {
    return [...this.tasks.values()].filter(
      t => (t.status === 'queued' || t.status === 'claimed')
        && (!missionId || t.missionId === missionId),
    )
  }

  getById(taskId: string): FlowTask | null {
    return this.tasks.get(taskId) ?? null
  }

  /** Release a claimed task back to queued (e.g. on agent crash) */
  release(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (!task || task.status !== 'claimed') return
    task.status    = 'queued'
    task.claimedAt = undefined
    this._save()
    console.log(`[FlowBus] 🔓 Released: ${taskId.slice(0, 8)}`)
  }
}

export const flowBus = new FlowBus()
