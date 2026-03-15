// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// coordination/taskBus.ts — Central task queue for autonomous missions

import * as fs   from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

export type TaskPriority  = 1 | 2 | 3
export type TaskBusStatus = 'queued' | 'claimed' | 'completed' | 'failed'

export interface BusTask {
  id:          string
  missionId:   string
  title:       string
  description: string
  assignedTo:  string       // agent role
  priority:    TaskPriority
  status:      TaskBusStatus
  isDangerous: boolean
  createdAt:   string
  claimedAt?:  string
  completedAt?: string
  result?:     string
  error?:      string
  retryCount:  number
}

const DATA_FILE = path.join(process.cwd(), 'workspace', 'task-bus.json')

class TaskBus {
  private tasks: Map<string, BusTask> = new Map()

  constructor() {
    this.load()
  }

  private load(): void {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')) as BusTask[]
        for (const t of raw) this.tasks.set(t.id, t)
        console.log(`[TaskBus] Loaded ${this.tasks.size} tasks`)
      }
    } catch { /* start fresh */ }
  }

  private save(): void {
    try {
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
      fs.writeFileSync(DATA_FILE, JSON.stringify([...this.tasks.values()], null, 2))
    } catch (err: any) {
      console.warn(`[TaskBus] Save failed: ${err?.message}`)
    }
  }

  enqueue(
    missionId: string,
    tasks: Omit<BusTask, 'id' | 'status' | 'createdAt' | 'retryCount'>[],
  ): BusTask[] {
    const created: BusTask[] = []
    for (const t of tasks) {
      const busTask: BusTask = {
        ...t,
        id:         crypto.randomUUID(),
        missionId,
        status:     'queued',
        createdAt:  new Date().toISOString(),
        retryCount: 0,
      }
      this.tasks.set(busTask.id, busTask)
      created.push(busTask)
    }
    this.save()
    return created
  }

  /** Return highest-priority queued task for a mission */
  getNext(missionId: string): BusTask | null {
    const queued = [...this.tasks.values()]
      .filter(t => t.missionId === missionId && t.status === 'queued')
      .sort((a, b) => a.priority - b.priority)
    return queued[0] ?? null
  }

  claim(taskId: string, agentRole: string): void {
    const task = this.tasks.get(taskId)
    if (!task) return
    task.status    = 'claimed'
    task.claimedAt = new Date().toISOString()
    task.assignedTo = agentRole
    this.save()
  }

  complete(taskId: string, result: string): void {
    const task = this.tasks.get(taskId)
    if (!task) return
    task.status      = 'completed'
    task.completedAt = new Date().toISOString()
    task.result      = result
    this.save()
  }

  fail(taskId: string, error: string): void {
    const task = this.tasks.get(taskId)
    if (!task) return
    task.status = 'failed'
    task.error  = error
    this.save()
  }

  getQueue(missionId: string): BusTask[] {
    return [...this.tasks.values()].filter(t => t.missionId === missionId)
  }

  getPending(missionId: string): BusTask[] {
    return [...this.tasks.values()].filter(
      t => t.missionId === missionId && (t.status === 'queued' || t.status === 'claimed')
    )
  }

  getCompleted(missionId: string): BusTask[] {
    return [...this.tasks.values()].filter(
      t => t.missionId === missionId && t.status === 'completed'
    )
  }
}

export const taskBus = new TaskBus()
