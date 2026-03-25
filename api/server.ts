// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// api/server.ts — DevOS REST API server
//
// Imports ONLY from files that exist in the actual codebase.
// All 34+ missing-module imports from the prior version have been removed.
//
// Endpoints:
//   GET  /api/health          — liveness check (no auth)
//   POST /api/chat            — queue a user message
//   POST /api/goals           — queue a goal
//   GET  /api/goals           — placeholder goal list
//   GET  /api/doctor          — system health report
//   GET  /api/models          — compatible model list
//   GET  /api/stream          — SSE keep-alive stream
//   POST /api/automate        — start visionLoop session
//   POST /api/automate/stop   — abort visionLoop
//   GET  /api/automate/log    — screenAgent action log
//   GET  /api/automate/session— live executor session

import * as fs   from 'fs'
import * as path from 'path'
import * as http from 'http'
import express, { Express, Request, Response, NextFunction } from 'express'
import { WebSocketServer } from 'ws'

// ── Real imports only ─────────────────────────────────────────
import { memoryLayers }   from '../memory/memoryLayers'
import { livePulse }      from '../coordination/livePulse'
import { runDoctor }      from '../core/doctor'
import { modelRouter }    from '../core/modelRouter'
import { registerComputerUseRoutes } from './routes/computerUse'
import { loadConfig, saveConfig, APIEntry } from '../providers/index'
import { ollamaProvider } from '../providers/ollama'
import { getSmartProvider, markRateLimited, incrementUsage } from '../providers/router'
import { executeTool } from '../core/toolRegistry'
import type { ToolDefinition, ToolCall } from '../providers/types'

// ── App factory ───────────────────────────────────────────────

export function createApiServer(): Express {
  const app = express()

  // ── Middleware ───────────────────────────────────────────────

  // JSON body parsing (10 MB limit)
  app.use(express.json({ limit: '10mb' }))

  // Security headers
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    next()
  })

  // CORS — allow any origin (dev mode)
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin',  '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    if (req.method === 'OPTIONS') { res.sendStatus(200); return }
    next()
  })

  // ── Core routes ──────────────────────────────────────────────

  // GET /api/health — liveness probe (no auth required)
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() })
  })

  // ── Intent detection (sync) ───────────────────────────────────
  function detectIntent(message: string): 'chat' | 'execute' {
    const lower = message.toLowerCase().trim()

    // Short messages and questions always go to chat
    if (lower.split(' ').length < 4) return 'chat'
    if (/\?$/.test(lower))           return 'chat'
    if (/^(hi|hello|hey|thanks|thank you|ok|okay|got it|nice|cool|great|what|who|why|when|where|how|is |are |can you tell|do you|did you|tell me|explain|describe)/.test(lower)) return 'chat'

    // Clear action commands go to execute
    if (/^(open |launch |start |run |execute |create |make |build |write |delete |move |copy |install |deploy |download |search for |go to |navigate to |find me |show me |give me |send |close |kill |restart )/.test(lower)) return 'execute'

    return 'chat'
  }

  // ── DevOS tool definitions ────────────────────────────────────

  const DEVOS_TOOLS: ToolDefinition[] = [
    { name: 'open_browser',      description: 'Open a URL in a real Chromium browser window',                     parameters: { type: 'object', properties: { url: { type: 'string', description: 'Full URL including https://' } }, required: ['url'] } },
    { name: 'browser_extract',   description: 'Extract all text from the currently open browser page',            parameters: { type: 'object', properties: {} } },
    { name: 'browser_click',     description: 'Click an element on the current browser page',                     parameters: { type: 'object', properties: { selector: { type: 'string', description: 'CSS selector or visible text' } }, required: ['selector'] } },
    { name: 'browser_type',      description: 'Type text into an input field on the current page',                parameters: { type: 'object', properties: { selector: { type: 'string', description: 'CSS selector of input' }, text: { type: 'string', description: 'Text to type' } }, required: ['selector', 'text'] } },
    { name: 'browser_screenshot', description: 'Take a screenshot of the current browser page',                   parameters: { type: 'object', properties: {} } },
    { name: 'shell_exec',        description: 'Run a PowerShell command on Windows and get real output',          parameters: { type: 'object', properties: { command: { type: 'string', description: 'PowerShell command' } }, required: ['command'] } },
    { name: 'file_write',        description: 'Create or overwrite a file with content',                          parameters: { type: 'object', properties: { path: { type: 'string', description: 'Full path e.g. C:\\Users\\shiva\\Desktop\\test.txt' }, content: { type: 'string', description: 'File content' } }, required: ['path', 'content'] } },
    { name: 'file_read',         description: 'Read a file and return its contents',                              parameters: { type: 'object', properties: { path: { type: 'string', description: 'Full file path' } }, required: ['path'] } },
    { name: 'file_list',         description: 'List files in a directory',                                        parameters: { type: 'object', properties: { path: { type: 'string', description: 'Directory path' } } } },
    { name: 'run_python',        description: 'Write and run a Python script, returns stdout output',             parameters: { type: 'object', properties: { script: { type: 'string', description: 'Python code to run' } }, required: ['script'] } },
    { name: 'run_node',          description: 'Write and run a Node.js script, returns stdout output',            parameters: { type: 'object', properties: { script: { type: 'string', description: 'JavaScript code to run' } }, required: ['script'] } },
    { name: 'web_search',        description: 'Search the web and return real results. Use for weather, news, current info.', parameters: { type: 'object', properties: { query: { type: 'string', description: 'Search query' } }, required: ['query'] } },
    { name: 'fetch_url',         description: 'Fetch and return text content from a URL',                         parameters: { type: 'object', properties: { url: { type: 'string', description: 'URL to fetch' } }, required: ['url'] } },
    { name: 'system_info',       description: 'Get real system info — CPU, RAM, disk space, OS, username',        parameters: { type: 'object', properties: {} } },
    { name: 'notify',            description: 'Send a Windows desktop toast notification',                        parameters: { type: 'object', properties: { message: { type: 'string', description: 'Notification message' } }, required: ['message'] } },
  ]

  // ── Icons / styles for activity SSE events ────────────────────
  const ACTIVITY_ICONS: Record<string, string> = {
    act: '⚙️', done: '✅', error: '❌', warn: '⚠️', info: 'ℹ️', thinking: '💭', tool: '🔧',
  }

  // POST /api/chat — function calling loop + SSE streaming
  app.post('/api/chat', async (req: Request, res: Response) => {
    const { message, history = [] } = req.body as {
      message?: string; history?: { role: string; content: string }[]
    }
    if (!message) { res.status(400).json({ error: 'message required' }); return }

    res.setHeader('Content-Type',  'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection',    'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.flushHeaders()

    const send = (data: object) => {
      try { res.write(`data: ${JSON.stringify(data)}\n\n`) } catch {}
    }

    let attempt   = 0
    const MAX_RETRIES = 3

    while (attempt < MAX_RETRIES) {
      attempt++
      const { provider, model, userName, apiName } = getSmartProvider()

      const systemPrompt = `You are Aiden — a personal AI OS running on ${userName}'s Windows machine. You are calm, direct, capable, and slightly witty. You speak like a trusted co-founder.

You have REAL tools. When asked to DO something, call the appropriate tool — do not describe doing it, actually do it.

RULES:
- Use open_browser to open websites — it uses real Chromium, not just a command
- Use web_search for weather, news, current prices, anything that needs live data
- Use shell_exec for PowerShell commands — you get the real stdout back
- Use file_write/file_read for files — you get confirmation it was written
- Use system_info to get real CPU/RAM/disk info
- After a tool runs you see the REAL output — report it accurately
- Never claim you did something if the tool failed
- For simple chat/questions, just respond naturally without tools
- Be concise. 1-3 sentences for simple answers.

Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`

      try {
        const conversationMessages = [
          { role: 'system', content: systemPrompt },
          ...history.slice(-8),
          { role: 'user', content: message },
        ]

        // ── PATH 1: Function calling (Groq, Gemini) ───────────────
        if (provider.generateWithTools) {
          let   currentMessages = [...conversationMessages]
          const MAX_ITER        = 6
          let   iteration       = 0

          while (iteration < MAX_ITER) {
            iteration++

            const { content, toolCalls } = await provider.generateWithTools(
              currentMessages, model, DEVOS_TOOLS
            )

            if (!toolCalls.length) {
              // Final answer — stream word by word
              if (content) {
                const words = content.split(' ')
                for (const word of words) {
                  send({ token: word + ' ', done: false, provider: apiName })
                  await new Promise(r => setTimeout(r, 12))
                }
              }
              incrementUsage(apiName)
              send({ done: true, provider: apiName })
              res.end()
              memoryLayers.write(`User: ${message}`, ['chat'])
              return
            }

            // Execute each tool call for real
            for (const tc of toolCalls) {
              send({
                activity: {
                  icon:    '🔧',
                  agent:   'Aiden',
                  message: `${tc.name}(${JSON.stringify(tc.arguments).slice(0, 100)})`,
                  style:   'tool',
                },
                done: false,
              })

              const result = await executeTool(tc.name, tc.arguments)

              send({
                activity: {
                  icon:    result.success ? '✅' : '❌',
                  agent:   'Aiden',
                  message: (result.success ? result.output : result.error || 'failed').slice(0, 160),
                  style:   result.success ? 'done' : 'error',
                },
                done: false,
              })

              // Feed result back to LLM as user message
              currentMessages = [
                ...currentMessages,
                { role: 'assistant', content: content || `Calling ${tc.name}` },
                {
                  role: 'user',
                  content: `Tool ${tc.name} result: ${
                    result.success ? result.output.slice(0, 800) : 'FAILED: ' + result.error
                  }`,
                },
              ]
            }
          }

          // Max iterations hit — just send done
          incrementUsage(apiName)
          send({ done: true, provider: apiName })
          res.end()
          return
        }

        // ── PATH 2: No function calling (Ollama / fallback) ───────
        // Pre-fetch web data if the query looks like it needs live info
        const needsSearch = /weather|news|latest|current|today|price|stock|score/i.test(message)
        let webContext     = ''
        if (needsSearch) {
          send({
            activity: { icon: '🔍', agent: 'Aiden', message: 'Searching the web...', style: 'act' },
            done: false,
          })
          try {
            const result = await executeTool('web_search', { query: message })
            if (result.success && result.output) {
              webContext = `\n\nReal search results:\n${result.output}\n\nAnswer using ONLY this data. Do not make up information.`
            }
          } catch {}
        }

        const msgs = [
          { role: 'system', content: systemPrompt + webContext },
          ...history.slice(-8),
          { role: 'user', content: message },
        ]

        let streamEnded = false
        const streamTimeout = setTimeout(() => {
          if (!streamEnded) { send({ done: true, error: 'Response timed out — try again' }); res.end() }
        }, 30000)

        await provider.generateStream(msgs, model, (token) => {
          send({ token, done: false, provider: apiName })
        })

        streamEnded = true
        clearTimeout(streamTimeout)
        incrementUsage(apiName)
        send({ done: true, provider: apiName })
        res.end()
        memoryLayers.write(`User: ${message}`, ['chat'])
        return

      } catch (err: any) {
        const is429 = err.message?.includes('429') || err.message?.toLowerCase().includes('rate')
        if (is429 && apiName !== 'ollama') {
          markRateLimited(apiName)
          send({ token: `\n⚡ ${apiName} rate limited — switching...\n`, done: false })
          continue
        }
        send({ done: true, error: err.message })
        res.end()
        return
      }
    }

    send({ done: true, error: 'All providers unavailable. Start Ollama: ollama serve' })
    res.end()
  })

  // GET /api/onboarding — check status + get available models
  app.get('/api/onboarding', async (_req: Request, res: Response) => {
    const config          = loadConfig()
    const installedModels = await ollamaProvider.listModels?.() || []

    const RECOMMENDED: Record<string, { label: string; contextWindow: number; speed: string }> = {
      'llama3.2:3b':         { label: 'Llama 3.2 3B',       contextWindow: 128000, speed: '⚡ fastest'  },
      'mistral:7b':          { label: 'Mistral 7B',          contextWindow: 32000,  speed: '🔥 fast'     },
      'qwen2.5:7b':          { label: 'Qwen 2.5 7B',         contextWindow: 128000, speed: '🔥 fast'     },
      'qwen2.5-coder:7b':    { label: 'Qwen 2.5 Coder 7B',   contextWindow: 128000, speed: '🔥 fast'     },
      'llama3.1:8b':         { label: 'Llama 3.1 8B',        contextWindow: 128000, speed: '🔥 fast'     },
      'phi4:mini':           { label: 'Phi-4 Mini',          contextWindow: 128000, speed: '⚡ fastest'  },
      'mistral-nemo:12b':    { label: 'Mistral Nemo 12B',    contextWindow: 128000, speed: '💪 powerful' },
      'llama3.3:70b':        { label: 'Llama 3.3 70B',       contextWindow: 128000, speed: '💪 powerful' },
    }

    const localModels = installedModels.map(name => ({
      id:          name,
      label:       RECOMMENDED[name]?.label || name,
      speed:       RECOMMENDED[name]?.speed || '🔥 fast',
      contextWindow: RECOMMENDED[name]?.contextWindow || 32000,
      installed:   true,
      recommended: name.includes('qwen2.5') || name.includes('llama3') || name.includes('phi4'),
    })).sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0))

    const cloudProviders = [
      { id: 'groq',       label: 'Groq',       subtitle: 'Free tier · llama3.3:70b · blazing fast', url: 'https://console.groq.com',              models: ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'] },
      { id: 'openrouter', label: 'OpenRouter', subtitle: 'Access 200+ models · pay per use',         url: 'https://openrouter.ai/keys',             models: ['meta-llama/llama-3.3-70b-instruct', 'anthropic/claude-3.5-sonnet', 'openai/gpt-4o'] },
      { id: 'gemini',     label: 'Gemini',     subtitle: 'Free tier available · fast',               url: 'https://aistudio.google.com/app/apikey', models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'] },
    ]

    res.json({
      onboardingComplete: config.onboardingComplete,
      userName:           config.user?.name,
      localModels,
      cloudProviders,
      activeModel:        config.model,
      existingApis:       config.providers?.apis?.map(a => ({ name: a.name, provider: a.provider })) || [],
    })
  })

  // POST /api/onboarding — save onboarding result
  app.post('/api/onboarding', (req: Request, res: Response) => {
    const { userName, modelType, modelId, apiProvider, apiKey, apiName, apiModel } = req.body as {
      userName?: string; modelType?: string; modelId?: string
      apiProvider?: string; apiKey?: string; apiName?: string; apiModel?: string
    }
    const config     = loadConfig()
    config.user.name = userName || 'there'

    if (modelType === 'local' && modelId) {
      config.model = { active: 'ollama', activeModel: modelId }
    } else if (modelType === 'api' && apiKey && apiProvider) {
      const entry: APIEntry = {
        name:        apiName || `${apiProvider}-main`,
        provider:    apiProvider,
        key:         apiKey,
        model:       apiModel || getDefaultModel(apiProvider),
        enabled:     true,
        rateLimited: false,
        usageCount:  0,
      }
      const idx = config.providers.apis.findIndex(a => a.name === entry.name)
      if (idx >= 0) config.providers.apis[idx] = entry
      else config.providers.apis.push(entry)
      config.model = { active: entry.name, activeModel: entry.model }
    }

    if (!config.routing) config.routing = { mode: 'auto', fallbackToOllama: true }
    config.onboardingComplete = true
    saveConfig(config)
    res.json({ success: true, config })
  })

  // GET /api/providers — list all configured APIs with status
  app.get('/api/providers', (_req: Request, res: Response) => {
    const config = loadConfig()
    res.json({
      apis: config.providers.apis.map(api => ({
        name:          api.name,
        provider:      api.provider,
        model:         api.model,
        enabled:       api.enabled,
        rateLimited:   api.rateLimited,
        rateLimitedAt: api.rateLimitedAt,
        usageCount:    api.usageCount || 0,
        hasKey:        !!api.key,
      })),
      routing: config.routing || { mode: 'auto', fallbackToOllama: true },
      ollama:  config.providers.ollama,
    })
  })

  // POST /api/providers/add — add or update a single API key
  app.post('/api/providers/add', (req: Request, res: Response) => {
    const { name, provider, key, model, enabled = true } = req.body as {
      name?: string; provider?: string; key?: string; model?: string; enabled?: boolean
    }
    if (!provider || !key) { res.status(400).json({ error: 'provider and key required' }); return }

    const config = loadConfig()
    const entry: APIEntry = {
      name:        name || `${provider}-${config.providers.apis.filter(a => a.provider === provider).length + 1}`,
      provider,
      key,
      model:       model || getDefaultModel(provider),
      enabled:     enabled !== false,
      rateLimited: false,
      usageCount:  0,
    }
    const idx = config.providers.apis.findIndex(a => a.name === entry.name)
    if (idx >= 0) config.providers.apis[idx] = { ...config.providers.apis[idx], ...entry }
    else config.providers.apis.push(entry)

    if (!config.routing) config.routing = { mode: 'auto', fallbackToOllama: true }
    saveConfig(config)
    res.json({ success: true, entry: { ...entry, key: '***' } })
  })

  // DELETE /api/providers/:name — remove an API
  app.delete('/api/providers/:name', (req: Request, res: Response) => {
    const config = loadConfig()
    config.providers.apis = config.providers.apis.filter(a => a.name !== req.params.name)
    saveConfig(config)
    res.json({ success: true })
  })

  // PATCH /api/providers/:name — update enabled/rateLimited/model etc.
  app.patch('/api/providers/:name', (req: Request, res: Response) => {
    const config = loadConfig()
    config.providers.apis = config.providers.apis.map(a =>
      a.name === req.params.name ? { ...a, ...req.body } : a
    )
    saveConfig(config)
    res.json({ success: true })
  })

  // POST /api/providers/reset-limits — manually reset all rate limits
  app.post('/api/providers/reset-limits', (_req: Request, res: Response) => {
    const config = loadConfig()
    config.providers.apis = config.providers.apis.map(a => ({ ...a, rateLimited: false, rateLimitedAt: undefined }))
    saveConfig(config)
    res.json({ success: true, message: 'All rate limits reset' })
  })

  // POST /api/providers/switch — switch active model/provider
  app.post('/api/providers/switch', (req: Request, res: Response) => {
    const { active, activeModel } = req.body as { active?: string; activeModel?: string }
    const config = loadConfig()
    config.model = { active: active || 'ollama', activeModel: activeModel || 'mistral:7b' }
    saveConfig(config)
    res.json({ success: true })
  })

  // GET /api/config — current active model + user info
  app.get('/api/config', (_req: Request, res: Response) => {
    const config = loadConfig()
    res.json({
      userName:            config.user.name,
      activeModel:         config.model.activeModel,
      activeProvider:      config.model.active,
      onboardingComplete:  config.onboardingComplete,
      routing:             config.routing,
    })
  })

  // POST /api/providers/validate — test an API key without saving it
  app.post('/api/providers/validate', async (req: Request, res: Response) => {
    const { provider, key, model } = req.body as { provider?: string; key?: string; model?: string }
    if (!provider || !key) { res.status(400).json({ valid: false, error: 'Missing provider or key' }); return }

    const testMessages = [{ role: 'user', content: 'Say "ok" in one word only.' }]
    const testModel    = model || getDefaultModel(provider)

    try {
      let valid = false
      let error = ''

      switch (provider) {
        case 'groq': {
          const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body:    JSON.stringify({ model: testModel, messages: testMessages, max_tokens: 5 }),
            signal:  AbortSignal.timeout(8000),
          })
          valid = r.ok
          if (!r.ok) error = `${r.status}: ${await r.text()}`
          break
        }
        case 'gemini': {
          const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
            {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({ contents: [{ parts: [{ text: 'Say ok' }] }] }),
              signal:  AbortSignal.timeout(8000),
            }
          )
          valid = r.ok
          if (!r.ok) error = `${r.status}: ${await r.text()}`
          break
        }
        case 'openrouter': {
          const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method:  'POST',
            headers: {
              'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`,
              'HTTP-Referer': 'http://localhost:3000', 'X-Title': 'DevOS',
            },
            body:   JSON.stringify({ model: 'meta-llama/llama-3.2-1b-instruct:free', messages: testMessages, max_tokens: 5 }),
            signal: AbortSignal.timeout(8000),
          })
          valid = r.ok
          if (!r.ok) error = `${r.status}: ${await r.text()}`
          break
        }
        case 'cerebras': {
          const r = await fetch('https://api.cerebras.ai/v1/chat/completions', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body:    JSON.stringify({ model: 'llama3.1-8b', messages: testMessages, max_tokens: 5 }),
            signal:  AbortSignal.timeout(8000),
          })
          valid = r.ok
          if (!r.ok) error = `${r.status}: ${await r.text()}`
          break
        }
        case 'nvidia': {
          const r = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body:    JSON.stringify({ model: 'meta/llama-3.2-1b-instruct', messages: testMessages, max_tokens: 5 }),
            signal:  AbortSignal.timeout(8000),
          })
          valid = r.ok
          if (!r.ok) error = `${r.status}: ${await r.text()}`
          break
        }
        default:
          valid = false
          error = 'Unknown provider'
      }

      res.json({ valid, error: valid ? null : error })
    } catch (err: any) {
      res.json({ valid: false, error: err.message })
    }
  })

  // POST /api/goals — start execution loop async
  app.post('/api/goals', async (req: Request, res: Response) => {
    const { title, description } = req.body as { title?: string; description?: string }
    if (!title) return res.status(400).json({ error: 'title required' })
    const goal = description ? `${title}: ${description}` : title
    // Run async — don't await so UI gets immediate response
    import('../core/executionLoop').then(({ runGoalLoop }) => {
      runGoalLoop(goal).catch(console.error)
    })
    res.json({
      id:      `goal_${Date.now()}`,
      title,
      status:  'running',
      message: 'Goal started — watch LivePulse for progress',
    })
  })

  // GET /api/goals
  app.get('/api/goals', (_req: Request, res: Response) => {
    res.json({ goals: [], message: 'Goal history coming soon' })
  })

  // GET /api/evolution — self-evolution stats
  app.get('/api/evolution', async (_req: Request, res: Response) => {
    try {
      const { evolutionAnalyzer } = await import('../core/evolutionAnalyzer')
      res.json({
        stats:     evolutionAnalyzer.getStats(),
        decisions: evolutionAnalyzer.getDecisions(),
        history:   evolutionAnalyzer.getHistory(),
        summary:   evolutionAnalyzer.getSummary(),
      })
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? 'evolution stats unavailable' })
    }
  })

  // GET /api/doctor
  app.get('/api/doctor', async (_req: Request, res: Response) => {
    try {
      const result = await runDoctor()
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? 'doctor check failed' })
    }
  })

  // GET /api/models
  app.get('/api/models', (_req: Request, res: Response) => {
    res.json({
      compatible: modelRouter.listModels(),
      hardware:   modelRouter.getHardware(),
    })
  })

  // GET /api/stream — SSE keep-alive
  app.get('/api/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type',  'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection',    'keep-alive')
    res.flushHeaders()
    const interval = setInterval(() => res.write('data: {"type":"ping"}\n\n'), 30_000)
    req.on('close', () => clearInterval(interval))
  })

  // ── Computer-use routes ──────────────────────────────────────
  // POST /api/automate, POST /api/automate/stop,
  // GET  /api/automate/log, GET /api/automate/session
  registerComputerUseRoutes(app)

  // ── 404 catch-all ─────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' })
  })

  return app
}

// ── Helper ────────────────────────────────────────────────────

export function getDefaultModel(provider: string): string {
  const defaults: Record<string, string> = {
    groq:       'llama-3.3-70b-versatile',
    openrouter: 'meta-llama/llama-3.3-70b-instruct',
    gemini:     'gemini-1.5-flash',
    cerebras:   'llama3.1-8b',
    nvidia:     'meta/llama-3.3-70b-instruct',
  }
  return defaults[provider] || 'llama-3.3-70b-versatile'
}

// ── Server launcher ───────────────────────────────────────────

export function startApiServer(portArg?: number): Express {
  // Read port from config/api.json with sensible fallback
  let port = portArg ?? 4200
  let host = '127.0.0.1'
  try {
    const cfgPath = path.join(process.cwd(), 'config', 'api.json')
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'))
      host = (cfg.host as string) || host
      port = (cfg.port as number) || port
    }
  } catch { /* use defaults */ }

  const app    = createApiServer()
  const server = http.createServer(app)

  // ── WebSocket terminal ────────────────────────────────────────
  const wss = new WebSocketServer({ server })

  wss.on('connection', (ws) => {
    ws.send('DevOS v1.0 — Terminal connected\r\n')
    ws.send('Type "devos help" for available commands\r\n')
    ws.send('$ ')

    let inputBuffer = ''

    ws.on('message', (data) => {
      const input = data.toString()

      // Handle special keys
      if (input === '\r' || input === '\n') {
        // Enter pressed — process the buffered command
        ws.send('\r\n')
        if (inputBuffer.trim()) {
          ws.send(`command received: ${inputBuffer}\r\n`)
        }
        inputBuffer = ''
        ws.send('$ ')
      } else if (input === '\x7f' || input === '\b') {
        // Backspace
        if (inputBuffer.length > 0) {
          inputBuffer = inputBuffer.slice(0, -1)
          ws.send('\b \b') // erase character on screen
        }
      } else if (input === '\x03') {
        // Ctrl+C
        ws.send('^C\r\n$ ')
        inputBuffer = ''
      } else {
        // Regular character — echo it and add to buffer
        inputBuffer += input
        ws.send(input) // echo the character without newline
      }
    })

    ws.on('close', () => {})
  })

  server.listen(port, host, () => {
    console.log(`[API] DevOS API running at http://${host}:${port}`)
    console.log(`[API] Health: http://${host}:${port}/api/health`)
    console.log(`[API] Terminal: ws://${host}:${port}/terminal`)
  })

  return app
}
