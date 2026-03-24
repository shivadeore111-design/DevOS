// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/evolutionAnalyzer.ts — Self-evolution: tracks execution reports,
// computes per-skill stats, and decides which skills need attention.

import * as fs   from 'fs'
import * as path from 'path'

// ── Types ─────────────────────────────────────────────────────

export interface ExecutionReport {
  goalId:        string
  goal:          string
  success:       boolean
  totalDuration: number
  steps: {
    skill:    string
    success:  boolean
    duration: number
    error?:   string
  }[]
  timestamp: number
}

export interface SkillStats {
  skill:        string
  totalRuns:    number
  successRate:  number
  avgTime:      number
  commonErrors: string[]
  decision:     'GOOD' | 'IMPROVE' | 'REPLACE' | 'OPTIMIZE' | 'REMOVE'
  lastUpdated:  number
}

export interface EvolutionEntry {
  skill:     string
  version:   number
  change:    string
  impact:    string
  timestamp: number
}

// ── File paths ────────────────────────────────────────────────

const REPORTS_FILE = path.join(process.cwd(), 'workspace', 'evolution-reports.json')
const STATS_FILE   = path.join(process.cwd(), 'workspace', 'evolution-stats.json')
const HISTORY_FILE = path.join(process.cwd(), 'workspace', 'evolution-history.json')

// ── Helpers ───────────────────────────────────────────────────

function readJSON<T>(file: string, fallback: T): T {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T
  } catch { return fallback }
}

function writeJSON(file: string, data: any): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
}

// ── EvolutionAnalyzer ─────────────────────────────────────────

class EvolutionAnalyzer {

  /** Store a completed execution report, then re-analyse. */
  collect(report: ExecutionReport): void {
    const reports = readJSON<ExecutionReport[]>(REPORTS_FILE, [])
    reports.push(report)
    writeJSON(REPORTS_FILE, reports.slice(-200))
    this.analyze()
  }

  /** Extract per-skill stats from all stored reports. */
  analyze(): SkillStats[] {
    const reports = readJSON<ExecutionReport[]>(REPORTS_FILE, [])

    const skillMap: Record<string, {
      runs:      number
      successes: number
      times:     number[]
      errors:    string[]
    }> = {}

    for (const report of reports) {
      for (const step of report.steps) {
        if (!skillMap[step.skill]) {
          skillMap[step.skill] = { runs: 0, successes: 0, times: [], errors: [] }
        }
        skillMap[step.skill].runs++
        if (step.success) skillMap[step.skill].successes++
        skillMap[step.skill].times.push(step.duration)
        if (step.error) skillMap[step.skill].errors.push(step.error)
      }
    }

    const stats: SkillStats[] = Object.entries(skillMap).map(([skill, data]) => {
      const successRate = data.successes / data.runs
      const avgTime = data.times.reduce((a, b) => a + b, 0) / data.times.length

      // Count common errors
      const errorCount: Record<string, number> = {}
      data.errors.forEach(e => { errorCount[e] = (errorCount[e] || 0) + 1 })
      const commonErrors = Object.entries(errorCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([e]) => e)

      // Decision engine — rules based
      let decision: SkillStats['decision'] = 'GOOD'
      if (data.runs < 3)        decision = 'GOOD'    // not enough data
      else if (successRate < 0.3) decision = 'REPLACE'
      else if (successRate < 0.6) decision = 'IMPROVE'
      else if (avgTime > 30000)   decision = 'OPTIMIZE'
      else if (data.runs === 0)   decision = 'REMOVE'

      return {
        skill,
        totalRuns: data.runs,
        successRate,
        avgTime,
        commonErrors,
        decision,
        lastUpdated: Date.now(),
      }
    })

    writeJSON(STATS_FILE, stats)
    return stats
  }

  /** Get current stats (from file cache). */
  getStats(): SkillStats[] {
    return readJSON<SkillStats[]>(STATS_FILE, [])
  }

  /** Get skills that need attention (not GOOD). */
  getDecisions(): SkillStats[] {
    return this.getStats().filter(s => s.decision !== 'GOOD')
  }

  /** Log an evolution event (what changed and measured impact). */
  recordEvolution(entry: Omit<EvolutionEntry, 'timestamp'>): void {
    const history = readJSON<EvolutionEntry[]>(HISTORY_FILE, [])
    history.push({ ...entry, timestamp: Date.now() })
    writeJSON(HISTORY_FILE, history.slice(-100))
  }

  /** Get full evolution history. */
  getHistory(): EvolutionEntry[] {
    return readJSON<EvolutionEntry[]>(HISTORY_FILE, [])
  }

  /** Summary string for devos doctor. */
  getSummary(): string {
    const stats    = this.getStats()
    const decisions = this.getDecisions()
    const reports  = readJSON<ExecutionReport[]>(REPORTS_FILE, [])
    const avgSuccess = stats.length
      ? stats.reduce((a, s) => a + s.successRate, 0) / stats.length
      : 0
    return `${reports.length} executions tracked · ${stats.length} skills · ${decisions.length} need attention · avg success ${Math.round(avgSuccess * 100)}%`
  }
}

export const evolutionAnalyzer = new EvolutionAnalyzer()
