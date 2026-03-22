// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// coordination/missionCanvas.ts — Shared agent blackboard for multi-agent coordination

import * as fs     from 'fs'
import * as path   from 'path'
import * as crypto from 'crypto'
import { AgentRole } from '../agents/types'

// ── Types ──────────────────────────────────────────────────────

export type CanvasAuthor    = AgentRole | 'system'
export type CanvasEntryType = 'plan' | 'finding' | 'code' | 'test' | 'decision' | 'result'

export interface CanvasEntry {
  id:          string
  author:      CanvasAuthor
  type:        CanvasEntryType
  content:     string
  timestamp:   string
  missionId:   string
  tags:        string[]
  supersedes?: string   // id of the entry this replaces
}

// ── Constants ──────────────────────────────────────────────────

const MAX_CONTEXT_CHARS = 1500
const MISSIONS_DIR      = path.join(process.cwd(), 'workspace', 'missions')

// Priority order for getFullContext — most-important type first
const CONTEXT_PRIORITY: CanvasEntryType[] = [
  'decision', 'plan', 'code', 'test', 'finding', 'result',
]

// ── Class ──────────────────────────────────────────────────────

class MissionCanvas {

  // ── Persistence ────────────────────────────────────────────

  private canvasPath(missionId: string): string {
    return path.join(MISSIONS_DIR, missionId, 'canvas.json')
  }

  private loadEntries(missionId: string): CanvasEntry[] {
    const p = this.canvasPath(missionId)
    if (!fs.existsSync(p)) return []
    try {
      return JSON.parse(fs.readFileSync(p, 'utf-8')) as CanvasEntry[]
    } catch {
      return []
    }
  }

  private saveEntries(missionId: string, entries: CanvasEntry[]): void {
    const dir = path.dirname(this.canvasPath(missionId))
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      this.canvasPath(missionId),
      JSON.stringify(entries, null, 2),
      'utf-8',
    )
  }

  // ── Lifecycle ─────────────────────────────────────────────

  /**
   * Initialise a blank canvas for a new mission.
   * Seeds it with a system 'plan' entry so getFullContext is never empty.
   */
  create(missionId: string, goal: string): void {
    const seed: CanvasEntry = {
      id:        crypto.randomUUID(),
      author:    'system',
      type:      'plan',
      content:   `Mission started: ${goal}`,
      timestamp: new Date().toISOString(),
      missionId,
      tags:      ['init'],
    }
    this.saveEntries(missionId, [seed])
    console.log(`[MissionCanvas] 📋 Canvas created for mission ${missionId.slice(0, 8)}`)
  }

  // ── Write ──────────────────────────────────────────────────

  write(
    missionId: string,
    entry: Omit<CanvasEntry, 'id' | 'timestamp' | 'missionId'>,
  ): CanvasEntry {
    const entries = this.loadEntries(missionId)
    const full: CanvasEntry = {
      ...entry,
      id:        crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      missionId,
    }
    entries.push(full)
    this.saveEntries(missionId, entries)
    console.log(
      `[MissionCanvas] ✍️  [${entry.author.toUpperCase()}/${entry.type}] → mission ${missionId.slice(0, 8)}`,
    )
    return full
  }

  // ── Read ───────────────────────────────────────────────────

  read(
    missionId: string,
    filter?: { author?: CanvasAuthor; type?: CanvasEntryType },
  ): CanvasEntry[] {
    let entries = this.loadEntries(missionId)
    if (filter?.author) entries = entries.filter(e => e.author === filter.author)
    if (filter?.type)   entries = entries.filter(e => e.type   === filter.type)
    return entries
  }

  /** Returns the most recent entry of a given type, or null. */
  readLatest(missionId: string, type: CanvasEntryType): CanvasEntry | null {
    const entries = this.loadEntries(missionId).filter(e => e.type === type)
    return entries.length > 0 ? entries[entries.length - 1] : null
  }

  // ── Supersede ─────────────────────────────────────────────

  /**
   * Write a new entry that supersedes an existing one.
   * The old entry is NOT deleted — full history is preserved.
   */
  supersede(
    missionId: string,
    entryId:   string,
    newEntry:  Omit<CanvasEntry, 'id' | 'timestamp' | 'missionId'>,
  ): CanvasEntry {
    return this.write(missionId, { ...newEntry, supersedes: entryId })
  }

  // ── Full context for LLM injection ────────────────────────

  /**
   * Returns a condensed snapshot of the canvas (max 1500 chars) for
   * injection into every agent LLM call.
   *
   * Strategy:
   *   - Take the LATEST entry of each type, in priority order.
   *   - Truncate each entry's content to 300 chars.
   *   - Trim the whole block to MAX_CONTEXT_CHARS.
   */
  getFullContext(missionId: string): string {
    const entries = this.loadEntries(missionId)
    if (entries.length === 0) return ''

    // Group by type, newest last
    const byType = new Map<CanvasEntryType, CanvasEntry[]>()
    for (const e of entries) {
      const arr = byType.get(e.type) ?? []
      arr.push(e)
      byType.set(e.type, arr)
    }

    const lines: string[] = ['=== MISSION CANVAS ===']

    for (const t of CONTEXT_PRIORITY) {
      const group = byType.get(t)
      if (!group || group.length === 0) continue
      const latest = group[group.length - 1]
      lines.push(
        `[${latest.author.toUpperCase()}/${t.toUpperCase()}] ${latest.content.slice(0, 300)}`,
      )
    }

    lines.push('=== END CANVAS ===')

    const raw = lines.join('\n')
    return raw.length <= MAX_CONTEXT_CHARS
      ? raw
      : raw.slice(0, MAX_CONTEXT_CHARS - 3) + '...'
  }
}

export const missionCanvas = new MissionCanvas()
