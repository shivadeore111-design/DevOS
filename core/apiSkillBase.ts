// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/apiSkillBase.ts — Reusable base for API-backed skills.
//
// Handles: auth injection (bearer / header / query / none),
// JSON parsing, HTTP errors, retry on 429/50x with exponential
// backoff, token-bucket rate limiting, and request timeouts.
//
// Usage:
//   import { ApiSkill, requireApiKey } from '../../core/apiSkillBase'
//   const skill = new ApiSkill({ name: 'myapi', baseUrl: '...', ... })
//   const data  = await skill.get('/endpoint', { param: 'value' })

export interface ApiSkillConfig {
  name:            string
  baseUrl:         string
  apiKey?:         string         // literal key value
  apiKeyEnv?:      string         // env var name — resolved at construction
  authType:        'bearer' | 'header' | 'query' | 'none'
  authHeader?:     string         // e.g. 'hibp-api-key'   (authType === 'header')
  authQueryParam?: string         // e.g. 'apikey'         (authType === 'query')
  timeout?:        number         // ms  — default 30_000
  retries?:        number         // default 3
  rateLimit?: {
    requests: number              // tokens per window
    windowMs: number              // window duration in ms
  }
}

// ── requireApiKey ─────────────────────────────────────────────
// Throws a user-friendly error when an env var is missing.

export function requireApiKey(envVar: string): string {
  const key = process.env[envVar]
  if (!key) {
    throw new Error(
      `${envVar} is not configured.\n` +
      `Add it to .env:  ${envVar}=your-key-here\n` +
      `Or run:          /provider add <name> <key>`,
    )
  }
  return key
}

// ── RateLimiter — simple token-bucket ────────────────────────

class RateLimiter {
  private tokens:     number
  private lastRefill: number
  private readonly msPerToken: number

  constructor(private readonly requests: number, windowMs: number) {
    this.tokens      = requests
    this.lastRefill  = Date.now()
    this.msPerToken  = windowMs / requests
  }

  async acquire(): Promise<void> {
    const now    = Date.now()
    const gained = Math.floor((now - this.lastRefill) / this.msPerToken)
    if (gained > 0) {
      this.tokens     = Math.min(this.requests, this.tokens + gained)
      this.lastRefill = now
    }
    if (this.tokens > 0) {
      this.tokens--
      return
    }
    const wait = this.msPerToken - (now - this.lastRefill)
    await new Promise(r => setTimeout(r, Math.max(0, wait)))
    this.tokens = Math.max(0, this.tokens - 1)
  }
}

// ── ApiSkill ──────────────────────────────────────────────────

export class ApiSkill {
  private readonly cfg:     ApiSkillConfig
  private readonly key:     string
  private readonly limiter: RateLimiter | undefined

  constructor(cfg: ApiSkillConfig) {
    this.cfg     = { timeout: 30_000, retries: 3, ...cfg }
    this.key     = cfg.apiKey ?? (cfg.apiKeyEnv ? (process.env[cfg.apiKeyEnv] ?? '') : '')
    this.limiter = cfg.rateLimit
      ? new RateLimiter(cfg.rateLimit.requests, cfg.rateLimit.windowMs)
      : undefined
  }

  // ── URL builder ───────────────────────────────────────────

  private buildUrl(endpoint: string, params?: Record<string, any>): string {
    const base = this.cfg.baseUrl.replace(/\/$/, '')
    const q    = { ...params }

    if (this.cfg.authType === 'query' && this.cfg.authQueryParam) {
      q[this.cfg.authQueryParam] = this.key
    }

    const qs = Object.entries(q)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&')

    return `${base}${endpoint}${qs ? `?${qs}` : ''}`
  }

  // ── Header builder ────────────────────────────────────────

  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json', ...extra }

    if (this.cfg.authType === 'bearer') {
      h['Authorization'] = `Bearer ${this.key}`
    } else if (this.cfg.authType === 'header' && this.cfg.authHeader) {
      h[this.cfg.authHeader] = this.key
    }
    return h
  }

  // ── Fetch with retry ──────────────────────────────────────

  private async send(url: string, init: RequestInit, attempt = 0): Promise<any> {
    if (this.limiter) await this.limiter.acquire()

    const ctrl  = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), this.cfg.timeout ?? 30_000)

    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal })

      // Retry on transient server errors
      const RETRYABLE = [429, 502, 503, 504]
      if (RETRYABLE.includes(res.status) && attempt < (this.cfg.retries ?? 3)) {
        const delay = Math.min(1_000 * 2 ** attempt, 16_000)
        await new Promise(r => setTimeout(r, delay))
        return this.send(url, init, attempt + 1)
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`${this.cfg.name}: HTTP ${res.status} — ${body.slice(0, 300)}`)
      }

      const ct = res.headers.get('content-type') ?? ''
      return ct.includes('application/json') ? res.json() : res.text()

    } catch (e: any) {
      if (e.name === 'AbortError') {
        throw new Error(`${this.cfg.name}: request timed out after ${this.cfg.timeout}ms`)
      }
      throw e
    } finally {
      clearTimeout(timer)
    }
  }

  // ── Public API ────────────────────────────────────────────

  async get(endpoint: string, params?: Record<string, any>): Promise<any> {
    return this.send(
      this.buildUrl(endpoint, params),
      { method: 'GET', headers: this.buildHeaders() },
    )
  }

  async post(endpoint: string, body: any, params?: Record<string, any>): Promise<any> {
    return this.send(
      this.buildUrl(endpoint, params),
      { method: 'POST', headers: this.buildHeaders(), body: JSON.stringify(body) },
    )
  }
}
