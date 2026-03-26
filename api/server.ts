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
import { planWithLLM, executePlan, respondWithResults } from '../core/agentLoop'
import type { AgentPlan, StepResult, ToolStep }        from '../core/agentLoop'
import { planTool }                                     from '../core/planTool'
import type { Phase }                                   from '../core/planTool'
import { taskStateManager }                             from '../core/taskState'
import { recoverTasks }                                 from '../core/taskRecovery'
import { skillLoader }                                  from '../core/skillLoader'
import { conversationMemory }                           from '../core/conversationMemory'
import { semanticMemory }                               from '../core/semanticMemory'
import { entityGraph }                                  from '../core/entityGraph'
import { learningMemory }                               from '../core/learningMemory'
import { knowledgeBase }                               from '../core/knowledgeBase'
import { skillTeacher }                               from '../core/skillTeacher'

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

  // POST /api/chat — PLAN → EXECUTE → RESPOND with mode support
  // mode: 'auto' (default) | 'plan' (show plan only) | 'chat' (force chat, skip planner)
  app.post('/api/chat', async (req: Request, res: Response) => {
    const { message, history = [], mode = 'auto', sessionId } = req.body as {
      message?:   string
      history?:   { role: string; content: string }[]
      mode?:      'auto' | 'plan' | 'chat'
      sessionId?: string
    }
    if (!message) { res.status(400).json({ error: 'message required' }); return }

    // Switch to the caller's session before any memory operations
    if (sessionId) conversationMemory.setSession(sessionId)

    res.setHeader('Content-Type',  'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection',    'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.flushHeaders()

    const send = (data: object) => {
      try { res.write(`data: ${JSON.stringify(data)}\n\n`) } catch (writeErr: any) {
        console.error('[Chat] SSE write failed:', writeErr.message)
      }
    }

    const { provider, model, userName, apiName } = getSmartProvider()
    const config       = loadConfig()
    const apiEntry     = config.providers.apis.find(a => a.name === apiName)
    const rawKey       = apiEntry
      ? (apiEntry.key.startsWith('env:')
          ? process.env[apiEntry.key.replace('env:', '')] || ''
          : apiEntry.key)
      : ''
    const providerName = apiEntry?.provider || (apiName === 'ollama' ? 'ollama' : 'ollama')
    const activeModel  = apiEntry?.model || model

    // ── OUTER FATAL CATCH — catches anything that escapes the inner handler ──
    try {

    try {
      // ── RESOLVE REFERENCES & RECORD USER TURN ────────────────
      const resolvedMessage = conversationMemory.addUserMessage(message)
      conversationMemory.recordUserTurn(resolvedMessage)

      // ── FORCE CHAT MODE ──────────────────────────────────────
      if (mode === 'chat') {
        await streamChat(resolvedMessage, history, userName, provider, activeModel, apiName, send)
        incrementUsage(apiName)
        send({ done: true, provider: apiName })
        res.end()
        memoryLayers.write(`User: ${resolvedMessage}`, ['chat'])
        return
      }

      // ── STEP 1: PLAN ─────────────────────────────────────────
      send({ activity: { icon: '🧠', agent: 'Aiden', message: 'Thinking...', style: 'thinking' }, done: false })

      const memoryContext = conversationMemory.buildContext()
      const plan: AgentPlan = await planWithLLM(resolvedMessage, history, rawKey, activeModel, providerName, memoryContext)

      // ── PLAN-ONLY MODE ───────────────────────────────────────
      if (mode === 'plan') {
        const planText = plan.requires_execution && plan.plan.length > 0
          ? `**Planned steps:**\n${plan.plan.map(s => `${s.step}. \`${s.tool}\` — ${s.description}`).join('\n')}\n\n*Plan-only mode — not executing.*`
          : `No execution needed. I can answer this directly.\n\n*Plan-only mode.*`
        const words = planText.split(' ')
        for (const word of words) {
          send({ token: word + ' ', done: false, provider: apiName })
          await new Promise(r => setTimeout(r, 10))
        }
        send({ done: true, provider: apiName })
        res.end()
        return
      }

      // ── NO EXECUTION NEEDED — PURE CHAT ─────────────────────
      if (!plan.requires_execution || plan.plan.length === 0) {
        let fullReply = ''
        if (plan.direct_response) {
          fullReply = plan.direct_response
          const words = plan.direct_response.split(' ')
          for (const word of words) {
            send({ token: word + ' ', done: false, provider: apiName })
            await new Promise(r => setTimeout(r, 10))
          }
        } else {
          await streamChat(resolvedMessage, history, userName, provider, activeModel, apiName, send)
        }
        incrementUsage(apiName)
        send({ done: true, provider: apiName })
        res.end()
        memoryLayers.write(`User: ${resolvedMessage}`, ['chat'])
        if (fullReply) conversationMemory.addAssistantMessage(fullReply)
        return
      }

      // ── SHOW PLAN PHASES ────────────────────────────────────
      if (plan.phases && plan.phases.length > 0) {
        const phaseList = plan.phases
          .filter((p: Phase) => p.title !== 'Deliver Results')
          .map((p: Phase, i: number) => `${i + 1}. ${p.title}`)
          .join(' → ')
        send({
          activity: { icon: '📋', agent: 'Aiden', message: `Plan: ${phaseList}`, style: 'act' },
          done: false,
        })
      } else {
        send({
          activity: {
            icon: '📋', agent: 'Aiden',
            message: `Plan: ${plan.plan.map(s => s.tool).join(' → ')}`,
            style: 'act',
          },
          done: false,
        })
      }

      // ── STEP 2: EXECUTE ──────────────────────────────────────
      const results: StepResult[] = await executePlan(
        plan,
        (step: ToolStep, result: StepResult) => {
          send({
            activity: { icon: '🔧', agent: 'Aiden', message: `${step.tool}: ${step.description}`, style: 'tool' },
            done: false,
          })
          send({
            activity: {
              icon:    result.success ? '✅' : '❌',
              agent:   'Aiden',
              message: (result.success ? result.output : result.error || 'failed').slice(0, 160),
              style:   result.success ? 'done' : 'error',
            },
            done: false,
          })
        },
        (phase: Phase, index: number, total: number) => {
          send({
            activity: { icon: '▶', agent: 'Aiden', message: `Phase ${index + 1}/${total}: ${phase.title}`, style: 'act' },
            done: false,
          })
        },
      )

      // ── STEP 3: RESPOND ──────────────────────────────────────
      send({ activity: { icon: '✍️', agent: 'Aiden', message: 'Writing response...', style: 'thinking' }, done: false })

      let streamEnded = false
      let fullReply   = ''
      const timeout = setTimeout(() => {
        if (!streamEnded) { send({ done: true, error: 'Response timed out' }); res.end() }
      }, 30000)

      await respondWithResults(
        resolvedMessage, plan, results, history,
        userName, rawKey, activeModel, providerName,
        (token) => {
          fullReply += token
          send({ token, done: false, provider: apiName })
        },
      )

      streamEnded = true
      clearTimeout(timeout)

      // ── UPDATE CONVERSATION MEMORY ───────────────────────────
      const toolsUsed     = results.map(r => r.tool)
      const filesCreated  = results
        .filter(r => r.tool === 'file_write' && r.success && r.input?.path)
        .map(r => r.input.path as string)
      const searchQueries = results
        .filter(r => (r.tool === 'web_search' || r.tool === 'deep_research') && r.input?.query)
        .map(r => r.input.query as string)

      conversationMemory.updateFromExecution(toolsUsed, filesCreated, searchQueries, plan.planId)
      conversationMemory.addAssistantMessage(fullReply, { toolsUsed, filesCreated, searchQueries, planId: plan.planId })

      incrementUsage(apiName)
      send({ done: true, provider: apiName })
      res.end()
      memoryLayers.write(`User: ${resolvedMessage}`, ['chat'])

    } catch (err: any) {
      console.error('[Chat] Execution error:', err.message)
      console.error('[Chat] Stack:', err.stack?.split('\n').slice(0, 5).join('\n'))

      const is429 = err.message?.includes('429') || err.message?.toLowerCase().includes('rate')
      if (is429 && apiName !== 'ollama') {
        markRateLimited(apiName)
        send({
          activity: { icon: '⚡', agent: 'Aiden', message: `${apiName} rate limited — switching provider`, style: 'error' },
          done: false,
        })
        send({ token: `\n⚡ ${apiName} rate limited — try again in a moment.\n`, done: false })
      } else {
        send({
          activity: { icon: '❌', agent: 'Aiden', message: `Failed: ${err.message}`, style: 'error' },
          done: false,
        })
        send({ token: `\nSorry, something went wrong: ${err.message}`, done: false })
      }
      send({ done: true })
      res.end()
    }

    } catch (e: any) {
      // Fatal outer catch — something threw outside the inner try (e.g. getSmartProvider crash)
      console.error('[Chat] FATAL outer error:', e.message)
      console.error('[Chat] FATAL stack:', e.stack?.split('\n').slice(0, 3).join('\n'))
      try {
        send({ activity: { icon: '💥', agent: 'Aiden', message: `Fatal error: ${e.message}`, style: 'error' }, done: false })
        send({ token: `\nA fatal error occurred: ${e.message}`, done: false })
        send({ done: true })
        res.end()
      } catch (sendErr: any) {
        console.error('[Chat] Fatal send failed:', sendErr.message)
      }
    }

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

  // ── Knowledge Base endpoints ─────────────────────────────────

  // GET /api/knowledge — list all files + stats
  app.get('/api/knowledge', (_req: Request, res: Response) => {
    try {
      res.json({ files: knowledgeBase.listFiles(), stats: knowledgeBase.getStats() })
    } catch (e: any) { res.status(500).json({ error: e.message }) }
  })

  // POST /api/knowledge/upload — accept JSON { content, filename, category, tags, privacy }
  // (no multer needed — frontend sends text file content as JSON string)
  app.post('/api/knowledge/upload', (req: Request, res: Response) => {
    try {
      const { content, filename, category = 'general', tags = '', privacy = 'public' } = req.body as {
        content?: string; filename?: string; category?: string; tags?: string; privacy?: string
      }
      if (!content || !filename) {
        res.status(400).json({ error: 'content and filename required' }); return
      }
      const tagList = tags ? tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []
      const result  = knowledgeBase.ingestText(
        content, filename, category, tagList,
        (privacy as 'public' | 'private' | 'sensitive') || 'public',
      )
      if (!result.success) { res.status(400).json({ error: result.error }); return }
      res.json({
        success:    true,
        filename,
        chunkCount: result.chunkCount,
        message:    `Ingested ${result.chunkCount} chunks from ${filename}`,
      })
    } catch (e: any) { res.status(500).json({ error: e.message }) }
  })

  // GET /api/knowledge/search?q= — search knowledge base
  app.get('/api/knowledge/search', (req: Request, res: Response) => {
    const query = req.query.q as string
    if (!query) { res.status(400).json({ error: 'q parameter required' }); return }
    const chunks = knowledgeBase.search(query, 5)
    res.json({
      query,
      results: chunks.map(c => ({
        text:     c.text.slice(0, 200),
        filename: c.filename,
        category: c.category,
        score:    c.usageCount,
      })),
    })
  })

  // DELETE /api/knowledge/:fileId — delete a file
  app.delete('/api/knowledge/:fileId', (req: Request, res: Response) => {
    const deleted = knowledgeBase.deleteFile(String(req.params.fileId))
    if (!deleted) { res.status(404).json({ error: 'File not found' }); return }
    res.json({ success: true, message: 'File deleted from knowledge base' })
  })

  // GET /api/knowledge/stats
  app.get('/api/knowledge/stats', (_req: Request, res: Response) => {
    res.json(knowledgeBase.getStats())
  })

  // ── Skill teacher endpoints ───────────────────────────────────

  // GET /api/skills/learned — list learned + approved skills + stats
  app.get('/api/skills/learned', (_req: Request, res: Response) => {
    try {
      res.json({
        learned:  skillTeacher.listLearned(),
        approved: skillTeacher.listApproved(),
        stats:    skillTeacher.getStats(),
      })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // DELETE /api/skills/learned/:name — delete a learned skill
  app.delete('/api/skills/learned/:name', (req: Request, res: Response) => {
    try {
      const skillDir = path.join(
        process.cwd(), 'workspace', 'skills', 'learned', String(req.params.name),
      )
      if (!fs.existsSync(skillDir)) {
        res.status(404).json({ error: 'Skill not found' }); return
      }
      fs.rmSync(skillDir, { recursive: true })
      skillLoader.refresh()
      res.json({ success: true })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
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

  // GET /api/plan/:id — get plan status
  app.get('/api/plan/:id', (req: Request, res: Response) => {
    const plan = planTool.getPlan(String(req.params.id))
    if (!plan) { res.status(404).json({ error: 'Plan not found' }); return }
    res.json(plan)
  })

  // GET /api/plans/recent — list 10 most recent task plans
  app.get('/api/plans/recent', (_req: Request, res: Response) => {
    try {
      const tasksDir = path.join(process.cwd(), 'workspace', 'tasks')
      if (!fs.existsSync(tasksDir)) { res.json([]); return }

      const tasks = fs.readdirSync(tasksDir)
        .filter(t => t.startsWith('task_'))
        .sort().reverse().slice(0, 10)
        .map(t => {
          try {
            const planPath = path.join(tasksDir, t, 'plan.json')
            if (!fs.existsSync(planPath)) return null
            const p = JSON.parse(fs.readFileSync(planPath, 'utf-8')) as any
            return {
              id:               p.id,
              goal:             p.goal,
              status:           p.status,
              phases:           p.phases.length,
              completedPhases:  p.phases.filter((ph: any) => ph.status === 'done').length,
              createdAt:        p.createdAt,
            }
          } catch { return null }
        })
        .filter(Boolean)

      res.json(tasks)
    } catch {
      res.json([])
    }
  })

  // GET /api/skills — list all available skills
  app.get('/api/skills', (_req: Request, res: Response) => {
    try {
      const skills = skillLoader.loadAll()
      res.json(skills.map(s => ({
        name:        s.name,
        description: s.description,
        version:     s.version,
        tags:        s.tags,
        filePath:    s.filePath,
      })))
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // GET /api/skills/relevant?q=query — find skills for a query
  app.get('/api/skills/relevant', (req: Request, res: Response) => {
    const query = (req.query.q as string) || ''
    if (!query) { res.status(400).json({ error: 'q parameter required' }); return }
    const relevant = skillLoader.findRelevant(query)
    res.json(relevant.map(s => ({ name: s.name, description: s.description, tags: s.tags })))
  })

  // POST /api/skills/refresh — reload all skills from disk
  app.post('/api/skills/refresh', (_req: Request, res: Response) => {
    skillLoader.refresh()
    const skills = skillLoader.loadAll()
    res.json({ success: true, count: skills.length, skills: skills.map(s => s.name) })
  })

  // GET /api/tasks — list all tasks with status
  app.get('/api/tasks', (_req: Request, res: Response) => {
    const tasks = taskStateManager.listAll()
    res.json(tasks.map((t: any) => ({
      id:         t.id,
      goal:       t.goal,
      status:     t.status,
      progress:   `${t.currentStep}/${t.totalSteps}`,
      tokenUsage: t.tokenUsage,
      tokenLimit: t.tokenLimit,
      createdAt:  t.createdAt,
      updatedAt:  t.updatedAt,
    })))
  })

  // GET /api/tasks/:id — get single task detail
  app.get('/api/tasks/:id', (req: Request, res: Response) => {
    const state = taskStateManager.load(String(req.params.id))
    if (!state) { res.status(404).json({ error: 'Task not found' }); return }
    res.json(state)
  })

  // POST /api/tasks/:id/retry — reset a failed task and re-run recovery
  app.post('/api/tasks/:id/retry', async (req: Request, res: Response) => {
    const state = taskStateManager.load(String(req.params.id))
    if (!state) { res.status(404).json({ error: 'Task not found' }); return }
    if (state.status !== 'failed') { res.status(400).json({ error: 'Task is not failed' }); return }

    // Reset to running so recoverTasks picks it up
    state.status = 'running'
    taskStateManager.save(state)

    recoverTasks().catch(() => {})
    res.json({ success: true, message: `Retrying task ${req.params.id}` })
  })

  // GET /api/memory — return current conversation facts and recent history
  app.get('/api/memory', (_req: Request, res: Response) => {
    res.json({
      facts:         conversationMemory.getFacts(),
      recentHistory: conversationMemory.getRecentHistory(),
    })
  })

  // DELETE /api/memory — clear all conversation memory
  app.delete('/api/memory', (_req: Request, res: Response) => {
    conversationMemory.clear()
    res.json({ success: true, message: 'Conversation memory cleared' })
  })

  // GET /api/memory/semantic?q=query — semantic search or stats
  app.get('/api/memory/semantic', (req: Request, res: Response) => {
    const query = req.query.q as string
    if (!query) {
      res.json(semanticMemory.getStats())
      return
    }
    const results = semanticMemory.searchText(query, 5)
    res.json({ query, results })
  })

  // GET /api/memory/graph?entity=name — entity relationships or graph overview
  app.get('/api/memory/graph', (req: Request, res: Response) => {
    const entity = req.query.entity as string
    if (entity) {
      res.json({ entity, related: entityGraph.getRelated(entity) })
    } else {
      res.json({
        stats:    entityGraph.getStats(),
        frequent: entityGraph.getFrequent(10),
      })
    }
  })

  // GET /api/memory/learning?q=query — learning stats or similar past experiences
  app.get('/api/memory/learning', (req: Request, res: Response) => {
    const query = req.query.q as string
    res.json({
      stats:   learningMemory.getStats(),
      similar: query ? learningMemory.findSimilar(query) : [],
    })
  })

  // GET /api/memory/sessions — list all session IDs
  app.get('/api/memory/sessions', (_req: Request, res: Response) => {
    res.json({ sessions: conversationMemory.getSessions() })
  })

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

  // Stale task cleanup — mark running tasks older than 1h as failed (runs before recovery)
  try {
    const tasksDir = path.join(process.cwd(), 'workspace', 'tasks')
    if (fs.existsSync(tasksDir)) {
      const taskDirs = fs.readdirSync(tasksDir)
        .filter((d: string) => d.startsWith('task_'))
      let cleaned = 0
      for (const dir of taskDirs) {
        const statePath = path.join(tasksDir, dir, 'state.json')
        if (!fs.existsSync(statePath)) continue
        try {
          const state    = JSON.parse(fs.readFileSync(statePath, 'utf-8'))
          const ageHours = (Date.now() - (state.createdAt || 0)) / (1000 * 60 * 60)
          if (state.status === 'running' && ageHours > 1) {
            state.status = 'failed'
            state.error  = 'Auto-cleaned: task interrupted and too old to recover'
            fs.writeFileSync(statePath, JSON.stringify(state, null, 2))
            cleaned++
          }
        } catch {}
      }
      if (cleaned > 0) console.log(`[Startup] Cleaned up ${cleaned} stale interrupted tasks`)
    }
  } catch {}

  // Run crash recovery on startup — non-blocking, finds 'running' tasks from prior session
  recoverTasks().catch(e => console.error('[Startup] Recovery error:', e.message))

  server.listen(port, host, () => {
    console.log(`[API] DevOS API running at http://${host}:${port}`)
    console.log(`[API] Health: http://${host}:${port}/api/health`)
    console.log(`[API] Terminal: ws://${host}:${port}/terminal`)
  })

  return app
}

// ── Pure-chat streaming helper (no planner, no tools) ─────────

async function streamChat(
  message:  string,
  history:  { role: string; content: string }[],
  userName: string,
  provider: any,
  model:    string,
  apiName:  string,
  send:     (data: object) => void,
): Promise<void> {
  const chatPrompt = `You are Aiden — a personal AI OS for ${userName}. Calm, direct, intelligent, slightly witty. Co-founder energy.
Be concise for simple questions, thorough for complex ones. Use markdown when it helps.
Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.`

  const msgs = [
    { role: 'system', content: chatPrompt },
    ...history.slice(-8),
    { role: 'user', content: message },
  ]

  let streamEnded = false
  const timeout = setTimeout(() => {
    if (!streamEnded) send({ done: true, error: 'Chat timeout' })
  }, 30000)

  await provider.generateStream(msgs, model, (token: string) => {
    send({ token, done: false, provider: apiName })
  })

  streamEnded = true
  clearTimeout(timeout)
}
