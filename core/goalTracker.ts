// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/goalTracker.ts — Feature 20: active goal tracking via workspace/GOALS.md

import { existsSync, readFileSync, writeFileSync } from 'fs'
import * as nodePath from 'path'

// ── Types ──────────────────────────────────────────────────────

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

// ── Path helpers ───────────────────────────────────────────────

function goalsPath(): string {
  return nodePath.join(process.cwd(), 'workspace', 'GOALS.md')
}

// ── Parser ─────────────────────────────────────────────────────

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
    if (t.startsWith('- Status:')) {
      goal.status = t.replace('- Status:', '').trim() as Goal['status']
    } else if (t.startsWith('- Target:')) {
      goal.target = t.replace('- Target:', '').trim()
    } else if (t.startsWith('- Next action:')) {
      goal.nextAction = t.replace('- Next action:', '').trim()
    } else if (t.startsWith('- Blockers:')) {
      goal.blockers = t.replace('- Blockers:', '').split(',').map(s => s.trim())
    } else if (t.startsWith('- Note:')) {
      if (!goal.notes) goal.notes = []
      goal.notes.push(t.replace('- Note:', '').trim())
    }
  }
  return goal
}

// ── Public API ─────────────────────────────────────────────────

export function loadGoals(): Goal[] {
  const p = goalsPath()
  if (!existsSync(p)) return []
  try {
    const content  = readFileSync(p, 'utf-8')
    const sections = content.split(/^## /m).slice(1)
    return sections.map(parseGoalSection)
  } catch { return [] }
}

export function saveGoals(goals: Goal[]): void {
  const md = '# Active Goals\n\n' +
    goals.map(g =>
      `## ${g.title}\n` +
      `- Status: ${g.status}\n` +
      (g.target     ? `- Target: ${g.target}\n`                          : '') +
      (g.blockers?.length ? `- Blockers: ${g.blockers.join(', ')}\n`     : '') +
      (g.nextAction ? `- Next action: ${g.nextAction}\n`                 : '') +
      `- Last updated: ${g.lastUpdated}\n` +
      (g.notes?.length ? g.notes.map(n => `- Note: ${n}`).join('\n') + '\n' : '')
    ).join('\n')
  writeFileSync(goalsPath(), md)
}

export function getActiveGoalsSummary(): string {
  const active = loadGoals().filter(g => g.status !== 'done')
  if (active.length === 0) return ''
  return 'Active goals:\n' + active.map(g =>
    `- ${g.title} [${g.status}]: ${g.nextAction || 'No next action defined'}`
  ).join('\n')
}
