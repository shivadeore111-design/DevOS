// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/scheduler.ts — Natural-language scheduled task engine.
// Converts human schedules ("every monday at 9am") to cron expressions,
// fires tasks against the local /api/chat endpoint, and persists state.

import fs   from 'fs'
import path from 'path'
import { loadBriefingConfig, deliverBriefing } from './morningBriefing'
import { checkAndRunDream } from './dreamEngine'

const TASKS_PATH     = path.join(process.cwd(), 'workspace', 'scheduled-tasks.json')
const HEARTBEAT_PATH = path.join(process.cwd(), 'workspace', 'HEARTBEAT.md')

// ── Feature 8: HEARTBEAT.md config loader ─────────────────────

function loadHeartbeatConfig(): void {
  try {
    if (!fs.existsSync(HEARTBEAT_PATH)) return
    const content  = fs.readFileSync(HEARTBEAT_PATH, 'utf-8')
    const sections = content.split(/^## /m).slice(1)
    for (const section of sections) {
      const title = section.split('\n')[0]
      const scheduleMatch = title.match(/\((.+)\)/)
      if (!scheduleMatch) continue
      console.log(`[Heartbeat] Loaded: ${title.split('(')[0].trim()}`)
    }
  } catch (e: any) {
    console.warn(`[Heartbeat] Could not load HEARTBEAT.md: ${e.message}`)
  }
}

// ── Types ──────────────────────────────────────────────────────

export interface ScheduledTask {
  id:            string
  description:   string
  schedule:      string        // natural language: "every monday at 9am"
  cronExpression:string        // computed from schedule
  goal:          string        // what to tell Aiden to do
  enabled:       boolean
  lastRun?:      number
  nextRun?:      number
  createdAt:     number
}

// ── Natural-language → cron converter ─────────────────────────

export function naturalToCron(schedule: string): string {
  const s = schedule.toLowerCase().trim()

  // ── Time extraction helper ────────────────────────────
  const extractHour = (str: string): number | null => {
    const m = str.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/)
    if (!m) return null
    let hour = parseInt(m[1], 10)
    const ampm = m[3]
    if (ampm === 'pm' && hour !== 12) hour += 12
    if (ampm === 'am' && hour === 12) hour = 0
    return hour
  }

  const extractMinute = (str: string): number => {
    const m = str.match(/\d{1,2}:(\d{2})/)
    return m ? parseInt(m[1], 10) : 0
  }

  // ── Every N minutes ───────────────────────────────────
  const everyMin = s.match(/every\s+(\d+)\s*min/)
  if (everyMin) return `*/${everyMin[1]} * * * *`

  // ── Every hour ────────────────────────────────────────
  if (/every\s+hour/.test(s)) return '0 * * * *'

  // ── Every 30 minutes ─────────────────────────────────
  if (/every\s+30/.test(s)) return '*/30 * * * *'

  // ── Daily / every day ────────────────────────────────
  if (/every\s+day|daily/.test(s)) {
    const h = extractHour(s) ?? 8
    const m = extractMinute(s)
    return `${m} ${h} * * *`
  }

  // ── Weekdays ─────────────────────────────────────────
  const DAY_MAP: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
  }
  for (const [dayName, dayNum] of Object.entries(DAY_MAP)) {
    if (s.includes(dayName)) {
      const h = extractHour(s) ?? 9
      const m = extractMinute(s)
      return `${m} ${h} * * ${dayNum}`
    }
  }

  // ── Weekdays (Mon–Fri) ────────────────────────────────
  if (/weekday/.test(s)) {
    const h = extractHour(s) ?? 9
    const m = extractMinute(s)
    return `${m} ${h} * * 1-5`
  }

  // ── Weekly ───────────────────────────────────────────
  if (/weekly|every\s+week/.test(s)) {
    const h = extractHour(s) ?? 9
    return `0 ${h} * * 1`   // Monday by default
  }

  // ── Monthly ──────────────────────────────────────────
  if (/monthly|every\s+month/.test(s)) {
    const h = extractHour(s) ?? 9
    return `0 ${h} 1 * *`   // 1st of month
  }

  // ── Fallback: 9am daily ───────────────────────────────
  return '0 9 * * *'
}

// ── Cron match checker ─────────────────────────────────────────
// Parses a cron expression and tests it against the current time.

function cronMatchesNow(cronExpr: string): boolean {
  const parts = cronExpr.split(' ')
  if (parts.length < 5) return false
  const [minutePart, hourPart, , , dayOfWeekPart] = parts
  const now = new Date()

  const matchField = (field: string, value: number): boolean => {
    if (field === '*') return true
    if (field.startsWith('*/')) {
      const step = parseInt(field.slice(2), 10)
      return value % step === 0
    }
    if (field.includes('-')) {
      const [lo, hi] = field.split('-').map(Number)
      return value >= lo && value <= hi
    }
    return parseInt(field, 10) === value
  }

  return (
    matchField(minutePart,    now.getMinutes())  &&
    matchField(hourPart,      now.getHours())    &&
    matchField(dayOfWeekPart, now.getDay())
  )
}

// ── Scheduler class ────────────────────────────────────────────

export class Scheduler {
  private tasks:     ScheduledTask[]             = []
  private intervals: Map<string, NodeJS.Timeout> = new Map()

  constructor() {
    this.load()
    this.registerDreamSchedule()
    loadHeartbeatConfig()
  }

  // ── Public API ─────────────────────────────────────────

  add(description: string, schedule: string, goal: string): ScheduledTask {
    const task: ScheduledTask = {
      id:             `task_${Date.now()}`,
      description,
      schedule,
      cronExpression: naturalToCron(schedule),
      goal,
      enabled:        true,
      createdAt:      Date.now(),
    }
    this.tasks.push(task)
    this.save()
    this.scheduleTask(task)
    console.log(`[Scheduler] Added: "${description}" (${task.cronExpression})`)
    return task
  }

  remove(id: string): boolean {
    const interval = this.intervals.get(id)
    if (interval) { clearInterval(interval); this.intervals.delete(id) }
    const before = this.tasks.length
    this.tasks = this.tasks.filter(t => t.id !== id)
    this.save()
    return this.tasks.length < before
  }

  toggle(id: string, enabled: boolean): boolean {
    const task = this.tasks.find(t => t.id === id)
    if (!task) return false
    task.enabled = enabled
    this.save()
    return true
  }

  list(): ScheduledTask[] {
    return this.tasks
  }

  // ── Dream Engine: check every 6 hours ─────────────────

  registerDreamSchedule(): void {
    // Run once 30s after startup
    setTimeout(() => {
      checkAndRunDream()
    }, 30_000)

    // Then every 6 hours
    setInterval(() => {
      checkAndRunDream()
    }, 6 * 60 * 60 * 1000)

    console.log('[Scheduler] Dream engine scheduled (every 6h, startup+30s)')
  }

  // ── Sprint 25: morning briefing registration ────────────

  registerMorningBriefing(): void {
    const config = loadBriefingConfig()

    // Always remove any existing briefing task first
    const existing = this.tasks.find(t => t.id === 'morning_briefing')
    if (existing) this.remove('morning_briefing')

    if (!config.enabled) return

    const [hourStr, minuteStr] = config.time.split(':')
    const hour   = parseInt(hourStr   ?? '8',  10)
    const minute = parseInt(minuteStr ?? '0', 10)

    const task: ScheduledTask = {
      id:             'morning_briefing',
      description:    'Morning briefing',
      schedule:       `every day at ${config.time}`,
      cronExpression: `${minute} ${hour} * * *`,
      goal:           '__morning_briefing__',
      enabled:        true,
      createdAt:      Date.now(),
    }
    this.tasks.push(task)
    this.save()
    this.scheduleTask(task)
    console.log(`[Scheduler] Morning briefing registered at ${config.time}`)
  }

  // ── Internal ───────────────────────────────────────────

  private scheduleTask(task: ScheduledTask): void {
    // Poll every minute and fire when cron expression matches current time
    const interval = setInterval(() => {
      if (!task.enabled) return
      if (this.shouldRun(task)) {
        task.lastRun = Date.now()
        this.save()
        this.runTask(task).catch(e =>
          console.error(`[Scheduler] Task "${task.description}" threw: ${e.message}`)
        )
      }
    }, 60 * 1000)

    this.intervals.set(task.id, interval)
  }

  private shouldRun(task: ScheduledTask): boolean {
    // Must not have run in the last 55 minutes (prevents double-fire within same minute tick)
    const notRunRecently = !task.lastRun || (Date.now() - task.lastRun) > 55 * 60 * 1000
    return notRunRecently && cronMatchesNow(task.cronExpression)
  }

  private async runTask(task: ScheduledTask): Promise<void> {
    console.log(`[Scheduler] Running task: "${task.description}"`)

    // ── Sprint 25: morning briefing special marker ────────
    if (task.goal === '__morning_briefing__') {
      try {
        const config = loadBriefingConfig()
        await deliverBriefing(config)
        console.log(`[Scheduler] Morning briefing delivered`)
      } catch (e: any) {
        console.error(`[Scheduler] Morning briefing failed: ${e.message}`)
      }
      return
    }

    try {
      const res = await fetch('http://localhost:4200/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: task.goal, history: [] }),
        signal:  AbortSignal.timeout(120_000),   // 2-minute cap per scheduled task
      })
      if (res.ok) {
        console.log(`[Scheduler] Task complete: "${task.description}"`)
      } else {
        console.warn(`[Scheduler] Task HTTP ${res.status}: "${task.description}"`)
      }
    } catch (e: any) {
      console.error(`[Scheduler] Task failed: "${task.description}" — ${e.message}`)
    }
  }

  private load(): void {
    try {
      if (!fs.existsSync(TASKS_PATH)) return
      const raw  = fs.readFileSync(TASKS_PATH, 'utf-8')
      this.tasks = JSON.parse(raw) as ScheduledTask[]
      const enabled = this.tasks.filter(t => t.enabled)
      enabled.forEach(t => this.scheduleTask(t))
      if (enabled.length > 0) {
        console.log(`[Scheduler] Loaded ${this.tasks.length} task(s), ${enabled.length} active`)
      }
    } catch (e: any) {
      console.warn(`[Scheduler] Failed to load tasks: ${e.message}`)
      this.tasks = []
    }
  }

  private save(): void {
    try {
      fs.mkdirSync(path.dirname(TASKS_PATH), { recursive: true })
      fs.writeFileSync(TASKS_PATH, JSON.stringify(this.tasks, null, 2))
    } catch (e: any) {
      console.warn(`[Scheduler] Failed to save tasks: ${e.message}`)
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────
export const scheduler = new Scheduler()
