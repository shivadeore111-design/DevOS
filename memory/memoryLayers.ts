// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// memory/memoryLayers.ts — 3-tier memory: HOT (RAM) → WARM (SQLite) → COLD (JSON)
// Stub for sandbox; full implementation on user machine (committed in Sprint 18).

import * as fs   from 'fs'
import * as path from 'path'

// ── Types ──────────────────────────────────────────────────────

export interface MemoryEntry {
  id:           string
  content:      string
  tier:         'hot' | 'warm' | 'cold'
  timestamp:    number
  tags:         string[]
  accessCount:  number
  lastAccessed: number
}

// ── Persistence paths ─────────────────────────────────────────

const WORKSPACE_MEM  = path.join(process.cwd(), 'workspace', 'memory')
const COLD_JSON_PATH = path.join(WORKSPACE_MEM, 'cold.json')

function _makeId(): string {
  return `ml_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

function _loadCold(): MemoryEntry[] {
  try {
    if (!fs.existsSync(COLD_JSON_PATH)) return []
    return JSON.parse(fs.readFileSync(COLD_JSON_PATH, 'utf-8')) as MemoryEntry[]
  } catch { return [] }
}

function _saveCold(entries: MemoryEntry[]): void {
  try {
    fs.mkdirSync(path.dirname(COLD_JSON_PATH), { recursive: true })
    fs.writeFileSync(COLD_JSON_PATH, JSON.stringify(entries.slice(-2000), null, 2), 'utf-8')
  } catch { /* non-fatal */ }
}

// ── MemoryLayers ──────────────────────────────────────────────

class MemoryLayers {
  private hot = new Map<string, MemoryEntry>()

  /** Write a new entry. Always lands in HOT first. */
  write(content: string, tags: string[]): void {
    const now = Date.now()
    const entry: MemoryEntry = {
      id:           _makeId(),
      content:      content.slice(0, 2000),
      tier:         'hot',
      timestamp:    now,
      tags,
      accessCount:  0,
      lastAccessed: now,
    }
    this.hot.set(entry.id, entry)

    // Overflow: flush oldest to cold.json when HOT exceeds 20
    if (this.hot.size > 20) {
      const oldest = Array.from(this.hot.values())
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(0, 5)
      const cold = _loadCold()
      for (const e of oldest) {
        cold.push({ ...e, tier: 'cold' })
        this.hot.delete(e.id)
      }
      _saveCold(cold)
    }
  }

  /** Simple keyword search across HOT then COLD. */
  async read(query: string, maxTokens = 1000): Promise<MemoryEntry[]> {
    const tokens  = query.toLowerCase().split(/\s+/).filter(t => t.length > 2)
    const charBudget = maxTokens * 4

    const score = (e: MemoryEntry) => {
      const hay = (e.content + ' ' + e.tags.join(' ')).toLowerCase()
      return tokens.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0)
    }

    const hotResults = Array.from(this.hot.values())
      .sort((a, b) => score(b) - score(a))

    let used = 0
    const result: MemoryEntry[] = []
    for (const e of hotResults) {
      used += e.content.length
      if (used > charBudget) break
      result.push(e)
    }

    if (result.length < 3) {
      const cold = _loadCold()
        .sort((a, b) => score(b) - score(a))
        .slice(0, 10)
      for (const e of cold) {
        used += e.content.length
        if (used > charBudget) break
        result.push(e)
      }
    }

    return result
  }

  async getStats(): Promise<{ hot: number; warm: number; cold: number }> {
    return { hot: this.hot.size, warm: 0, cold: _loadCold().length }
  }

  async getContextForPrompt(maxTokens = 500): Promise<string> {
    const entries = Array.from(this.hot.values())
      .sort((a, b) => b.lastAccessed - a.lastAccessed)
      .slice(0, 10)
    if (entries.length === 0) return ''
    const lines = entries.map(e => `• [${e.tags.join(',')}] ${e.content.slice(0, 200)}`)
    return `=== MEMORY CONTEXT ===\n${lines.join('\n')}\n=== END MEMORY ===`
  }
}

export const memoryLayers = new MemoryLayers()
