// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// providers/index.ts — Config schema, load/save, legacy provider resolver

import * as fs   from 'fs'
import * as path from 'path'
import { Provider } from './types'
import { ollamaProvider } from './ollama'
import { createGroqProvider } from './groq'
import { createOpenRouterProvider } from './openrouter'
import { createGeminiProvider } from './gemini'

// ── Config schema ─────────────────────────────────────────────

export interface TelegramConfig {
  enabled:         boolean
  botToken:        string
  allowedChatIds:  string[]
  pollingInterval: number
}

export interface APIEntry {
  name:           string        // e.g. "groq-1", "groq-2"
  provider:       string        // "groq" | "openrouter" | "gemini" | "cerebras" | "nvidia"
  key:            string        // actual API key (or "env:VAR_NAME")
  model:          string        // default model for this entry
  enabled:        boolean       // user can disable without deleting
  rateLimited:    boolean       // auto-set to true when 429 hit
  rateLimitedAt?: number        // timestamp when rate limited
  usageCount:     number        // how many times used this session
}

export interface DevOSConfig {
  user:    { name: string }
  model:   { active: string; activeModel: string }
  providers: {
    ollama: { enabled: boolean; models: string[] }
    apis:   APIEntry[]
  }
  ollama?: {
    model:          string
    plannerModel?:  string
    coderModel?:    string
    fastModel?:     string
    fallbackModels: string[]
    baseUrl:        string
  }
  routing: {
    mode:            'auto' | 'manual'   // auto = cycle through, manual = use active only
    fallbackToOllama: boolean            // if all APIs rate limited, use Ollama
  }
  onboardingComplete: boolean
  telegram?:          TelegramConfig
  calendar?: {
    icalUrl: string   // Google Calendar "Secret address in iCal format"
  }
  gmail?: {
    email:       string   // Gmail address
    appPassword: string   // 16-char Google App Password
  }
}

const CONFIG_PATH = path.join(process.cwd(), 'config', 'devos.config.json')

// ── Defaults ──────────────────────────────────────────────────

function defaultConfig(): DevOSConfig {
  return {
    user:  { name: 'there' },
    model: { active: 'cerebras-free', activeModel: 'llama3.1-8b' },
    providers: {
      ollama: { enabled: true, models: [] },
      apis: [
        {
          name:        'cerebras-free',
          provider:    'cerebras',
          key:         'csk-w32jtjthv666erywhmxrkpx9kfnehn4e6cp38n3d3kmym943',
          model:       'llama3.1-8b',
          enabled:     true,
          rateLimited: false,
          usageCount:  0,
        },
        {
          name:        'cloudflare-free',
          provider:    'cloudflare',
          key:         'env:CLOUDFLARE_API_TOKEN',
          model:       'env:CLOUDFLARE_ACCOUNT_ID|@cf/meta/llama-3.1-8b-instruct',
          enabled:     false,
          rateLimited: false,
          usageCount:  0,
        },
      ],
    },
    routing:            { mode: 'auto', fallbackToOllama: true },
    onboardingComplete: false,
  }
}

// ── Load / save ───────────────────────────────────────────────

export function loadConfig(): DevOSConfig {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) as any
    // Back-compat: migrate old apis entries that lack new fields
    if (raw.providers?.apis) {
      raw.providers.apis = (raw.providers.apis as any[]).map(a => ({
        model:       '',
        enabled:     true,
        rateLimited: false,
        usageCount:  0,
        ...a,
      }))
    }
    // Back-compat: add routing if missing
    if (!raw.routing) raw.routing = { mode: 'auto', fallbackToOllama: true }
    return raw as DevOSConfig
  } catch {
    return defaultConfig()
  }
}

export function saveConfig(config: DevOSConfig): void {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true })
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

// ── Legacy active provider resolver (used by onboarding fallback) ──

export function getActiveProvider(): { provider: Provider; model: string; userName: string } {
  const config   = loadConfig()
  const userName = config.user?.name || 'there'

  if (config.model.active === 'ollama') {
    return { provider: ollamaProvider, model: config.model.activeModel || 'mistral:7b', userName }
  }

  const apiConfig = config.providers?.apis?.find(a => a.name === config.model.active)
  if (!apiConfig) {
    return { provider: ollamaProvider, model: config.model.activeModel || 'mistral:7b', userName }
  }

  const key = apiConfig.key.startsWith('env:')
    ? process.env[apiConfig.key.replace('env:', '')] || ''
    : apiConfig.key

  switch (apiConfig.provider) {
    case 'groq':
      return { provider: createGroqProvider(key), model: apiConfig.model || 'llama-3.3-70b-versatile', userName }
    case 'openrouter':
      return { provider: createOpenRouterProvider(key), model: apiConfig.model || 'meta-llama/llama-3.3-70b-instruct', userName }
    case 'gemini':
      return { provider: createGeminiProvider(key), model: apiConfig.model || 'gemini-1.5-flash', userName }
    default:
      return { provider: ollamaProvider, model: config.model.activeModel || 'mistral:7b', userName }
  }
}
