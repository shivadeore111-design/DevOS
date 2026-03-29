// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/memoryStrategy.ts — Goal-hashing memory layer for computer-use sessions.
//
// Responsibilities:
//   • MD5-hash goals for fast lookup
//   • Store success/failure outcomes with action history
//   • Rank retrieved memories by keyword overlap + success rate
//   • Clean up entries older than 30 days
//   • Persist to workspace/computer-use-memory.json + cross-write to MemoryLayers

import * as fs   from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { memoryLayers } from '../memory/memoryLayers'
import { ComputerUseAction } from '../types/computerUse'

// ── Types ────────────────────────────────────────────────────

interface MemoryEntry {
  goalHash:     string
  goal:         string
  keywords:     string[]
  successCount: number
  failureCount: number
  successRate:  number
  lastActions:  ComputerUseAction[]
  lastUsed:     string   // ISO date
  createdAt:    string   // ISO date
}

// ── Constants ─────────────────────────────────────────────────

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'not', 'this', 'that', 'it',
  'its', 'my', 'your', 'our', 'their', 'we', 'i', 'you', 'he', 'she',
  'they', 'me', 'him', 'her', 'us', 'them',
])

const RETENTION_DAYS = 30

// ── MemoryStrategy ────────────────────────────────────────────

export class MemoryStrategy {
  private filePath = path.join(process.cwd(), 'workspace', 'computer-use-memory.json')
  private memory: MemoryEntry[] = []

  constructor() {
    this.ensureDir()
    this.load()
    this.cleanup()
  }

  // ── Persistence ───────────────────────────────────────────

  private ensureDir(): void {
    const dir = path.dirname(this.filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw  = fs.readFileSync(this.filePath, 'utf8')
        this.memory = JSON.parse(raw) as MemoryEntry[]
      }
    } catch {
      this.memory = []
    }
  }

  private save(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.memory, null, 2), 'utf8')
    } catch (err: any) {
      console.warn(`[MemoryStrategy] save failed: ${err?.message}`)
    }
  }

  // ── Hashing + keywords ─────────────────────────────────────

  private hash(goal: string): string {
    return crypto.createHash('md5').update(goal.trim().toLowerCase()).digest('hex')
  }

  private extractKeywords(goal: string): string[] {
    return goal
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOPWORDS.has(w))
  }

  // ── Store success ─────────────────────────────────────────

  async storeSuccess(goal: string, actions: ComputerUseAction[]): Promise<void> {
    const goalHash = this.hash(goal)
    const keywords = this.extractKeywords(goal)
    const now      = new Date().toISOString()

    const existing = this.memory.find(e => e.goalHash === goalHash)
    if (existing) {
      existing.successCount++
      existing.successRate  = existing.successCount / (existing.successCount + existing.failureCount)
      existing.lastActions  = actions
      existing.lastUsed     = now
      existing.keywords     = keywords  // refresh keywords
    } else {
      this.memory.push({
        goalHash,
        goal,
        keywords,
        successCount: 1,
        failureCount: 0,
        successRate:  1.0,
        lastActions:  actions,
        lastUsed:     now,
        createdAt:    now,
      })
    }

    this.save()
    await memoryLayers.write(
      `ComputerUse memory stored (success): ${goal}`,
      ['computer_use', 'memory', 'success'],
    )
  }

  // ── Store failure ──────────────────────────────────────────

  async storeFailure(goal: string): Promise<void> {
    const goalHash = this.hash(goal)

    const existing = this.memory.find(e => e.goalHash === goalHash)
    if (existing) {
      existing.failureCount++
      existing.successRate  = existing.successCount / (existing.successCount + existing.failureCount)
      existing.lastUsed     = new Date().toISOString()
      this.save()
    }
    // If no existing entry, nothing to update — failure without prior success is not tracked
  }

  // ── Retrieve ──────────────────────────────────────────────

  /**
   * Retrieve best-matching memory entries for a goal.
   * Scores by keyword overlap count, then breaks ties by successRate.
   */
  retrieve(goal: string, limit = 3): MemoryEntry[] {
    const keywords = this.extractKeywords(goal)
    if (keywords.length === 0) return []

    const scored = this.memory
      .map(entry => {
        const overlap = entry.keywords.filter(k => keywords.includes(k)).length
        return { entry, score: overlap + entry.successRate * 0.1 }
      })
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)

    return scored.slice(0, limit).map(s => s.entry)
  }

  /**
   * Return the last successful action sequence if successRate >= 0.5.
   */
  retrieveActions(goal: string): ComputerUseAction[] | null {
    const goalHash = this.hash(goal)
    const entry    = this.memory.find(e => e.goalHash === goalHash)
    if (!entry || entry.successRate < 0.5) return null
    return entry.lastActions.length > 0 ? entry.lastActions : null
  }

  // ── Stats ──────────────────────────────────────────────────

  stats(): { total: number; avgSuccessRate: number; topGoals: string[] } {
    const total        = this.memory.length
    const avgSuccessRate = total
      ? this.memory.reduce((acc, e) => acc + e.successRate, 0) / total
      : 0
    const topGoals = [...this.memory]
      .sort((a, b) => b.successRate - a.successRate || b.successCount - a.successCount)
      .slice(0, 5)
      .map(e => e.goal)
    return { total, avgSuccessRate, topGoals }
  }

  // ── Cleanup ───────────────────────────────────────────────

  cleanup(): void {
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
    const before = this.memory.length
    this.memory  = this.memory.filter(
      e => new Date(e.lastUsed).getTime() > cutoff,
    )
    if (this.memory.length < before) {
      this.save()
    }
  }
}

export const memoryStrategy = new MemoryStrategy()
