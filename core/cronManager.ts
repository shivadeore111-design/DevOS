// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
//
// core/cronManager.ts — Lightweight scheduled task engine.
//
// Supports natural-language schedules: "every 5 minutes", "hourly", "daily".
// Jobs are persisted to ~/.aiden/cron_jobs.json and restored on startup.
// Uses setInterval — no external cron dependency required.

import * as fs   from 'fs'
import * as path from 'path'
import * as os   from 'os'

export interface CronJob {
  id:          string
  description: string
  schedule:    string          // human-readable schedule string
  intervalMs:  number          // resolved interval in milliseconds
  action:      string          // shell command to execute
  enabled:     boolean
  createdAt:   string
  lastRun?:    string
  nextRun?:    string
  runCount:    number
}

// ── In-memory registry ────────────────────────────────────────────────────────

const jobs:   Map<string, CronJob>                         = new Map()
const timers: Map<string, ReturnType<typeof setInterval>>  = new Map()
let   jobSeq = 1

// ── Persistence ───────────────────────────────────────────────────────────────

const DATA_DIR  = path.join(os.homedir(), '.aiden')
const DATA_FILE = path.join(DATA_DIR, 'cron_jobs.json')

function save(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(DATA_FILE, JSON.stringify(Array.from(jobs.values()), null, 2), 'utf8')
  } catch { /* silent */ }
}

export function loadJobs(): void {
  try {
    if (!fs.existsSync(DATA_FILE)) return
    const data: CronJob[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
    for (const job of data) {
      jobs.set(job.id, job)
      const num = parseInt(job.id, 10)
      if (!isNaN(num) && num >= jobSeq) jobSeq = num + 1
      if (job.enabled) _scheduleJob(job)
    }
  } catch { /* silent */ }
}

// ── Schedule parser ───────────────────────────────────────────────────────────
// Parses: "every N seconds/minutes/hours/days", "hourly", "daily", numeric ms

export function parseSchedule(schedule: string): number {
  const s = schedule.trim().toLowerCase()

  const match = s.match(/every\s+(\d+)\s+(second|seconds|minute|minutes|hour|hours|day|days)/)
  if (match) {
    const n = parseInt(match[1], 10)
    const unit = match[2].replace(/s$/, '')
    if (unit === 'second') return n * 1000
    if (unit === 'minute') return n * 60_000
    if (unit === 'hour')   return n * 3_600_000
    if (unit === 'day')    return n * 86_400_000
  }
  if (s === 'every minute') return 60_000
  if (s === 'hourly')       return 3_600_000
  if (s === 'daily')        return 86_400_000

  // Numeric ms fallback
  const ms = parseInt(s, 10)
  if (!isNaN(ms) && ms > 0) return ms

  return 3_600_000  // default: 1 hour
}

// ── Internal scheduler ────────────────────────────────────────────────────────

function _scheduleJob(job: CronJob): void {
  if (timers.has(job.id)) return   // already scheduled

  const handle = setInterval(async () => {
    try {
      const { executeTool } = await import('./toolRegistry')
      job.lastRun  = new Date().toISOString()
      job.nextRun  = new Date(Date.now() + job.intervalMs).toISOString()
      job.runCount++
      jobs.set(job.id, { ...job })
      save()
      await executeTool('shell_exec', { command: job.action }, 0)
    } catch { /* silent — job errors should not crash the process */ }
  }, job.intervalMs)

  // Allow Node.js to exit even if jobs are pending
  if (typeof (handle as any).unref === 'function') (handle as any).unref()
  timers.set(job.id, handle)
}

// ── Public API ────────────────────────────────────────────────────────────────

export function createJob(
  description: string,
  schedule:    string,
  action:      string,
): CronJob {
  const intervalMs = parseSchedule(schedule)
  const job: CronJob = {
    id:          String(jobSeq++),
    description,
    schedule,
    intervalMs,
    action,
    enabled:     true,
    createdAt:   new Date().toISOString(),
    nextRun:     new Date(Date.now() + intervalMs).toISOString(),
    runCount:    0,
  }
  jobs.set(job.id, job)
  _scheduleJob(job)
  save()
  return job
}

export function listJobs(): CronJob[] {
  return Array.from(jobs.values())
}

export function getJob(id: string): CronJob | undefined {
  return jobs.get(id)
}

export function pauseJob(id: string): boolean {
  const job = jobs.get(id)
  if (!job) return false
  job.enabled = false
  const handle = timers.get(id)
  if (handle) { clearInterval(handle); timers.delete(id) }
  jobs.set(id, { ...job })
  save()
  return true
}

export function resumeJob(id: string): boolean {
  const job = jobs.get(id)
  if (!job) return false
  job.enabled = true
  job.nextRun = new Date(Date.now() + job.intervalMs).toISOString()
  jobs.set(id, { ...job })
  _scheduleJob(job)
  save()
  return true
}

export function deleteJob(id: string): boolean {
  if (!jobs.has(id)) return false
  const handle = timers.get(id)
  if (handle) { clearInterval(handle); timers.delete(id) }
  jobs.delete(id)
  save()
  return true
}

export async function triggerJob(id: string): Promise<boolean> {
  const job = jobs.get(id)
  if (!job) return false
  try {
    const { executeTool } = await import('./toolRegistry')
    job.lastRun  = new Date().toISOString()
    job.runCount++
    jobs.set(id, { ...job })
    save()
    await executeTool('shell_exec', { command: job.action }, 0)
    return true
  } catch {
    return false
  }
}
