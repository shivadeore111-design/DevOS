// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/costTracker.ts — Token usage and cost tracking for every LLM call.
// Hooked into callLLM in agentLoop.ts.
// Background (system) costs are tracked separately from user budget.

import fs   from 'fs'
import path from 'path'
import { eventBus } from './eventBus'

// ── Pricing (per million tokens) ─────────────────────────────

const PRICING: Record<string, { input: number; output: number }> = {
  'groq':       { input: 0,    output: 0 },
  'gemini':     { input: 0,    output: 0 },
  'cerebras':   { input: 0,    output: 0 },
  'openrouter': { input: 0.14, output: 0.28 },
  'ollama':     { input: 0,    output: 0 },
  'nvidia':     { input: 0,    output: 0 },
  'cloudflare': { input: 0,    output: 0 },
  'github':     { input: 0,    output: 0 },
}

// ── Paths ─────────────────────────────────────────────────────

const COST_DIR = path.join(process.cwd(), 'workspace', 'cost')

// ── Types ─────────────────────────────────────────────────────

export interface UsageRecord {
  ts:           number
  provider:     string
  model:        string
  inputTokens:  number
  outputTokens: number
  costUSD:      number
  traceId?:     string
  isSystem:     boolean
}

export interface DailyCostSummary {
  date:       string
  totalUSD:   number
  systemUSD:  number
  userUSD:    number
  byProvider: Record<string, number>
}

// ── CostTracker ───────────────────────────────────────────────

class CostTracker {
  private todayRecords: UsageRecord[] = []
  private lastDate:     string        = ''
  private budgetEnforced = false

  constructor() {
    try { fs.mkdirSync(COST_DIR, { recursive: true }) } catch {}
    this.refreshDay()
  }

  // ── Day management ─────────────────────────────────────────

  private dateKey(): string {
    return new Date().toISOString().slice(0, 10)
  }

  private logPath(): string {
    return path.join(COST_DIR, `${this.dateKey()}.jsonl`)
  }

  private refreshDay(): void {
    const today = this.dateKey()
    if (today === this.lastDate) return
    this.lastDate       = today
    this.budgetEnforced = false
    const p = this.logPath()
    if (!fs.existsSync(p)) { this.todayRecords = []; return }
    try {
      this.todayRecords = fs.readFileSync(p, 'utf-8')
        .trim().split('\n').filter(Boolean)
        .map(l => { try { return JSON.parse(l) as UsageRecord } catch { return null } })
        .filter((r): r is UsageRecord => r !== null)
    } catch {
      this.todayRecords = []
    }
  }

  // ── Main tracking call ─────────────────────────────────────

  trackUsage(
    provider:     string,
    model:        string,
    inputTokens:  number,
    outputTokens: number,
    traceId?:     string,
    isSystem      = false,
  ): void {
    this.refreshDay()

    const pricing = PRICING[provider] ?? { input: 0, output: 0 }
    const costUSD = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000

    const record: UsageRecord = {
      ts: Date.now(),
      provider,
      model,
      inputTokens,
      outputTokens,
      costUSD,
      traceId,
      isSystem,
    }

    this.todayRecords.push(record)

    try {
      fs.appendFileSync(this.logPath(), JSON.stringify(record) + '\n')
    } catch (e: any) {
      console.error('[CostTracker] Write failed:', e.message)
    }

    // Budget enforcement — only for user calls, only trigger once per day
    if (!isSystem && !this.budgetEnforced) {
      const userTotal = this.getDailyUserCost()
      const budget    = this.getDailyBudget()
      if (userTotal >= budget) {
        this.budgetEnforced = true
        this.enforceBudgetCap(userTotal, budget)
      }
    }

    // Emit event for dashboard
    try {
      eventBus.emit('cost_update', this.getDailySummary())
    } catch {}
  }

  // ── Accessors ──────────────────────────────────────────────

  getDailyBudget(): number {
    try {
      const cfgPath = path.join(process.cwd(), 'config', 'devos.config.json')
      const raw     = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as any
      return typeof raw.dailyBudgetUSD === 'number' ? raw.dailyBudgetUSD : 5.00
    } catch {
      return 5.00
    }
  }

  getDailyUserCost(): number {
    this.refreshDay()
    return this.todayRecords
      .filter(r => !r.isSystem)
      .reduce((s, r) => s + r.costUSD, 0)
  }

  getDailySystemCost(): number {
    this.refreshDay()
    return this.todayRecords
      .filter(r => r.isSystem)
      .reduce((s, r) => s + r.costUSD, 0)
  }

  getDailySummary(): DailyCostSummary {
    this.refreshDay()
    const byProvider: Record<string, number> = {}
    let totalUSD = 0, systemUSD = 0, userUSD = 0

    for (const r of this.todayRecords) {
      byProvider[r.provider] = (byProvider[r.provider] ?? 0) + r.costUSD
      totalUSD  += r.costUSD
      if (r.isSystem) systemUSD += r.costUSD
      else            userUSD   += r.costUSD
    }

    return {
      date: this.dateKey(),
      totalUSD,
      systemUSD,
      userUSD,
      byProvider,
    }
  }

  getTraceTotal(traceId: string): number {
    this.refreshDay()
    return this.todayRecords
      .filter(r => r.traceId === traceId)
      .reduce((s, r) => s + r.costUSD, 0)
  }

  formatUserCost(): string {
    const usd = this.getDailyUserCost()
    return `$${usd.toFixed(2)} today`
  }

  // ── Budget enforcement ─────────────────────────────────────

  private enforceBudgetCap(userTotal: number, budget: number): void {
    console.warn(`[CostTracker] Daily budget cap $${budget} reached ($${userTotal.toFixed(4)} used) — switching to Ollama`)

    // Switch routing to Ollama-only
    try {
      const configPath = path.join(process.cwd(), 'config', 'devos.config.json')
      const raw        = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as any
      raw.routing      = { ...raw.routing, mode: 'manual' }
      raw.model        = { ...raw.model, active: 'ollama' }
      fs.writeFileSync(configPath, JSON.stringify(raw, null, 2))
    } catch (e: any) {
      console.error('[CostTracker] Failed to switch to Ollama:', e.message)
    }

    // Desktop notification — fire-and-forget
    import('./toolRegistry').then(({ executeTool }) => {
      executeTool('notify', {
        message: `DevOS daily budget cap ($${budget}) reached. Switched to Ollama to prevent overspending.`,
      }).catch(() => {})
    }).catch(() => {})
  }
}

// ── Singleton ──────────────────────────────────────────────────

export const costTracker = new CostTracker()
