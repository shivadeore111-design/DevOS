// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// coordination/missionMemory.ts — Per-mission state with checkpoint support
// Persists each mission to workspace/missions/<id>/state.json
// Survives process restarts and resumes from last checkpoint.

import * as fs   from 'fs'
import * as path from 'path'
import { MissionStatus } from './missionState'
import { AgentRole }     from '../agents/types'
import { BusTask }       from './taskBus'

// ── Types ──────────────────────────────────────────────────────

export interface MissionRecord {
  id:               string
  goal:             string
  description:      string
  status:           MissionStatus
  tasks:            BusTask[]
  agentAssignments: Record<string, AgentRole>   // taskId → agent role
  startedAt:        string
  completedAt?:     string
  checkpoints:      string[]                    // ISO timestamps of each checkpoint
  tokenBudget:      number                      // max tokens allowed (default 50000)
  tokensUsed:       number                      // running estimate
  timeLimit:        number                      // ms (default 7_200_000 = 2h)
  logPath:          string                      // absolute path to missionlog.md
  summary?:         string
}

// ── Constants ──────────────────────────────────────────────────

const DEFAULT_TOKEN_BUDGET = 50_000
const DEFAULT_TIME_LIMIT   = 7_200_000    // 2 hours
const MISSIONS_ROOT        = path.join(process.cwd(), 'workspace', 'missions')

// ── MissionMemory ──────────────────────────────────────────────

class MissionMemory {

  // ── Paths ──────────────────────────────────────────────────

  private missionDir(id: string): string {
    return path.join(MISSIONS_ROOT, id)
  }

  private statePath(id: string): string {
    return path.join(this.missionDir(id), 'state.json')
  }

  // ── Save (create or overwrite) ─────────────────────────────

  saveMission(mission: MissionRecord): void {
    const dir = this.missionDir(mission.id)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(this.statePath(mission.id), JSON.stringify(mission, null, 2), 'utf-8')
    console.log(`[MissionMemory] 💾 Saved mission ${mission.id.slice(0, 8)} [${mission.status}]`)
  }

  // ── Load ───────────────────────────────────────────────────

  loadMission(id: string): MissionRecord | null {
    const p = this.statePath(id)
    if (!fs.existsSync(p)) return null
    try {
      return JSON.parse(fs.readFileSync(p, 'utf-8')) as MissionRecord
    } catch (err: any) {
      console.warn(`[MissionMemory] Load failed for ${id}: ${err?.message}`)
      return null
    }
  }

  // ── Update (partial merge + auto-checkpoint) ───────────────

  updateMission(id: string, updates: Partial<MissionRecord>): void {
    const existing = this.loadMission(id)
    if (!existing) {
      console.warn(`[MissionMemory] updateMission: mission not found: ${id}`)
      return
    }

    const updated: MissionRecord = { ...existing, ...updates }

    // Auto-checkpoint on each update
    const checkpoint = new Date().toISOString()
    updated.checkpoints = [...(existing.checkpoints ?? []), checkpoint]

    this.saveMission(updated)
  }

  // ── List ───────────────────────────────────────────────────

  listMissions(status?: MissionStatus): MissionRecord[] {
    if (!fs.existsSync(MISSIONS_ROOT)) return []
    const ids = fs.readdirSync(MISSIONS_ROOT).filter(name => {
      const statFile = path.join(MISSIONS_ROOT, name, 'state.json')
      return fs.existsSync(statFile)
    })
    const missions: MissionRecord[] = []
    for (const id of ids) {
      const m = this.loadMission(id)
      if (m && (!status || m.status === status)) missions.push(m)
    }
    return missions.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  }

  // ── Factory helper ─────────────────────────────────────────

  /** Create a fresh MissionRecord with sensible defaults */
  create(
    id:          string,
    goal:        string,
    description: string,
    logPath:     string,
    overrides:   Partial<MissionRecord> = {},
  ): MissionRecord {
    return {
      id,
      goal,
      description,
      status:           'active',
      tasks:            [],
      agentAssignments: {},
      startedAt:        new Date().toISOString(),
      checkpoints:      [],
      tokenBudget:      DEFAULT_TOKEN_BUDGET,
      tokensUsed:       0,
      timeLimit:        DEFAULT_TIME_LIMIT,
      logPath,
      ...overrides,
    }
  }

  // ── Checkpoint (explicit) ──────────────────────────────────

  checkpoint(id: string, note?: string): void {
    const mission = this.loadMission(id)
    if (!mission) return
    const ts = new Date().toISOString()
    mission.checkpoints.push(note ? `${ts} — ${note}` : ts)
    this.saveMission(mission)
    console.log(`[MissionMemory] 📍 Checkpoint for ${id.slice(0, 8)}${note ? `: ${note}` : ''}`)
  }

  // ── Token tracking ─────────────────────────────────────────

  addTokens(id: string, estimate: number): number {
    const mission = this.loadMission(id)
    if (!mission) return 0
    mission.tokensUsed = (mission.tokensUsed ?? 0) + estimate
    this.saveMission(mission)
    return mission.tokensUsed
  }

  isOverBudget(id: string): boolean {
    const mission = this.loadMission(id)
    if (!mission) return false
    return mission.tokensUsed >= mission.tokenBudget
  }
}

export const missionMemory = new MissionMemory()
