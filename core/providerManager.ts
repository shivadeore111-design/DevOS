// ============================================================
// core/providerManager.ts — Bring Your Own Key provider manager
// Supports Ollama (free/local) + 9 cloud providers via BYOK
// ============================================================

import * as fs   from 'fs'
import * as path from 'path'

export type Provider =
  | 'ollama'
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'groq'
  | 'together'
  | 'openrouter'
  | 'mistral'
  | 'cohere'
  | 'deepseek'

export interface ProviderConfig {
  provider: Provider
  apiKey?:  string
  model:    string
  baseUrl?: string
}

const CONFIG_PATH = path.join(process.cwd(), 'config', 'providers.json')

const PROVIDER_DEFAULTS: Record<Provider, { baseUrl: string; defaultModel: string; label: string }> = {
  ollama:     { baseUrl: 'http://localhost:11434',                    defaultModel: 'llama3.2:latest',                    label: 'Ollama (Free, Local)' },
  openai:     { baseUrl: 'https://api.openai.com/v1',                defaultModel: 'gpt-4o-mini',                        label: 'OpenAI' },
  anthropic:  { baseUrl: 'https://api.anthropic.com',                defaultModel: 'claude-sonnet-4-20250514',           label: 'Anthropic' },
  gemini:     { baseUrl: 'https://generativelanguage.googleapis.com', defaultModel: 'gemini-2.0-flash',                  label: 'Google Gemini' },
  groq:       { baseUrl: 'https://api.groq.com/openai/v1',           defaultModel: 'llama-3.3-70b-versatile',           label: 'Groq (Fast)' },
  together:   { baseUrl: 'https://api.together.xyz/v1',              defaultModel: 'meta-llama/Llama-3-70b-chat-hf',    label: 'Together AI' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1',             defaultModel: 'anthropic/claude-3-haiku',          label: 'OpenRouter' },
  mistral:    { baseUrl: 'https://api.mistral.ai/v1',                defaultModel: 'mistral-small-latest',              label: 'Mistral AI' },
  cohere:     { baseUrl: 'https://api.cohere.ai/v1',                 defaultModel: 'command-r-plus',                    label: 'Cohere' },
  deepseek:   { baseUrl: 'https://api.deepseek.com/v1',              defaultModel: 'deepseek-chat',                     label: 'DeepSeek' },
}

class ProviderManager {

  private config: ProviderConfig

  constructor() {
    this.config = this.load()
  }

  private load(): ProviderConfig {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
      }
    } catch {}
    // Default to Ollama — free, no key needed
    return { provider: 'ollama', model: 'llama3.2:latest' }
  }

  save(): void {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true })
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2))
  }

  getProvider(): Provider          { return this.config.provider }
  getModel(): string               { return this.config.model }
  getApiKey(): string | undefined  { return this.config.apiKey }
  getBaseUrl(): string             { return this.config.baseUrl ?? PROVIDER_DEFAULTS[this.config.provider].baseUrl }
  isLocal(): boolean               { return this.config.provider === 'ollama' }
  getLabel(): string               { return PROVIDER_DEFAULTS[this.config.provider]?.label ?? this.config.provider }

  setProvider(provider: Provider, apiKey?: string, model?: string): void {
    this.config = {
      provider,
      apiKey,
      model:   model ?? PROVIDER_DEFAULTS[provider].defaultModel,
      baseUrl: PROVIDER_DEFAULTS[provider].baseUrl,
    }
    this.save()
    console.log(`[Provider] Switched to ${this.getLabel()} — model: ${this.config.model}`)
  }

  listProviders(): void {
    console.log('\nAvailable providers:')
    for (const [key, val] of Object.entries(PROVIDER_DEFAULTS)) {
      const active = key === this.config.provider ? ' ← active' : ''
      const hasKey = key === 'ollama' ? '(free, local)' : '(API key required)'
      console.log(`  ${key.padEnd(12)} ${val.label.padEnd(22)} ${hasKey}${active}`)
    }
    console.log()
  }

  async callLLM(prompt: string, system?: string, modelOverride?: string): Promise<string> {
    const model = modelOverride ?? this.config.model

    if (this.config.provider === 'ollama') {
      const ollamaModule = require('../llm/ollama')
      const fn = ollamaModule.callOllama ?? ollamaModule.default
      return fn(prompt, system, model)
    }

    // OpenAI-compatible endpoints
    const openAICompat: Provider[] = ['openai', 'groq', 'together', 'openrouter', 'mistral', 'deepseek', 'cohere']
    if (openAICompat.includes(this.config.provider)) {
      return this.callOpenAICompat(prompt, system, model)
    }

    if (this.config.provider === 'anthropic') {
      return this.callAnthropic(prompt, system, model)
    }

    if (this.config.provider === 'gemini') {
      return this.callGemini(prompt, system, model)
    }

    throw new Error(`Unknown provider: ${this.config.provider}`)
  }

  private async callOpenAICompat(prompt: string, system?: string, model?: string): Promise<string> {
    const axios = (await import('axios')).default
    const messages: { role: string; content: string }[] = []
    if (system) messages.push({ role: 'system', content: system })
    messages.push({ role: 'user', content: prompt })

    const res = await axios.post(
      `${this.getBaseUrl()}/chat/completions`,
      { model: model ?? this.config.model, messages, max_tokens: 1000, temperature: 0.3 },
      {
        headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
        timeout: 30000,
      }
    )
    return (res.data as any).choices[0]?.message?.content ?? ''
  }

  private async callAnthropic(prompt: string, system?: string, model?: string): Promise<string> {
    const axios = (await import('axios')).default
    const res = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model:      model ?? this.config.model,
        max_tokens: 1000,
        system:     system ?? 'You are DevOS, a personal AI OS.',
        messages:   [{ role: 'user', content: prompt }],
      },
      {
        headers: {
          'x-api-key':          this.config.apiKey,
          'anthropic-version':  '2023-06-01',
          'Content-Type':       'application/json',
        },
        timeout: 30000,
      }
    )
    return (res.data as any).content[0]?.text ?? ''
  }

  private async callGemini(prompt: string, system?: string, model?: string): Promise<string> {
    const axios = (await import('axios')).default
    const activeModel = model ?? this.config.model
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${this.config.apiKey}`,
      {
        contents:         [{ parts: [{ text: system ? `${system}\n\n${prompt}` : prompt }] }],
        generationConfig: { maxOutputTokens: 1000, temperature: 0.3 },
      },
      { timeout: 30000 }
    )
    return (res.data as any).candidates[0]?.content?.parts[0]?.text ?? ''
  }
}

export const providerManager = new ProviderManager()
