// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/goalTracker.ts — Reads/writes workspace/GOALS.md,
// exposes active goal summaries for planner injection.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname }                                       from 'path'

const GOALS_PATH = join(process.cwd(), 'workspace', 'GOALS.md')

// ── Types ─────────────────────────────────────────────────────

export interface Goal {
  id:          string
  title:       string
  status:      'not_started' | 'in_progress' | 'blocked' | 'done'
  target?:     string
  blockers?:   string[]
  nextAction?: string
  lastUpdated: string
  notes?:      string[]
}

// ── Parser ────────────────────────────────────────────────────

function parseGoalSection(section: string): Goal {
  const lines = section.split('\n')
  const title = lines[0].trim()
  const goal: Goal = {
    id:          Date.now().toString(),
    title,
    status:      'not_started',
    lastUpdated: new Date().toISOString().split('T')[0],
  }

  for (const line of lines.slice(1)) {
    const t = line.trim()
    if      (t.startsWith('- Status:'))      goal.status      = t.replace('- Status:', '').trim() as any
    else if (t.startsWith('- Target:'))      goal.target      = t.replace('- Target:', '').trim()
    else if (t.startsWith('- Next action:')) goal.nextAction  = t.replace('- Next action:', '').trim()
    else if (t.startsWith('- Note:')) {
      if (!goal.notes) goal.notes = []
      goal.notes.push(t.replace('- Note:', '').trim())
    }
  }

  return goal
}

// ── Public API ────────────────────────────────────────────────

export function loadGoals(): Goal[] {
  if (!existsSync(GOALS_PATH)) return []
  try {
    return readFileSync(GOALS_PATH, 'utf8')
      .split(/^## /m)
      .slice(1)
      .map(parseGoalSection)
  } catch { return [] }
}

export function saveGoals(goals: Goal[]): void {
  const today = new Date().toISOString().split('T')[0]
  const md =
    '# Active Goals\n\n' +
    goals.map(g =>
      `## ${g.title}\n` +
      `- Status: ${g.status}\n` +
      (g.target     ? `- Target: ${g.target}\n`           : '') +
      (g.nextAction ? `- Next action: ${g.nextAction}\n`  : '') +
      `- Last updated: ${today}\n` +
      (g.notes?.map(n => `- Note: ${n}\n`).join('') ?? '')
    ).join('\n')

  try {
    mkdirSync(dirname(GOALS_PATH), { recursive: true })
    writeFileSync(GOALS_PATH, md)
  } catch {}
}

export function getActiveGoalsSummary(): string {
  const active = loadGoals().filter(g => g.status !== 'done')
  if (active.length === 0) return ''
  return 'Active goals:\n' + active.map(g =>
    `- ${g.title} [${g.status}]: ${g.nextAction || 'No next action'}`
  ).join('\n')
}
