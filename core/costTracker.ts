// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/costTracker.ts — Per-task and daily cost tracking.
// Extracts token usage from LLM response objects (Groq/Cerebras/OpenRouter/Gemini/Ollama),
// calculates USD cost per provider pricing, persists daily totals to workspace/cost/,
// and enforces a configurable daily budget cap with Ollama fallback on breach.

import fs   from 'fs'
import path from 'path'

// ── Paths ──────────────────────────────────────────────────────

const COST_DIR   = path.join(process.cwd(), 'workspace', 'cost')
const DAILY_FILE = path.join(COST_DIR, 'daily.json')
const LOG_FILE   = path.join(COST_DIR, 'cost-log.jsonl')

// ── Provider pricing (USD per million tokens) ─────────────────

const PROVIDER_PRICING: Record<string, { input: number; output: number }> = {
  'groq':       { input: 0,    output: 0 },
  'gemini':     { input: 0,    output: 0 },
  'cerebras':   { input: 0,    output: 0 },
  'openrouter': { input: 0.14, output: 0.28 },
  'ollama':     { input: 0,    output: 0 },
  'nvidia':     { input: 0,    output: 0 },
  // model-level overrides for OpenRouter
  'openrouter/deepseek-v3': { input: 0.14, output: 0.28 },
}

// ── Types ──────────────────────────────────────────────────────

export interface TokenUsage {
  inputTokens:  number
  outputTokens: number
  totalTokens:  number
}

export interface CostEntry {
  id:           string
  ts:           number
  traceId?:     string
  taskType:     'user' | 'system'   // system = background agents (session, dream, etc.)
  provider:     string
  model:        string
  usage:        TokenUsage
  costUSD:      number
}

export interface DailyCost {
  date:          string             // YYYY-MM-DD
  totalUSD:      number
  systemUSD:     number             // background agent cost — not counted vs user budget
  userUSD:       number             // user-initiated cost
  byProvider:    Record<string, number>
  entryCount:    number
  budgetCapUSD:  number
  budgetExceeded:boolean
  lastUpdated:   number
}

// ── Token extraction ───────────────────────────────────────────

export function extractTokenUsage(raw: any): TokenUsage {
  if (!raw || typeof raw !== 'object') {
    return { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  }

  // Groq / Cerebras / OpenRouter / GitHub Models
  if (raw.usage?.prompt_tokens !== undefined) {
    const input  = raw.usage.prompt_tokens     ?? 0
    const output = raw.usage.completion_tokens ?? 0
    return { inputTokens: input, outputTokens: output, totalTokens: input + output }
  }

  // Gemini
  if (raw.usageMetadata?.promptTokenCount !== undefined) {
    const input  = raw.usageMetadata.promptTokenCount      ?? 0
    const output = raw.usageMetadata.candidatesTokenCount  ?? 0
    return { inputTokens: input, outputTokens: output, totalTokens: input + output }
  }

  // Ollama
  if (raw.prompt_eval_count !== undefined) {
    const input  = raw.prompt_eval_count ?? 0
    const output = raw.eval_count        ?? 0
    return { inputTokens: input, outputTokens: output, totalTokens: input + output }
  }

  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
}

// ── Cost calculation ───────────────────────────────────────────

export function calculateCost(provider: string, model: string, usage: TokenUsage): number {
  // Try model-level key first (e.g. "openrouter/deepseek-v3")
  const modelKey   = `${provider}/${model}`
  const pricing    = PROVIDER_PRICING[modelKey] ?? PROVIDER_PRICING[provider] ?? { input: 0, output: 0 }
  const inputCost  = (usage.inputTokens  * pricing.input)  / 1_000_000
  const outputCost = (usage.outputTokens * pricing.output) / 1_000_000
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000  // round to 6 dp
}

// ── CostTracker ────────────────────────────────────────────────

export class CostTracker {
  private daily: DailyCost
  private listeners: Array<(daily: DailyCost) => void> = []

  constructor() {
    try { fs.mkdirSync(COST_DIR, { recursive: true }) } catch {}
    this.daily = this.loadOrInit()
  }

  // ── Public API ─────────────────────────────────────────

  /**
   * Record a completed LLM call.  Call this after every provider.generate() /
   * provider.generateStream() call with the raw response object so token counts
   * can be extracted automatically.
   */
  record(opts: {
    provider:  string
    model:     string
    rawResponse?: any
    usage?:    TokenUsage       // supply directly if already extracted
    traceId?:  string
    taskType?: 'user' | 'system'
  }): CostEntry {
    const usage = opts.usage ?? (opts.rawResponse ? extractTokenUsage(opts.rawResponse) : { inputTokens: 0, outputTokens: 0, totalTokens: 0 })
    const cost  = calculateCost(opts.provider, opts.model, usage)
    const entry: CostEntry = {
      id:       `c_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      ts:       Date.now(),
      traceId:  opts.traceId,
      taskType: opts.taskType ?? 'user',
      provider: opts.provider,
      model:    opts.model,
      usage,
      costUSD:  cost,
    }

    this.appendLog(entry)
    this.updateDaily(entry)
    this.notifyListeners()

    return entry
  }

  /** Get today's cost summary */
  getDaily(): DailyCost {
    this.ensureFreshDay()
    return { ...this.daily }
  }

  /** Get total cost for today (user-initiated only, excludes system) */
  getUserDailyUSD(): number {
    this.ensureFreshDay()
    return this.daily.userUSD
  }

  /** Budget cap in USD — 0 means no cap */
  getBudgetCap(): number {
    return this.daily.budgetCapUSD
  }

  /** Set the daily budget cap */
  setBudgetCap(usd: number): void {
    this.ensureFreshDay()
    this.daily.budgetCapUSD = usd
    this.saveDaily()
    this.notifyListeners()
  }

  /** Returns true if the user daily budget has been exceeded */
  isBudgetExceeded(): boolean {
    this.ensureFreshDay()
    return this.daily.budgetCapUSD > 0 && this.daily.userUSD >= this.daily.budgetCapUSD
  }

  /** Format today's cost for display — e.g. "$0.47 today" */
  formatToday(): string {
    this.ensureFreshDay()
    return `$${this.daily.totalUSD.toFixed(4)} today`
  }

  /** Per-provider breakdown as a formatted string */
  formatBreakdown(): string {
    this.ensureFreshDay()
    const lines = Object.entries(this.daily.byProvider)
      .sort((a, b) => b[1] - a[1])
      .map(([p, c]) => `  ${p}: $${c.toFixed(6)}`)
    return lines.length ? lines.join('\n') : '  No charges today'
  }

  /** Subscribe to cost updates (used by SSE broadcast) */
  onChange(listener: (daily: DailyCost) => void): () => void {
    this.listeners.push(listener)
    return () => { this.listeners = this.listeners.filter(l => l !== listener) }
  }

  // ── Internal ───────────────────────────────────────────

  private updateDaily(entry: CostEntry): void {
    this.ensureFreshDay()
    const d = this.daily
    d.totalUSD   += entry.costUSD
    d.lastUpdated = Date.now()
    if (entry.taskType === 'system') {
      d.systemUSD += entry.costUSD
    } else {
      d.userUSD   += entry.costUSD
      d.budgetExceeded = d.budgetCapUSD > 0 && d.userUSD >= d.budgetCapUSD
    }
    d.byProvider[entry.provider] = (d.byProvider[entry.provider] ?? 0) + entry.costUSD
    d.entryCount++
    this.saveDaily()
  }

  private ensureFreshDay(): void {
    const today = new Date().toISOString().slice(0, 10)
    if (this.daily.date !== today) {
      this.daily = this.loadOrInit()
    }
  }

  private loadOrInit(): DailyCost {
    const today = new Date().toISOString().slice(0, 10)
    try {
      if (fs.existsSync(DAILY_FILE)) {
        const saved = JSON.parse(fs.readFileSync(DAILY_FILE, 'utf-8')) as DailyCost
        if (saved.date === today) return saved
      }
    } catch {}
    // New day — read budget cap from previous day if available
    let budgetCapUSD = 2.0   // $2 default
    try {
      if (fs.existsSync(DAILY_FILE)) {
        const prev = JSON.parse(fs.readFileSync(DAILY_FILE, 'utf-8')) as DailyCost
        budgetCapUSD = prev.budgetCapUSD ?? 2.0
      }
    } catch {}
    return { date: today, totalUSD: 0, systemUSD: 0, userUSD: 0, byProvider: {}, entryCount: 0, budgetCapUSD, budgetExceeded: false, lastUpdated: Date.now() }
  }

  private saveDaily(): void {
    try {
      fs.writeFileSync(DAILY_FILE, JSON.stringify(this.daily, null, 2))
    } catch (e: any) {
      console.warn('[CostTracker] Failed to save daily:', e.message)
    }
  }

  private appendLog(entry: CostEntry): void {
    try {
      fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n')
    } catch {}
  }

  private notifyListeners(): void {
    const snap = this.getDaily()
    for (const l of this.listeners) {
      try { l(snap) } catch {}
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────
export const costTracker = new CostTracker()
