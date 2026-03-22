// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// personal/lifeCanvas.ts — Visual goal-linked journal / canvas
//
// Captures notes, milestones, insights, and reflections tied to goals.
// Persists to: workspace/life-canvas.json

import * as fs     from 'fs'
import * as path   from 'path'
import * as crypto from 'crypto'
import * as http   from 'http'
import { wrapWithPersona } from '../personality/devosPersonality'

// ── Types ──────────────────────────────────────────────────────────────────

export type CanvasEntryType =
  | 'note'
  | 'milestone'
  | 'insight'
  | 'reflection'
  | 'achievement'
  | 'blocker'

export interface CanvasEntry {
  id:        string
  goalId?:   string          // linked goal (optional for free-form entries)
  type:      CanvasEntryType
  title:     string
  content:   string
  tags?:     string[]
  createdAt: string
  updatedAt: string
}

interface CanvasStore {
  entries: CanvasEntry[]
}

// ── Storage ────────────────────────────────────────────────────────────────

const FILE = path.join(process.cwd(), 'workspace', 'life-canvas.json')

function loadStore(): CanvasStore {
  if (!fs.existsSync(FILE)) return { entries: [] }
  try { return JSON.parse(fs.readFileSync(FILE, 'utf-8')) as CanvasStore } catch { return { entries: [] } }
}

function saveStore(store: CanvasStore): void {
  const dir = path.dirname(FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(FILE, JSON.stringify(store, null, 2))
}

// ── LifeCanvas class ───────────────────────────────────────────────────────

class LifeCanvas {

  // ── Mutations ─────────────────────────────────────────────────────────

  addEntry(entry: Omit<CanvasEntry, 'id' | 'createdAt' | 'updatedAt'>): CanvasEntry {
    const store = loadStore()
    const now   = new Date().toISOString()
    const full: CanvasEntry = {
      ...entry,
      id:        crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    }
    store.entries.push(full)
    // Keep last 2000 entries
    if (store.entries.length > 2000) store.entries = store.entries.slice(-2000)
    saveStore(store)
    return full
  }

  updateEntry(id: string, patch: Partial<Pick<CanvasEntry, 'title' | 'content' | 'tags' | 'type'>>): boolean {
    const store = loadStore()
    const entry = store.entries.find(e => e.id === id)
    if (!entry) return false
    Object.assign(entry, patch, { updatedAt: new Date().toISOString() })
    saveStore(store)
    return true
  }

  deleteEntry(id: string): boolean {
    const store = loadStore()
    const before = store.entries.length
    store.entries = store.entries.filter(e => e.id !== id)
    if (store.entries.length === before) return false
    saveStore(store)
    return true
  }

  // ── Queries ───────────────────────────────────────────────────────────

  /** Get all entries for a specific goal, or all entries if no goalId */
  getCanvas(goalId?: string): CanvasEntry[] {
    const { entries } = loadStore()
    if (!goalId) return entries
    return entries.filter(e => e.goalId === goalId)
  }

  getAll(): CanvasEntry[] {
    return loadStore().entries
  }

  getRecent(n = 20): CanvasEntry[] {
    return loadStore().entries.slice(-n)
  }

  getByType(type: CanvasEntryType): CanvasEntry[] {
    return loadStore().entries.filter(e => e.type === type)
  }

  searchByTag(tag: string): CanvasEntry[] {
    return loadStore().entries.filter(e => e.tags?.includes(tag))
  }

  // ── LLM summarisation ─────────────────────────────────────────────────

  /**
   * Generate a plain-English summary of all canvas entries for a goal.
   * Returns an LLM-composed paragraph.
   */
  async summarise(goalId: string): Promise<string> {
    const entries = this.getCanvas(goalId)
    if (entries.length === 0) {
      return `No canvas entries yet for goal ${goalId}.`
    }

    const body = entries
      .slice(-30)  // last 30 entries max
      .map(e => `[${e.type}] ${e.title}: ${e.content}`)
      .join('\n')

    const prompt =
      `Summarise the following canvas entries for this goal in 3-4 natural sentences. ` +
      `Focus on progress made, key insights, and any blockers. Plain text, no bullet points.\n\n` +
      `Entries:\n${body}`

    const { system, user } = wrapWithPersona(prompt)

    return new Promise((resolve) => {
      const reqBody = JSON.stringify({
        model:   'mistral-nemo:12b',
        prompt:  user,
        system,
        stream:  false,
        options: { num_predict: 150 },
      })

      const req = http.request(
        { hostname: 'localhost', port: 11434, path: '/api/generate', method: 'POST' },
        (res) => {
          let data = ''
          res.on('data',  (c) => data += c)
          res.on('end',   () => {
            try   { resolve(JSON.parse(data).response || `${entries.length} entries logged for this goal.`) }
            catch { resolve(`${entries.length} entries logged for this goal.`) }
          })
          res.on('error', () => resolve(`${entries.length} entries logged for this goal.`))
        },
      )
      req.on('error', () => resolve(`${entries.length} entries logged for this goal.`))
      req.setTimeout(12_000, () => { req.destroy(); resolve(`${entries.length} entries logged for this goal.`) })
      req.write(reqBody)
      req.end()
    })
  }

  // ── Stats ──────────────────────────────────────────────────────────────

  stats(): Record<CanvasEntryType, number> & { total: number } {
    const entries = loadStore().entries
    const counts: any = { note: 0, milestone: 0, insight: 0, reflection: 0, achievement: 0, blocker: 0, total: entries.length }
    for (const e of entries) counts[e.type] = (counts[e.type] ?? 0) + 1
    return counts
  }
}

export const lifeCanvas = new LifeCanvas()
