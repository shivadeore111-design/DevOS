// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// providers/router.ts — Smart multi-API routing engine
// Round-robin across available keys, auto-marks 429s, falls back to Ollama

import { loadConfig, saveConfig, APIEntry } from './index'
import { ollamaProvider } from './ollama'
import { createGroqProvider } from './groq'
import { createOpenRouterProvider } from './openrouter'
import { createGeminiProvider } from './gemini'
import { createCerebrasProvider } from './cerebras'
import { createNvidiaProvider } from './nvidia'
import { Provider } from './types'

// Per-provider rate-limit windows — tuned to actual reset characteristics.
// Previous flat 1-hour window was far too conservative for fast-reset APIs.
const RATE_LIMIT_WINDOWS: Record<string, number> = {
  groq:       15  * 1000,  // Groq free tier resets in ~10–15 s
  gemini:     90  * 1000,  // Gemini resets in ~60–90 s
  openrouter: 30  * 1000,  // OpenRouter rarely rate-limits; 30 s is safe
  together:   30  * 1000,
  mistral:    60  * 1000,
  cohere:     60  * 1000,
  deepseek:   60  * 1000,
  openai:     60  * 1000,
  anthropic:  60  * 1000,
  cerebras:   30  * 1000,
  nvidia:     60  * 1000,
  ollama:     0,           // local — never rate-limited
}
const DEFAULT_RATE_LIMIT_MS = 60 * 1000 // 1 minute fallback

// In-memory response-time tracking (EWMA per provider)
// Separate from the config file so it resets on restart without persisting stale values.
const responseTimesMs = new Map<string, number>()

// ── Provider factory ──────────────────────────────────────────

function buildProvider(entry: APIEntry): Provider {
  const key = entry.key.startsWith('env:')
    ? process.env[entry.key.replace('env:', '')] || ''
    : entry.key

  switch (entry.provider) {
    case 'groq':       return createGroqProvider(key)
    case 'openrouter': return createOpenRouterProvider(key)
    case 'gemini':     return createGeminiProvider(key)
    case 'cerebras':   return createCerebrasProvider(key)
    case 'nvidia':     return createNvidiaProvider(key)
    default:           return ollamaProvider
  }
}

// ── Auto-reset stale rate limits ──────────────────────────────

function autoResetExpiredLimits(): boolean {
  const config  = loadConfig()
  let   changed = false

  config.providers.apis = config.providers.apis.map(api => {
    if (api.rateLimited && api.rateLimitedAt) {
      const window = RATE_LIMIT_WINDOWS[api.provider] ?? DEFAULT_RATE_LIMIT_MS
      if (window === 0 || Date.now() - api.rateLimitedAt > window) {
        changed = true
        const { rateLimitedAt, ...rest } = api
        return { ...rest, rateLimited: false }
      }
    }
    return api
  })

  if (changed) saveConfig(config)
  return changed
}

// ── Get next available API — scored by response time + failures ──

export function getNextAvailableAPI(): { provider: Provider; model: string; entry: APIEntry } | null {
  autoResetExpiredLimits()
  const config    = loadConfig()
  const available = config.providers.apis.filter(api => {
    if (!api.enabled || api.rateLimited) return false
    // Resolve the actual key value — skip if env var is missing or empty
    const resolvedKey = api.key.startsWith('env:')
      ? (process.env[api.key.replace('env:', '')] || '')
      : api.key
    return resolvedKey.length > 0
  })
  if (!available.length) return null

  // Score: lower is better — blend usage count, response time, and failure history
  const scored = available
    .map(api => {
      const avgMs      = responseTimesMs.get(api.name) ?? 2000  // assume 2s if unknown
      const usageScore = (api.usageCount || 0) * 0.1
      const timeScore  = avgMs / 1000
      return { api, score: usageScore + timeScore }
    })
    .sort((a, b) => a.score - b.score)

  const entry = scored[0].api
  return { provider: buildProvider(entry), model: entry.model, entry }
}

// ── Mark an API as rate-limited ───────────────────────────────

export function markRateLimited(apiName: string): void {
  const config = loadConfig()
  // Find the provider type to get the right window
  const entry  = config.providers.apis.find(a => a.name === apiName)
  const window = entry ? (RATE_LIMIT_WINDOWS[entry.provider] ?? DEFAULT_RATE_LIMIT_MS) : DEFAULT_RATE_LIMIT_MS
  config.providers.apis = config.providers.apis.map(api =>
    api.name === apiName
      ? { ...api, rateLimited: true, rateLimitedAt: Date.now() }
      : api
  )
  saveConfig(config)
  const resetSecs = window === 0 ? 'never' : `${window / 1000}s`
  console.log(`[Router] ${apiName} rate limited — auto-reset in ${resetSecs}`)
}

// ── Record response time (EWMA) ───────────────────────────────
// Call this after each successful LLM response to improve provider selection.

export function recordResponseTime(providerName: string, ms: number): void {
  const prev = responseTimesMs.get(providerName)
  // Exponential moving average — weight recent observations at 20%
  responseTimesMs.set(providerName, prev ? prev * 0.8 + ms * 0.2 : ms)
}

// ── Increment usage count ─────────────────────────────────────

export function incrementUsage(apiName: string): void {
  if (apiName === 'ollama') return // don't track Ollama usage
  const config = loadConfig()
  config.providers.apis = config.providers.apis.map(api =>
    api.name === apiName ? { ...api, usageCount: (api.usageCount || 0) + 1 } : api
  )
  saveConfig(config)
}

// ── Log which providers are active at startup ────────────────

export function logProviderStatus(): void {
  const config = loadConfig()
  const apis   = config.providers.apis

  console.log('[Router] Provider chain:')
  let order = 1
  for (const api of apis) {
    const resolvedKey = api.key.startsWith('env:')
      ? (process.env[api.key.replace('env:', '')] || '')
      : api.key
    const keyStatus = resolvedKey.length > 0 ? '✓ key present' : '✗ key missing'
    const status    = !api.enabled ? 'disabled' : api.rateLimited ? 'rate-limited' : resolvedKey.length === 0 ? 'SKIPPED (no key)' : `#${order++} active`
    console.log(`  ${api.name} (${api.provider}/${api.model}) — ${keyStatus} — ${status}`)
  }
  console.log(`  ollama — local — #${order} guaranteed fallback`)
}

// ── Main entry: get smart provider with full fallback chain ───

export function getSmartProvider(): {
  provider: Provider
  model:    string
  userName: string
  apiName:  string
} {
  const config   = loadConfig()
  const userName = config.user?.name || 'there'

  // MANUAL MODE: use the explicitly selected active provider
  if (config.routing?.mode === 'manual') {
    if (config.model.active === 'ollama') {
      return { provider: ollamaProvider, model: config.model.activeModel || 'mistral:7b', userName, apiName: 'ollama' }
    }
    const active = config.providers.apis.find(a => a.name === config.model.active)
    if (active && active.enabled && !active.rateLimited) {
      return { provider: buildProvider(active), model: active.model || config.model.activeModel, userName, apiName: active.name }
    }
    // Configured API is unavailable — fall through to auto
  }

  // AUTO MODE: round-robin across available APIs
  const next = getNextAvailableAPI()
  if (next) {
    return { provider: next.provider, model: next.entry.model || 'llama-3.3-70b-versatile', userName, apiName: next.entry.name }
  }

  // FALLBACK: Ollama
  if (config.routing?.fallbackToOllama !== false) {
    console.log('[Router] All APIs unavailable — falling back to Ollama')
    return { provider: ollamaProvider, model: config.model.activeModel || 'mistral:7b', userName, apiName: 'ollama' }
  }

  // Last resort
  return { provider: ollamaProvider, model: 'mistral:7b', userName, apiName: 'ollama' }
}
