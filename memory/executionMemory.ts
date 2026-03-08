// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// memory/executionMemory.ts — Persist and recall successful/failed execution patterns

import * as fs   from "fs"
import * as path from "path"

const MEMORY_FILE = path.join(process.cwd(), "memory", "execution-memory.json")

export interface ExecutionMemoryEntry {
  id:          string
  pattern:     string        // goal pattern e.g. "build express server"
  goalType:    string
  domain:      string
  stack:       string[]
  outcome:     "success" | "failure"
  reason:      string        // what happened
  solution?:   string        // what fixed it (for failures)
  actions:     any[]         // the plan actions that worked/failed
  durationMs:  number
  retryCount:  number
  timestamp:   Date
  useCount:    number        // how many times this memory was used
  successRate: number        // 0.0–1.0
}

function makeId(): string {
  return `em_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

export class ExecutionMemory {
  private entries = new Map<string, ExecutionMemoryEntry>()

  constructor() {
    this.load()
  }

  // ── Store ─────────────────────────────────────────────────

  store(entry: Omit<ExecutionMemoryEntry, "id" | "timestamp" | "useCount" | "successRate">): void {
    const id  = makeId()
    const rec: ExecutionMemoryEntry = {
      ...entry,
      id,
      timestamp:   new Date(),
      useCount:    0,
      successRate: entry.outcome === "success" ? 1.0 : 0.0,
    }
    this.entries.set(id, rec)
    this.persist()
    console.log(`[ExecutionMemory] Stored ${entry.outcome} entry for "${entry.pattern.slice(0, 50)}"`)
  }

  // ── Lookup ────────────────────────────────────────────────

  lookup(parsedGoal: any): ExecutionMemoryEntry | null {
    const goalType = parsedGoal?.type ?? ""
    const domain   = parsedGoal?.domain ?? ""
    const stack: string[] = parsedGoal?.stack ?? []

    let best: ExecutionMemoryEntry | null = null
    let bestScore = 0

    for (const entry of this.entries.values()) {
      let score = 0

      if (entry.goalType === goalType) score += 3
      if (entry.domain   === domain)   score += 2

      const stackOverlap = stack.filter(s => entry.stack.includes(s)).length
      score += stackOverlap

      if (score > bestScore) {
        bestScore = score
        best      = entry
      }
    }

    // Require at least goalType + domain match (score ≥ 5)
    return bestScore >= 5 ? best : null
  }

  // ── Record use ────────────────────────────────────────────

  recordUse(id: string, success: boolean): void {
    const entry = this.entries.get(id)
    if (!entry) return
    entry.useCount++
    // Rolling average
    entry.successRate = (entry.successRate * (entry.useCount - 1) + (success ? 1 : 0)) / entry.useCount
    this.persist()
  }

  // ── Top patterns ─────────────────────────────────────────

  getTopPatterns(limit = 10): ExecutionMemoryEntry[] {
    return Array.from(this.entries.values())
      .sort((a, b) => (b.successRate * b.useCount) - (a.successRate * a.useCount))
      .slice(0, limit)
  }

  // ── Prune ─────────────────────────────────────────────────

  prune(): number {
    let pruned = 0
    for (const [id, entry] of this.entries) {
      if (entry.successRate < 0.2 && entry.useCount > 5) {
        this.entries.delete(id)
        pruned++
      }
    }
    if (pruned) {
      this.persist()
      console.log(`[ExecutionMemory] Pruned ${pruned} low-quality entries`)
    }
    return pruned
  }

  getAll(): ExecutionMemoryEntry[] {
    return Array.from(this.entries.values())
  }

  // ── Persistence ───────────────────────────────────────────

  private persist(): void {
    try {
      const dir = path.dirname(MEMORY_FILE)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      const data = Array.from(this.entries.values())
      fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2), "utf8")
    } catch (err) {
      console.warn("[ExecutionMemory] Failed to persist:", err)
    }
  }

  private load(): void {
    try {
      if (!fs.existsSync(MEMORY_FILE)) return
      const raw  = fs.readFileSync(MEMORY_FILE, "utf8")
      const data = JSON.parse(raw) as any[]
      for (const item of data) {
        item.timestamp = new Date(item.timestamp)
        this.entries.set(item.id, item as ExecutionMemoryEntry)
      }
      console.log(`[ExecutionMemory] Loaded ${this.entries.size} entries`)
    } catch {
      // corrupt or missing — start fresh
    }
  }
}

export const executionMemory = new ExecutionMemory()
