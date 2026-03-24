// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// providers/index.ts — Config loader + active provider resolver

import * as fs   from 'fs'
import * as path from 'path'
import { Provider } from './types'
import { ollamaProvider } from './ollama'
import { createGroqProvider } from './groq'
import { createOpenRouterProvider } from './openrouter'
import { createGeminiProvider } from './gemini'

// ── Config schema ─────────────────────────────────────────────

export interface DevOSConfig {
  user:    { name: string }
  model:   { active: string; activeModel: string; fallback?: string }
  providers: {
    ollama: { enabled: boolean; models: string[] }
    apis:   { name: string; provider: string; key: string }[]
  }
  onboardingComplete: boolean
}

const CONFIG_PATH = path.join(process.cwd(), 'config', 'devos.config.json')

// ── Load / save ───────────────────────────────────────────────

export function loadConfig(): DevOSConfig {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) as DevOSConfig
  } catch {
    return {
      user:    { name: 'there' },
      model:   { active: 'ollama', activeModel: 'mistral:7b' },
      providers: {
        ollama: { enabled: true, models: [] },
        apis:   [],
      },
      onboardingComplete: false,
    }
  }
}

export function saveConfig(config: DevOSConfig): void {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true })
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

// ── Active provider resolver ──────────────────────────────────

export function getActiveProvider(): { provider: Provider; model: string; userName: string } {
  const config   = loadConfig()
  const userName = config.user?.name || 'there'

  // Ollama (local)
  if (config.model.active === 'ollama') {
    return { provider: ollamaProvider, model: config.model.activeModel || 'mistral:7b', userName }
  }

  // Cloud API
  const apiConfig = config.providers?.apis?.find(a => a.name === config.model.active)
  if (!apiConfig) {
    return { provider: ollamaProvider, model: config.model.activeModel || 'mistral:7b', userName }
  }

  // Resolve env-prefixed keys
  const key = apiConfig.key.startsWith('env:')
    ? process.env[apiConfig.key.replace('env:', '')] || ''
    : apiConfig.key

  switch (apiConfig.provider) {
    case 'groq':
      return { provider: createGroqProvider(key), model: config.model.activeModel || 'llama-3.3-70b-versatile', userName }
    case 'openrouter':
      return { provider: createOpenRouterProvider(key), model: config.model.activeModel || 'meta-llama/llama-3.3-70b-instruct', userName }
    case 'gemini':
      return { provider: createGeminiProvider(key), model: config.model.activeModel || 'gemini-1.5-flash', userName }
    default:
      return { provider: ollamaProvider, model: config.model.activeModel || 'mistral:7b', userName }
  }
}
