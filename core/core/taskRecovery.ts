// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/taskRecovery.ts — On-startup task cleanup.
//
// Strategy (Sprint 55):
//   - Tasks older than 2 hours → mark failed, don't attempt re-execution
//   - Tasks stuck in 'running' but <2 hours old → log for user retry (no auto-resume)
//   - Corrupt state files → mark failed
//
// Auto-resume was removed because recovered plans have input:{} on most steps
// (plan metadata stored phase names/tools but not original inputs).
// Re-executing empty inputs causes noisy failures worse than the original crash.

import { taskStateManager } from './taskState'
import path                 from 'path'
import fs                   from 'fs'

const TASKS_DIR          = path.join(process.cwd(), 'workspace', 'tasks')
const MAX_TASK_AGE_MS    = 2 * 60 * 60 * 1000  // 2 hours

export async function recoverTasks(): Promise<void> {
  if (!fs.existsSync(TASKS_DIR)) {
    console.log('[Recovery] No task directory found — skipping')
    return
  }

  let taskDirs: string[]
  try {
    taskDirs = fs.readdirSync(TASKS_DIR).filter(d => {
      try { return fs.statSync(path.join(TASKS_DIR, d)).isDirectory() }
      catch { return false }
    })
  } catch (e: any) {
    console.error(`[Recovery] Cannot read tasks directory: ${e.message}`)
    return
  }

  let recovered   = 0
  let cleaned     = 0
  let corrupted   = 0

  for (const taskId of taskDirs) {
    const statePath = path.join(TASKS_DIR, taskId, 'state.json')
    if (!fs.existsSync(statePath)) continue

    let state: any
    try {
      state = JSON.parse(fs.readFileSync(statePath, 'utf-8'))
    } catch {
      // Corrupt state file — overwrite with failed status
      corrupted++
      try {
        const tmp = statePath + '.tmp'
        fs.writeFileSync(tmp, JSON.stringify({
          id:        taskId,
          status:    'failed',
          error:     'Corrupt state file — overwritten on startup',
          createdAt: 0,
          updatedAt: Date.now(),
        }, null, 2))
        // NTFS-safe rename attempt — fall back to direct write on error
        try { fs.renameSync(tmp, statePath) }
        catch { fs.writeFileSync(statePath, fs.readFileSync(tmp, 'utf-8')); try { fs.unlinkSync(tmp) } catch {} }
      } catch {}
      continue
    }

    // Skip already-terminal tasks
    if (state.status === 'completed' || state.status === 'failed') continue

    // Only act on tasks stuck in 'running'
    if (state.status !== 'running') continue

    const age = Date.now() - (state.createdAt || 0)

    if (age > MAX_TASK_AGE_MS) {
      // Expired — mark failed and move on
      state.status      = 'failed'
      state.error       = `Task expired — exceeded ${MAX_TASK_AGE_MS / 60000} minute limit`
      state.completedAt = Date.now()
      cleaned++
      try {
        const tmp = statePath + '.tmp'
        fs.writeFileSync(tmp, JSON.stringify(state, null, 2))
        try { fs.renameSync(tmp, statePath) }
        catch { fs.writeFileSync(statePath, JSON.stringify(state, null, 2)); try { fs.unlinkSync(tmp) } catch {} }
      } catch {}
      console.log(`[Recovery] Expired task cleaned: ${taskId} (age: ${Math.round(age / 60000)}m)`)

    } else {
      // Recent interrupted task — log it, don't auto-resume
      // (User can retry via the API; auto-resume risks duplicate side effects)
      recovered++
      const stepsDone  = (state.steps || []).filter((s: any) => s.status === 'completed').length
      const totalSteps = state.totalSteps || 0
      console.log(`[Recovery] Interrupted task found: ${taskId}`)
      console.log(`           Goal: "${(state.goal || '').slice(0, 60)}"`)
      console.log(`           Progress: ${stepsDone}/${totalSteps} steps, age: ${Math.round(age / 60000)}m`)
      console.log(`           Status kept as 'running' — user can retry via the API`)
    }
  }

  // Summary
  if (recovered > 0) {
    console.log(`[Recovery] ${recovered} interrupted task(s) available for retry`)
  }
  if (cleaned > 0) {
    console.log(`[Recovery] Cleaned ${cleaned} expired/stale task(s)`)
  }
  if (corrupted > 0) {
    console.log(`[Recovery] Reset ${corrupted} corrupt task state file(s)`)
  }
  if (recovered === 0 && cleaned === 0 && corrupted === 0) {
    console.log('[Recovery] No interrupted tasks found')
  }
}
