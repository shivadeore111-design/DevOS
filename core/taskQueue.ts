// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/taskQueue.ts — Persistent async task queue.
// Tasks from API, Telegram, or the scheduler are enqueued here
// and processed sequentially by posting to the chat endpoint.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname }                                       from 'path'

// ── Types ─────────────────────────────────────────────────────

export interface QueuedTask {
  id:           string
  source:       'telegram' | 'api' | 'dashboard' | 'schedule'
  message:      string
  priority:     'low' | 'normal' | 'high'
  status:       'queued' | 'running' | 'completed' | 'failed'
  createdAt:    string
  startedAt?:   string
  completedAt?: string
  result?:      string
  error?:       string
  chatId?:      string | number
}

// ── TaskQueue class ───────────────────────────────────────────

class TaskQueue {
  private queue:        QueuedTask[] = []
  private isProcessing  = false
  private savePath:     string
  private chatEndpoint: string

  constructor(workspaceDir: string, chatEndpoint: string) {
    this.savePath     = join(workspaceDir, 'task_queue.json')
    this.chatEndpoint = chatEndpoint
    this.load()
    // Re-queue any tasks that were mid-flight when process stopped
    for (const task of this.queue) {
      if (task.status === 'running') {
        task.status = 'queued'
      }
    }
    if (this.queue.some(t => t.status === 'queued')) {
      console.log(`[Queue] Resuming ${this.queue.filter(t => t.status === 'queued').length} queued task(s) from previous session`)
      setTimeout(() => this.processNext(), 2000) // short delay to let server finish starting
    }
  }

  // ── Enqueue ───────────────────────────────────────────────

  enqueue(task: Omit<QueuedTask, 'id' | 'status' | 'createdAt'>): string {
    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    this.queue.push({
      ...task,
      id,
      status:    'queued',
      createdAt: new Date().toISOString(),
    })
    this.save()
    console.log(`[Queue] Enqueued: ${id} from ${task.source}: "${task.message.substring(0, 50)}"`)
    setTimeout(() => this.processNext(), 100)
    return id
  }

  // ── Process next queued task ──────────────────────────────

  private async processNext(): Promise<void> {
    if (this.isProcessing) return
    const next = this.queue.find(t => t.status === 'queued')
    if (!next) return

    this.isProcessing    = true
    next.status          = 'running'
    next.startedAt       = new Date().toISOString()
    this.save()

    console.log(`[Queue] Processing: ${next.id}: "${next.message.substring(0, 50)}"`)

    try {
      const response = await fetch(this.chatEndpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          message:   next.message,
          sessionId: `dispatch_${next.id}`,
        }),
        signal: AbortSignal.timeout(120_000), // 2 min cap per queued task
      })

      if (!response.ok) throw new Error(`HTTP ${response.status} from chat endpoint`)

      const data        = await response.json() as any
      next.status       = 'completed'
      next.completedAt  = new Date().toISOString()
      next.result       = data.response || data.message || JSON.stringify(data).slice(0, 500)
      console.log(`[Queue] Completed: ${next.id} — "${String(next.result).slice(0, 60)}"`)
    } catch (e: any) {
      next.status      = 'failed'
      next.completedAt = new Date().toISOString()
      next.error       = e.message
      console.log(`[Queue] Failed: ${next.id}: ${e.message}`)
    }

    this.save()
    this.isProcessing = false
    // Continue with next item if any
    setTimeout(() => this.processNext(), 50)
  }

  // ── Query helpers ─────────────────────────────────────────

  getStatus(id: string): QueuedTask | undefined {
    return this.queue.find(t => t.id === id)
  }

  getPending(): QueuedTask[] {
    return this.queue.filter(t => t.status === 'queued' || t.status === 'running')
  }

  getRecent(n = 10): QueuedTask[] {
    return [...this.queue]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, n)
  }

  // ── Persistence ───────────────────────────────────────────

  private load(): void {
    try {
      if (existsSync(this.savePath)) {
        this.queue = JSON.parse(readFileSync(this.savePath, 'utf8')) as QueuedTask[]
      }
    } catch {
      this.queue = []
    }
  }

  private save(): void {
    try {
      mkdirSync(dirname(this.savePath), { recursive: true })
      writeFileSync(this.savePath, JSON.stringify(this.queue, null, 2))
    } catch {}
  }
}

// ── Singleton — chat endpoint matches api/server.ts port default ──
export const taskQueue = new TaskQueue(
  join(process.cwd(), 'workspace'),
  'http://localhost:4200/api/chat',
)
