// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// personal/lifeTimeline.ts — Persistent log of everything DevOS does

import * as fs      from 'fs'
import * as path    from 'path'
import * as crypto  from 'crypto'
import { eventBus } from '../core/eventBus'

export interface TimelineEntry {
  id:        string
  timestamp: string
  agent:     string
  action:    string
  result:    string
  goalId?:   string
  type:      'research' | 'build' | 'deploy' | 'monitor' | 'insight'
}

const FILE = path.join(process.cwd(), 'workspace/life-timeline.json')

export class LifeTimeline {
  constructor() {
    // Wire eventBus listeners to auto-capture key system events
    eventBus.on('goal:completed' as any, (data: any) => {
      this.addEntry({
        timestamp: new Date().toISOString(),
        agent:     'GoalEngine',
        action:    'Goal completed: ' + (data.title || data.goalId),
        result:    data.result || '',
        goalId:    data.goalId,
        type:      'build',
      })
    })

    eventBus.on('mission:complete' as any, (data: any) => {
      this.addEntry({
        timestamp: new Date().toISOString(),
        agent:     'MissionControl',
        action:    'Mission complete: ' + data.goal,
        result:    data.summary || '',
        goalId:    data.missionId,
        type:      'build',
      })
    })

    eventBus.on('pilot_completed' as any, (data: any) => {
      this.addEntry({
        timestamp: new Date().toISOString(),
        agent:     data.pilotId || 'Pilot',
        action:    'Pilot run completed',
        result:    data.output || '',
        type:      'monitor',
      })
    })
  }

  addEntry(entry: Omit<TimelineEntry, 'id'>): void {
    const entries = this.load()
    entries.push({ ...entry, id: crypto.randomUUID() })
    const dir = path.dirname(FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(FILE, JSON.stringify(entries.slice(-500), null, 2))
  }

  getTimeline(goalId?: string): TimelineEntry[] {
    const entries = this.load()
    return goalId ? entries.filter(e => e.goalId === goalId) : entries
  }

  private load(): TimelineEntry[] {
    if (!fs.existsSync(FILE)) return []
    try { return JSON.parse(fs.readFileSync(FILE, 'utf-8')) } catch { return [] }
  }
}

export const lifeTimeline = new LifeTimeline()
