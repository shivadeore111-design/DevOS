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
import { getActiveGoalsSummary } from './goalTracker'
import { detectPatterns, getPatternSummary } from './patternDetector'

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
    this.registerHeartbeatSchedule()
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

  // ── Feature 16: HEARTBEAT_OK suppression pattern ──────────────
  // Runs every 30 min during active hours (8 AM–11 PM).
  // Uses local Ollama (zero API cost). Silent unless alert found.

  registerHeartbeatSchedule(): void {
    async function runHeartbeat(): Promise<void> {
      const hour         = new Date().getHours()
      const ACTIVE_START = 8
      const ACTIVE_END   = 23
      if (hour < ACTIVE_START || hour >= ACTIVE_END) return
      if (!fs.existsSync(HEARTBEAT_PATH)) return

      const checklist = fs.readFileSync(HEARTBEAT_PATH, 'utf-8').trim()
      if (!checklist) return

      // Build heartbeat prompt: checklist + active goals + patterns
      let heartbeatPrompt = checklist

      const goalsSummary = getActiveGoalsSummary()
      if (goalsSummary) heartbeatPrompt += '\n\n' + goalsSummary

      try {
        const patterns       = await detectPatterns()
        const patternSummary = getPatternSummary(patterns)
        if (patternSummary) heartbeatPrompt += '\n\n' + patternSummary
      } catch { /* pattern detection is non-critical */ }

      console.log('[Heartbeat] Running checks...')
      try {
        const resp = await fetch('http://localhost:11434/api/chat', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model:  'llama3.2:latest',
            stream: false,
            messages: [
              {
                role:    'system',
                content: "You are Aiden running a background heartbeat. Check the items in the list. If NOTHING needs the user's attention, reply ONLY: HEARTBEAT_OK\nIf something IS urgent or interesting, describe it in 1-2 sentences. Do NOT include HEARTBEAT_OK if you have alerts.",
              },
              { role: 'user', content: heartbeatPrompt },
            ],
          }),
          signal: AbortSignal.timeout(30_000),
        })

        if (!resp.ok) { console.log('[Heartbeat] Ollama unavailable — skipping'); return }

        const data     = await resp.json() as any
        const response = (data?.message?.content || '') as string
        const cleaned  = response.replace(/HEARTBEAT_OK/gi, '').trim()

        if (!cleaned || cleaned.length < 10) {
          console.log('[Heartbeat] All clear')
          return
        }

        console.log('[Heartbeat] Alert:', cleaned)

        // Deliver alert via API server (non-blocking)
        fetch('http://localhost:4200/api/chat', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ message: `notify user with desktop alert: ${cleaned}` }),
          signal:  AbortSignal.timeout(10_000),
        }).catch(() => { /* server may not be up yet */ })
      } catch (e: any) {
        console.log('[Heartbeat] Check skipped:', e.message)
      }
    }

    // Run 60s after startup, then every 30 minutes
    setTimeout(() => runHeartbeat(), 60_000)
    setInterval(() => runHeartbeat(), 30 * 60 * 1000)
    console.log('[Heartbeat] Scheduled (every 30m, active hours 8 AM–11 PM)')
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

  private static readonly TASK_TIMEOUT_MS = 5 * 60 * 1000  // 5-minute dead-man switch

  private scheduleTask(task: ScheduledTask): void {
    // Poll every minute and fire when cron expression matches current time
    const interval = setInterval(() => {
      if (!task.enabled) return
      if (this.shouldRun(task)) {
        task.lastRun = Date.now()
        this.save()

        const taskWithTimeout = Promise.race([
          this.runTask(task),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`Task timeout after 5 minutes: ${task.description}`)),
              Scheduler.TASK_TIMEOUT_MS,
            )
          ),
        ])

        taskWithTimeout.catch(e =>
          console.log(`[Security] Task killed: "${task.description}": ${e.message}`)
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
