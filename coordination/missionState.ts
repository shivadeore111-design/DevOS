// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// coordination/missionState.ts — Mission lifecycle persistence

import * as fs   from 'fs'
import * as path from 'path'

export type MissionStatus = 'active' | 'paused' | 'complete' | 'failed' | 'cancelled'
export type MissionType   = 'build' | 'research' | 'automate' | 'monitor' | 'personal'

export interface Mission {
  id:            string
  goal:          string
  description:   string
  type:          MissionType
  status:        MissionStatus
  tasksTotal:    number
  tasksDone:     number
  tasksFailed:   number
  tokensUsed:    number
  loopCount:     number
  startedAt:     string
  completedAt?:  string
  checkpointAt?: string
  summary?:      string
  options:       Record<string, any>
}

const DATA_FILE = path.join(process.cwd(), 'workspace', 'missions.json')

class MissionState {
  private missions: Map<string, Mission> = new Map()

  constructor() {
    this.load()
  }

  private load(): void {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')) as Mission[]
        for (const m of raw) this.missions.set(m.id, m)
        console.log(`[MissionState] Loaded ${this.missions.size} mission(s)`)
      }
    } catch { /* start fresh */ }
  }

  private save(): void {
    try {
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
      fs.writeFileSync(DATA_FILE, JSON.stringify([...this.missions.values()], null, 2))
    } catch (err: any) {
      console.warn(`[MissionState] Save failed: ${err?.message}`)
    }
  }

  saveMission(mission: Mission): void {
    this.missions.set(mission.id, mission)
    this.save()
  }

  loadMission(id: string): Mission | null {
    return this.missions.get(id) ?? null
  }

  updateMission(id: string, updates: Partial<Mission>): void {
    const existing = this.missions.get(id)
    if (!existing) return
    this.missions.set(id, { ...existing, ...updates })
    this.save()
  }

  listMissions(status?: MissionStatus): Mission[] {
    const all = [...this.missions.values()]
    if (!status) return all.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    return all
      .filter(m => m.status === status)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  }
}

export const missionState = new MissionState()
