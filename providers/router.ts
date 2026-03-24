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

const RATE_LIMIT_RESET_MS = 60 * 60 * 1000 // 1 hour

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
    if (api.rateLimited && api.rateLimitedAt && Date.now() - api.rateLimitedAt > RATE_LIMIT_RESET_MS) {
      changed = true
      const { rateLimitedAt, ...rest } = api
      return { ...rest, rateLimited: false }
    }
    return api
  })

  if (changed) saveConfig(config)
  return changed
}

// ── Get next available API (least used, not rate-limited) ─────

export function getNextAvailableAPI(): { provider: Provider; model: string; entry: APIEntry } | null {
  autoResetExpiredLimits()
  const config    = loadConfig()
  const available = config.providers.apis.filter(api =>
    api.enabled && !api.rateLimited && api.key
  )
  if (!available.length) return null

  // Round-robin: pick least used
  const entry = available.sort((a, b) => (a.usageCount || 0) - (b.usageCount || 0))[0]
  return { provider: buildProvider(entry), model: entry.model, entry }
}

// ── Mark an API as rate-limited ───────────────────────────────

export function markRateLimited(apiName: string): void {
  const config = loadConfig()
  config.providers.apis = config.providers.apis.map(api =>
    api.name === apiName
      ? { ...api, rateLimited: true, rateLimitedAt: Date.now() }
      : api
  )
  saveConfig(config)
  console.log(`[Router] ${apiName} rate limited — will auto-reset in 1 hour`)
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
