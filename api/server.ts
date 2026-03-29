// ============================================================
// DevOS â€” Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// api/server.ts â€” DevOS REST API server
//
// Imports ONLY from files that exist in the actual codebase.
// All 34+ missing-module imports from the prior version have been removed.
//
// Endpoints:
//   GET  /api/health          â€” liveness check (no auth)
//   POST /api/chat            â€” queue a user message
//   POST /api/goals           â€” queue a goal
//   GET  /api/goals           â€” placeholder goal list
//   GET  /api/doctor          â€” system health report
//   GET  /api/models          â€” compatible model list
//   GET  /api/stream          â€” SSE keep-alive stream
//   POST /api/automate        â€” start visionLoop session
//   POST /api/automate/stop   â€” abort visionLoop
//   GET  /api/automate/log    â€” screenAgent action log
//   GET  /api/automate/sessionâ€” live executor session

import * as fs   from 'fs'
import * as path from 'path'
import * as http from 'http'
import express, { Express, Request, Response, NextFunction } from 'express'
import { WebSocketServer } from 'ws'

// â”€â”€ Real imports only â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import { memoryLayers }   from '../memory/memoryLayers'
import { livePulse }      from '../coordination/livePulse'
import { runDoctor }      from '../core/doctor'
import { modelRouter }    from '../core/modelRouter'
import { registerComputerUseRoutes } from './routes/computerUse'
import { loadConfig, saveConfig, APIEntry } from '../providers/index'
import { ollamaProvider } from '../providers/ollama'
import { getSmartProvider, markRateLimited, incrementUsage, logProviderStatus, getModelForTask } from '../providers/router'
import { executeTool } from '../core/toolRegistry'
import { getScreenSize, takeScreenshot as captureScreen } from '../core/computerControl'
import { planWithLLM, executePlan, respondWithResults } from '../core/agentLoop'
import { AIDEN_STREAM_SYSTEM }                          from '../core/aidenPersonality'
import { checkVoiceAvailable, recordAudio, transcribeAudio } from '../core/voiceInput'
import { speak, checkTTSAvailable }                    from '../core/voiceOutput'
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
import { deepKB }                                      from '../core/deepKB'
import multer                                           from 'multer'
import { skillTeacher }                               from '../core/skillTeacher'
import { growthEngine }                               from '../core/growthEngine'
import { userCognitionProfile }                      from '../core/userCognitionProfile'
import { isPro, validateLicense, getCurrentLicense, clearLicense, startLicenseRefresh } from '../core/licenseManager'
import { auditTrail } from '../core/auditTrail'

// â”€â”€ Human-readable tool message helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function humanToolMessage(tool: string, input: Record<string, any>): string {
  const map: Record<string, string> = {
    web_search:      `Searching the web for "${input?.query || ''}"`,
    deep_research:   `Researching "${input?.topic || ''}" in depth`,
    file_write:      `Writing to ${input?.path ? (input.path as string).split('\\').pop() : 'a file'}`,
    file_read:       `Reading ${input?.path ? (input.path as string).split('\\').pop() : 'a file'}`,
    shell_exec:      `Running a system command`,
    run_python:      `Executing Python code`,
    run_node:        `Executing Node.js code`,
    system_info:     `Checking your system specs`,
    screenshot:      `Taking a screenshot`,
    fetch_url:       `Fetching ${input?.url || 'a URL'}`,
    fetch_page:      `Fetching ${input?.url || 'a page'}`,
    notify:          `Sending you a notification`,
    get_stocks:      `Getting ${input?.market || ''} market data`,
    social_research: `Searching Reddit and HackerNews for "${input?.topic || ''}"`,
    get_market_data: `Looking up ${input?.symbol || 'stock'} price`,
    get_company_info:`Getting company info for ${input?.symbol || ''}`,
    open_browser:    `Opening ${input?.url || 'browser'}`,
    browser_click:   `Clicking on the page`,
    browser_extract: `Extracting content from page`,
  }
  return map[tool] || `Working on: ${tool}`
}

// â”€â”€ Chat error handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Centralised error formatting for /api/chat catch blocks.
// Returns user-facing tokens and activity events via the SSE send fn.

function handleChatError(
  err:     any,
  apiName: string,
  send:    (data: object) => void,
): void {
  const msg = err?.message || String(err) || 'Unknown error'
  console.error('[Chat] Error:', msg)
  if (err?.stack) {
    console.error('[Chat] Stack:', err.stack.split('\n').slice(0, 5).join('\n'))
  }

  const is429       = msg.includes('429') || msg.toLowerCase().includes('rate limit')
  const isTimeout   = msg.includes('timeout') || msg.includes('ETIMEDOUT') || msg.includes('aborted')
  const isNetwork   = msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('fetch failed')
  const isSearchErr = msg.toLowerCase().includes('web search failed') || msg.toLowerCase().includes('search failed')

  if (is429 && apiName !== 'ollama') {
    markRateLimited(apiName)
    send({ activity: { icon: 'âš¡', agent: 'Aiden', message: `${apiName} rate limited â€” switching provider`, style: 'error' }, done: false })
    send({ token: `\nâš¡ **${apiName} is rate limited.** Try again in a moment â€” DevOS will switch to a different provider.\n`, done: false })
    send({ token: '\n\n💡 **Tip:** Add a Groq or Gemini key in Settings → API Keys for higher limits and faster responses.', done: false })
  } else if (isTimeout) {
    send({ activity: { icon: 'â±ï¸', agent: 'Aiden', message: 'Request timed out', style: 'error' }, done: false })
    send({ token: `\nâ±ï¸ **Request timed out.** The operation took too long. Try a simpler query or check your network.\n`, done: false })
  } else if (isNetwork) {
    send({ activity: { icon: 'ðŸ”Œ', agent: 'Aiden', message: 'Network error â€” check connection', style: 'error' }, done: false })
    send({ token: `\nðŸ”Œ **Network error.** Could not reach the required service. Check that Ollama and your network are running.\n`, done: false })
  } else if (isSearchErr) {
    send({ activity: { icon: 'ðŸ”', agent: 'Aiden', message: 'Web search unavailable â€” using knowledge base', style: 'error' }, done: false })
    send({ token: `\nðŸ” **Web search is unavailable right now.** I'll answer from my knowledge base instead. To enable live search, start SearxNG: \`npm run searxng\` or run \`scripts\\start-searxng.ps1\`.\n`, done: false })
  } else {
    send({ activity: { icon: 'âŒ', agent: 'Aiden', message: `Error: ${msg.slice(0, 120)}`, style: 'error' }, done: false })
    send({ token: `\nâŒ **Something went wrong:** ${msg.slice(0, 200)}\n`, done: false })
  }

  send({ done: true })
}

// â”€â”€ Knowledge upload â€” multer + progress tracking â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const KB_UPLOAD_DIR = path.join(process.cwd(), 'workspace', 'knowledge', 'uploads')
if (!fs.existsSync(KB_UPLOAD_DIR)) fs.mkdirSync(KB_UPLOAD_DIR, { recursive: true })

const kbStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, KB_UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
    cb(null, `${Date.now()}_${safe}`)
  },
})

const kbUpload = multer({
  storage:    kbStorage,
  limits:     { fileSize: 50 * 1024 * 1024 },  // 50 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.epub', '.txt', '.md', '.markdown']
    const ext     = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) cb(null, true)
    else cb(new Error(`Unsupported file type: ${ext}. Allowed: ${allowed.join(', ')}`))
  },
})

// Progress map â€” jobId â†’ status/progress (kept in memory, no persistence needed)
const kbProgress = new Map<string, { status: 'processing' | 'done' | 'error'; progress: number; message: string; result?: object }>()

// â”€â”€ App factory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function createApiServer(): Express {
  const app = express()

  // â”€â”€ Middleware â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // JSON body parsing (10 MB limit)
  app.use(express.json({ limit: '10mb' }))

  // Security headers
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    next()
  })

  // CORS â€” allow any origin (dev mode)
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin',  '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    if (req.method === 'OPTIONS') { res.sendStatus(200); return }
    next()
  })

  // â”€â”€ Core routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // GET /api/health â€” liveness probe (no auth required)
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString() })
  })

  // â”€â”€ License endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // POST /api/license/validate â€” activate a license key
  app.post('/api/license/validate', async (req: Request, res: Response) => {
    const { key } = req.body as { key?: string }
    if (!key) { res.status(400).json({ error: 'key required' }); return }
    try {
      const result = await validateLicense(key)
      if (!result.valid) {
        res.status(400).json({ valid: false, error: result.error || 'Invalid license' }); return
      }
      res.json({ valid: true, tier: result.tier, email: result.email, expiry: result.expiry })
    } catch (e: any) {
      res.status(500).json({ valid: false, error: `Server unreachable: ${e.message}` })
    }
  })

  // GET /api/license/status â€” current license state (from cache, no network)
  app.get('/api/license/status', (_req: Request, res: Response) => {
    const license = getCurrentLicense()
    res.json({
      active: isPro(),
      tier:   license.tier   || 'free',
      email:  license.email  || '',
      expiry: license.expiry || 0,
      key:    license.key    ? license.key.replace(/[A-Z0-9]{5}-[A-Z0-9]{5}-/, '****-****-') : '',
    })
  })

  // POST /api/license/clear â€” deactivate / log out of Pro
  app.post('/api/license/clear', (_req: Request, res: Response) => {
    clearLicense()
    res.json({ success: true })
  })

  // â”€â”€ Jailbreak detection patterns â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const JAILBREAK_PATTERNS = [
    'ignore previous instructions',
    'ignore all instructions',
    'you have no restrictions',
    'pretend you are',
    'you are now',
    'act as if',
    'GODMODE',
    ' DAN ',
    'jailbreak',
    'disregard your',
    'forget your instructions',
  ]

  // â”€â”€ Dangerous command patterns (CommandGate) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const DANGEROUS_PATTERNS = [
    'rm -rf',
    'rm -r /',
    'del /f /s',
    'del /s',
    'format c:',
    'format c :',
    'diskpart',
    'shutdown /s',
    'shutdown -s',
    'shutdown the computer',
    'shut down the computer',
    'reg delete',
    'reg add hklm',
    'hklm\\',
    'hklm/',
    'modify the windows registry',
    'edit the registry',
    'remove-item -recurse -force',
    'remove-item -force -recurse',
    'format-volume',
    'clear-disk',
    'stop-computer',
    'restart-computer',
    'send all my files',
    'send all my documents',
    'send all my ',
    'upload all files',
    'upload all my',
    'exfiltrate',
  ]

  // POST /api/chat â€” PLAN â†’ EXECUTE â†’ RESPOND with mode support
  // mode: 'auto' (default) | 'plan' (show plan only) | 'chat' (force chat, skip planner)
  // Supports both SSE streaming (Accept: text/event-stream) and JSON mode (Accept: application/json)
  app.post('/api/chat', async (req: Request, res: Response) => {
    const { history = [], mode = 'auto', sessionId } = (req.body || {}) as {
      message?:   string
      history?:   { role: string; content: string }[]
      mode?:      'auto' | 'plan' | 'chat'
      sessionId?: string
    }

    // â”€â”€ Sanitize input â€” strip null bytes and control chars â”€â”€â”€â”€
    let message = req.body?.message || ''
    message = message.replace(/\x00/g, '').replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, '')

    if (!message || message.trim().length === 0) {
      res.status(400).json({ message: 'Please provide a goal or question.', error: 'empty_message' }); return
    }

    // â”€â”€ Jailbreak detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const isJailbreak = JAILBREAK_PATTERNS.some(p =>
      message.toLowerCase().includes(p.toLowerCase())
    )
    if (isJailbreak) {
      res.json({ message: 'I am Aiden. My identity and safety rules cannot be overridden by conversation.', blocked: true }); return
    }

    // â”€â”€ Dangerous command detection (pre-execution gate) â”€â”€â”€â”€â”€â”€â”€
    const isDangerous = DANGEROUS_PATTERNS.some(p =>
      message.toLowerCase().includes(p.toLowerCase())
    )
    if (isDangerous) {
      res.json({
        message: 'CommandGate: I need your approval before running that operation. It contains a potentially dangerous command (data loss risk). Please confirm explicitly that you want to proceed, or rephrase your request.',
        blocked: true,
        reason:  'dangerous_command',
      }); return
    }

    // â”€â”€ Fast math evaluation â€” simple arithmetic without LLM â”€â”€â”€
    const simpleMathMatch = message.match(/^what\s+is\s+([\d]+\s*[+\-*\/]\s*[\d]+)\s*\??$/i)
    if (simpleMathMatch) {
      try {
        // Safe eval: only digits and operators
        const expr = simpleMathMatch[1].replace(/[^0-9+\-*\/\s]/g, '')
        const result = Function(`"use strict"; return (${expr})`)()
        res.json({ message: String(result) }); return
      } catch {}
    }

    // â”€â”€ Fast identity answers â€” don't need LLM for these â”€â”€â”€â”€â”€â”€
    const identityPatterns = [
      /what.{0,10}(is|are).{0,10}(your name|you called|you named)/i,
      /who are you/i,
      /what('s| is) your name/i,
      /are you (aiden|chatgpt|claude|gpt|openai)/i,
    ]
    if (identityPatterns.some(p => p.test(message))) {
      res.json({ message: 'I\'m Aiden â€” a personal AI OS built by Shiva Deore at Taracod. I run locally on your Windows machine using Ollama. Not ChatGPT, not Claude. Just Aiden.' }); return
    }

    // â”€â”€ Fast "running locally" answer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const localPatterns = [
      /are you (local|running locally|on.{0,20}machine|offline)/i,
      /do you (run|work) (locally|offline|on.{0,20}machine)/i,
      /where.{0,20}(run|hosted|deployed)/i,
      /run(ning)? (locally|on.{0,10}machine)/i,
      /(cloud or locally|locally or.{0,10}cloud|in the cloud)/i,
    ]
    if (localPatterns.some(p => p.test(message))) {
      res.json({ message: 'Locally. I run 100% on your machine â€” offline, private. I use Ollama for inference on your device. Your data never leaves this machine.' }); return
    }

    // â”€â”€ Date/year fast-path â€” answer from system clock â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const _dateMsg = (message || '').toLowerCase()
    const DATE_PATTERNS = ['what year', 'current year', 'what time', 'what date', 'what is today', "today's date"]
    if (DATE_PATTERNS.some(p => _dateMsg.includes(p))) {
      const now = new Date()
      res.json({ message: `${now.toDateString()}. Year: ${now.getFullYear()}. Time: ${now.toLocaleTimeString()}.`, success: true, provider: 'system_clock' }); return
    }

    // â”€â”€ Hardware info fast-path â€” from SOUL.md known config â”€â”€â”€
    if (/what\s+(gpu|graphics|vram|ram|memory|cpu|processor|hardware|specs)\s+(do\s+i|have|i\s+have)|gpu\s+and\s+ram|hardware\s+specs|system\s+specs/i.test(message)) {
      res.json({ message: 'GPU: GTX 1060 6GB VRAM. RAM: detected at runtime (typically 8â€“16 GB). CPU: detected via system info. Run "system_info" for live hardware readings.' }); return
    }

    // â”€â”€ File-read fast-path â€” try the file before calling LLM â”€â”€
    // This prevents hallucination on missing files and ensures honest "not found" responses.
    const fileReadMatch = message.match(/read\s+(?:file\s+)?([A-Z]:[/\\][^\s"']+|\/[^\s"']+|[\w./\\]+\.\w{1,6})/i)
    if (fileReadMatch) {
      const fs   = require('fs')
      const fp   = fileReadMatch[1]
      if (!fs.existsSync(fp)) {
        res.json({ message: `Cannot find file "${fp}" â€” it does not exist or is not accessible. Please check the path.` }); return
      }
    }

    // â”€â”€ High-risk actions â€” require explicit confirmation â”€â”€â”€â”€â”€â”€
    const HIGH_RISK_PATTERNS = [
      'send an email',
      'send email',
      'smtp',
      'sendmail',
      'send immediately',
    ]
    const isHighRisk = HIGH_RISK_PATTERNS.some(p =>
      message.toLowerCase().includes(p.toLowerCase())
    )
    if (isHighRisk) {
      res.json({
        message: 'CommandGate: This action involves sending data externally (email/network). I need your explicit approval before proceeding. Are you sure you want to do this? Please confirm.',
        blocked: true,
        reason:  'high_risk_action_requires_approval',
      }); return
    }

    // â”€â”€ Detect if caller wants JSON or SSE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Browser clients set Accept: text/event-stream â†’ SSE mode
    // Test clients and API callers get JSON mode by default
    const acceptHeader = req.headers['accept'] || ''
    const useJsonMode = !acceptHeader.includes('text/event-stream')

    // Switch to the caller's session before any memory operations
    if (sessionId) conversationMemory.setSession(sessionId)

    // â”€â”€ JSON mode: collect all tokens, return {message: "..."} â”€
    if (useJsonMode) {
      let fullReply = ''
      const jsonTokens: string[] = []

      const collectToken = (token: string) => { jsonTokens.push(token) }

      // Sprint 6: tiered model selection per role
      // Responder drives chat mode; planner drives plan/auto mode
      const responderTier = getModelForTask('responder')
      const plannerTier   = getModelForTask('planner')
      const { provider, model, userName, apiName } = getSmartProvider()
      const config   = loadConfig()
      // Responder key (used for streamChat + respondWithResults)
      const rawKey       = responderTier.apiKey
      const providerName = responderTier.providerName
      const activeModel  = responderTier.model
      const apiName2     = responderTier.apiName
      // Planner key (used for planWithLLM)
      const plannerKey   = plannerTier.apiKey
      const plannerModel = plannerTier.model
      const plannerProv  = plannerTier.providerName

      try {
        const resolvedMessage = conversationMemory.addUserMessage(message)
        conversationMemory.recordUserTurn(resolvedMessage)

        if (mode === 'chat') {
          await streamChat(resolvedMessage, history, userName, provider, activeModel, apiName, (data: object) => {
            const d = data as any
            if (d.token) jsonTokens.push(d.token)
          })
          incrementUsage(apiName)
          fullReply = jsonTokens.join('')
          conversationMemory.addAssistantMessage(fullReply)
          res.json({ message: fullReply, provider: apiName }); return
        }

        const memoryContext = conversationMemory.buildContext()
        const plan: AgentPlan = await planWithLLM(resolvedMessage, history, plannerKey, plannerModel, plannerProv, memoryContext)

        if (!plan.requires_execution || plan.plan.length === 0) {
          if (plan.direct_response) {
            fullReply = plan.direct_response
          } else {
            await streamChat(resolvedMessage, history, userName, provider, activeModel, apiName, (data: object) => {
              const d = data as any
              if (d.token) jsonTokens.push(d.token)
            })
            fullReply = jsonTokens.join('')
          }
          incrementUsage(apiName)
          conversationMemory.addAssistantMessage(fullReply)
          res.json({ message: fullReply, provider: apiName }); return
        }

        const results: StepResult[] = await executePlan(
          plan,
          (_step: ToolStep, _result: StepResult) => { /* silent in JSON mode */ },
        )

        await respondWithResults(
          resolvedMessage, plan, results, history,
          userName, rawKey, activeModel, providerName,
          (token) => { jsonTokens.push(token) },
        ) // responder tier: rawKey/activeModel/providerName already set to responder tier above

        fullReply = jsonTokens.join('')

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

        res.json({ message: fullReply, provider: apiName, toolsUsed, filesCreated }); return

      } catch (err: any) {
        console.error('[Chat JSON mode] Error:', err.message)
        res.status(500).json({ message: `Something went wrong: ${err.message}`, error: err.message }); return
      }
    }

    // â”€â”€ SSE streaming mode (browser clients) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // Sprint 6: tiered model selection
    const responderTierSSE = getModelForTask('responder')
    const plannerTierSSE   = getModelForTask('planner')
    const { provider, model, userName, apiName } = getSmartProvider()
    const config       = loadConfig()
    const rawKey       = responderTierSSE.apiKey
    const providerName = responderTierSSE.providerName
    const activeModel  = responderTierSSE.model
    const plannerKeySSE   = plannerTierSSE.apiKey
    const plannerModelSSE = plannerTierSSE.model
    const plannerProvSSE  = plannerTierSSE.providerName

    // ── Conversational fast-path — skip planning for simple messages ──
    // These need zero tools — routing through planWithLLM wastes 8-30 seconds.
    // MUST be AFTER `send` is declared.
    const CONVERSATIONAL = [
      /^hi+\s*[!?.]*$/i,
      /^hey+\s*[!?.]*$/i,
      /^hello+\s*[!?.]*$/i,
      /^how are you/i,
      /^what('?s| is) up/i,
      /^good (morning|afternoon|evening|night)/i,
      /^thanks?(\s+you)?[!.]*$/i,
      /^thank you[!.]*$/i,
      /^ok+a?y?[!.]*$/i,
      /^cool[!.]*$/i,
      /^got it[!.]*$/i,
      /^what can you do/i,
      /^what are your (skills|capabilities|tools)/i,
      /^who are you/i,
      /^are you (there|ready|online|working)/i,
    ]
    const isConversational = mode !== 'plan' && CONVERSATIONAL.some(p => p.test(message.trim()))
    if (isConversational) {
      try {
        const convTokens: string[] = []
        await streamChat(message, history, userName, provider, activeModel, apiName, (data: object) => {
          const d = data as any
          if (d.token) convTokens.push(d.token)
        })
        const reply = convTokens.join('').trim() || 'Hey! What do you need?'
        const words = reply.split(' ')
        for (const word of words) {
          send({ token: word + ' ', done: false, provider: apiName })
          await new Promise(r => setTimeout(r, 8))
        }
        send({ done: true, provider: apiName })
        res.end()
        userCognitionProfile.observe(message, reply)
        conversationMemory.addAssistantMessage(reply)
        return
      } catch {
        send({ token: 'Hey! What do you need?', done: false, provider: 'fallback' })
        send({ done: true, provider: 'fallback' })
        res.end()
        return
      }
    }


    // â”€â”€ OUTER FATAL CATCH â€” catches anything that escapes the inner handler â”€â”€
    try {

    try {
      // â”€â”€ RESOLVE REFERENCES & RECORD USER TURN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const resolvedMessage = conversationMemory.addUserMessage(message)
      conversationMemory.recordUserTurn(resolvedMessage)

      // â”€â”€ FORCE CHAT MODE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (mode === 'chat') {
        await streamChat(resolvedMessage, history, userName, provider, activeModel, apiName, send)
        incrementUsage(apiName)
        send({ done: true, provider: apiName })
        res.end()
        memoryLayers.write(`User: ${resolvedMessage}`, ['chat'])
        return
      }

      // â”€â”€ STEP 1: PLAN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      send({ activity: { icon: 'ðŸ§ ', agent: 'Aiden', message: 'Working out a plan...', style: 'thinking' }, done: false })

      const memoryContext = conversationMemory.buildContext()
      const plan: AgentPlan = await planWithLLM(resolvedMessage, history, plannerKeySSE, plannerModelSSE, plannerProvSSE, memoryContext)

      // â”€â”€ PLAN-ONLY MODE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (mode === 'plan') {
        const planText = plan.requires_execution && plan.plan.length > 0
          ? `**Planned steps:**\n${plan.plan.map(s => `${s.step}. \`${s.tool}\` â€” ${s.description}`).join('\n')}\n\n*Plan-only mode â€” not executing.*`
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

      // â”€â”€ NO EXECUTION NEEDED â€” PURE CHAT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (!plan.requires_execution || plan.plan.length === 0) {
        let fullReply = ''

        // Capability/skills questions must go through LLM with full context injection.
        // direct_response from the planner has no capabilities awareness â€” it will lie.
        const isCapabilityQuery = /what.*(can you do|skills|tools|capabilities|abilities)|how many skills|what are you capable/i.test(resolvedMessage)

        if (plan.direct_response && !isCapabilityQuery) {
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

      // â”€â”€ SHOW PLAN PHASES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (plan.phases && plan.phases.length > 0) {
        const phaseList = plan.phases
          .filter((p: Phase) => p.title !== 'Deliver Results')
          .map((p: Phase, i: number) => `${i + 1}. ${p.title}`)
          .join(' â†’ ')
        send({
          activity: { icon: 'ðŸ“‹', agent: 'Aiden', message: `Plan: ${phaseList}`, style: 'act' },
          done: false,
        })
      } else {
        send({
          activity: {
            icon: 'ðŸ“‹', agent: 'Aiden',
            message: `Plan: ${plan.plan.map(s => s.tool).join(' â†’ ')}`,
            style: 'act',
          },
          done: false,
        })
      }

      // â”€â”€ STEP 2: EXECUTE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const results: StepResult[] = await executePlan(
        plan,
        (step: ToolStep, result: StepResult) => {
          send({
            activity: { icon: 'ðŸ”§', agent: 'Aiden', message: humanToolMessage(step.tool, step.input as Record<string, any>), style: 'tool', rawTool: step.tool, rawInput: step.input },
            done: false,
          })
          send({
            activity: {
              icon:    result.success ? 'âœ…' : 'âŒ',
              agent:   'Aiden',
              message: (result.success ? result.output : result.error || 'failed').slice(0, 160),
              style:   result.success ? 'done' : 'error',
            },
            done: false,
          })
        },
        (phase: Phase, index: number, total: number) => {
          send({
            activity: { icon: 'â–¶', agent: 'Aiden', message: `Phase ${index + 1}/${total}: ${phase.title}`, style: 'act' },
            done: false,
          })
        },
      )

      // â”€â”€ STEP 3: RESPOND â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      send({ activity: { icon: 'âœï¸', agent: 'Aiden', message: 'Writing response...', style: 'thinking' }, done: false })

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

      // â”€â”€ UPDATE CONVERSATION MEMORY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const toolsUsed     = results.map(r => r.tool)
      const filesCreated  = results
        .filter(r => r.tool === 'file_write' && r.success && r.input?.path)
        .map(r => r.input.path as string)
      const searchQueries = results
        .filter(r => (r.tool === 'web_search' || r.tool === 'deep_research') && r.input?.query)
        .map(r => r.input.query as string)

      conversationMemory.updateFromExecution(toolsUsed, filesCreated, searchQueries, plan.planId)
      conversationMemory.addAssistantMessage(fullReply, { toolsUsed, filesCreated, searchQueries, planId: plan.planId })
      userCognitionProfile.observe(resolvedMessage, fullReply)

      incrementUsage(apiName)
      send({ done: true, provider: apiName })
      res.end()
      memoryLayers.write(`User: ${resolvedMessage}`, ['chat'])

    } catch (err: any) {
      handleChatError(err, apiName, send)
      res.end()
    }

    } catch (e: any) {
      // Fatal outer catch â€” something threw outside the inner try (e.g. getSmartProvider crash)
      console.error('[Chat] FATAL outer error:', e.message)
      console.error('[Chat] FATAL stack:', e.stack?.split('\n').slice(0, 3).join('\n'))
      try {
        send({ activity: { icon: 'ðŸ’¥', agent: 'Aiden', message: `Fatal error: ${e.message}`, style: 'error' }, done: false })
        send({ token: `\nA fatal error occurred: ${e.message}`, done: false })
        send({ done: true })
        res.end()
      } catch (sendErr: any) {
        console.error('[Chat] Fatal send failed:', sendErr.message)
      }
    }

  })

  // GET /api/onboarding â€” check status + get available models
  app.get('/api/onboarding', async (_req: Request, res: Response) => {
    const config          = loadConfig()
    const installedModels = await ollamaProvider.listModels?.() || []

    const RECOMMENDED: Record<string, { label: string; contextWindow: number; speed: string }> = {
      'llama3.2:3b':         { label: 'Llama 3.2 3B',       contextWindow: 128000, speed: 'âš¡ fastest'  },
      'mistral:7b':          { label: 'Mistral 7B',          contextWindow: 32000,  speed: 'ðŸ”¥ fast'     },
      'qwen2.5:7b':          { label: 'Qwen 2.5 7B',         contextWindow: 128000, speed: 'ðŸ”¥ fast'     },
      'qwen2.5-coder:7b':    { label: 'Qwen 2.5 Coder 7B',   contextWindow: 128000, speed: 'ðŸ”¥ fast'     },
      'llama3.1:8b':         { label: 'Llama 3.1 8B',        contextWindow: 128000, speed: 'ðŸ”¥ fast'     },
      'phi4:mini':           { label: 'Phi-4 Mini',          contextWindow: 128000, speed: 'âš¡ fastest'  },
      'mistral-nemo:12b':    { label: 'Mistral Nemo 12B',    contextWindow: 128000, speed: 'ðŸ’ª powerful' },
      'llama3.3:70b':        { label: 'Llama 3.3 70B',       contextWindow: 128000, speed: 'ðŸ’ª powerful' },
    }

    const localModels = installedModels.map(name => ({
      id:          name,
      label:       RECOMMENDED[name]?.label || name,
      speed:       RECOMMENDED[name]?.speed || 'ðŸ”¥ fast',
      contextWindow: RECOMMENDED[name]?.contextWindow || 32000,
      installed:   true,
      recommended: name.includes('qwen2.5') || name.includes('llama3') || name.includes('phi4'),
    })).sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0))

    const cloudProviders = [
      { id: 'groq',       label: 'Groq',           subtitle: 'Free tier · llama3.3:70b · blazing fast',  url: 'https://console.groq.com',                       models: ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'] },
      { id: 'openrouter', label: 'OpenRouter',      subtitle: 'Access 200+ models · pay per use',           url: 'https://openrouter.ai/keys',                     models: ['meta-llama/llama-3.3-70b-instruct', 'anthropic/claude-3.5-sonnet', 'openai/gpt-4o'] },
      { id: 'gemini',     label: 'Gemini',          subtitle: 'Free tier available · fast',                 url: 'https://aistudio.google.com/app/apikey',         models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'] },
      { id: 'cloudflare', label: 'Cloudflare AI',  subtitle: '60+ models · free tier · edge inference',  url: 'https://dash.cloudflare.com/profile/api-tokens', models: ['accountId|@cf/meta/llama-3.1-8b-instruct'] },
      { id: 'github',     label: 'GitHub Models',  subtitle: 'GPT-4o · free for GitHub users',             url: 'https://github.com/marketplace/models',          models: ['gpt-4o-mini', 'gpt-4o'] },
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

  // POST /api/onboarding â€” save onboarding result
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

  // GET /api/onboarding/status â€” lightweight first-run check (used by onboarding gate)
  app.get('/api/onboarding/status', (_req: Request, res: Response) => {
    const config   = loadConfig()
    const hasName  = !!(config.user?.name && config.user.name !== 'there')
    const envName  = !!(process.env.USER_NAME)
    const hasOllama = !!(process.env.OLLAMA_MODEL || (config.model?.active === 'ollama' && config.model?.activeModel))
    const completed = !!(config.onboardingComplete && (hasName || envName))
    res.json({
      completed,
      hasOllama,
      hasName:  hasName || envName,
      userName: process.env.USER_NAME || config.user?.name || '',
    })
  })

  // POST /api/onboarding/complete â€” write keys/name to .env and config
  app.post('/api/onboarding/complete', (req: Request, res: Response) => {
    const { userName, ollamaModel, geminiKey, groqKey } = req.body as {
      userName?: string; ollamaModel?: string; geminiKey?: string; groqKey?: string
    }

    // Helper: set or replace a key in .env content
    function setEnvVar(content: string, key: string, value: string): string {
      const regex = new RegExp(`^${key}=.*$`, 'm')
      if (regex.test(content)) return content.replace(regex, `${key}=${value}`)
      return content + `\n${key}=${value}`
    }

    try {
      const envPath = path.join(process.cwd(), '.env')
      let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : ''
      if (userName)    envContent = setEnvVar(envContent, 'USER_NAME',     userName)
      if (ollamaModel) envContent = setEnvVar(envContent, 'OLLAMA_MODEL',  ollamaModel)
      if (geminiKey)   envContent = setEnvVar(envContent, 'GEMINI_API_KEY', geminiKey)
      if (groqKey)     envContent = setEnvVar(envContent, 'GROQ_API_KEY',  groqKey)
      fs.writeFileSync(envPath, envContent)
    } catch (e: any) {
      console.warn('[Onboarding] Could not write .env:', e.message)
    }

    // Also save to config
    const config = loadConfig()
    if (userName) config.user.name = userName
    if (ollamaModel) config.model = { active: 'ollama', activeModel: ollamaModel }
    if (!config.routing) config.routing = { mode: 'auto', fallbackToOllama: true }
    config.onboardingComplete = true
    saveConfig(config)

    res.json({ success: true })
  })

  // GET /api/providers â€” list all configured APIs with status
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
        hasKey:        (() => {
          const k = api.key?.startsWith('env:')
            ? (process.env[api.key.replace('env:', '')] || '')
            : (api.key || '')
          return k.length > 0
        })(),
      })),
      routing: config.routing || { mode: 'auto', fallbackToOllama: true },
      ollama:  config.providers.ollama,
    })
  })

  // POST /api/providers/add â€” add or update a single API key
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

  // DELETE /api/providers/:name â€” remove an API
  app.delete('/api/providers/:name', (req: Request, res: Response) => {
    const config = loadConfig()
    config.providers.apis = config.providers.apis.filter(a => a.name !== req.params.name)
    saveConfig(config)
    res.json({ success: true })
  })

  // PATCH /api/providers/:name â€” update enabled/rateLimited/model etc.
  app.patch('/api/providers/:name', (req: Request, res: Response) => {
    const config = loadConfig()
    config.providers.apis = config.providers.apis.map(a =>
      a.name === req.params.name ? { ...a, ...req.body } : a
    )
    saveConfig(config)
    res.json({ success: true })
  })

  // POST /api/providers/reset-limits â€” manually reset all rate limits
  app.post('/api/providers/reset-limits', (_req: Request, res: Response) => {
    const config = loadConfig()
    config.providers.apis = config.providers.apis.map(a => ({ ...a, rateLimited: false, rateLimitedAt: undefined }))
    saveConfig(config)
    res.json({ success: true, message: 'All rate limits reset' })
  })

  // POST /api/providers/switch â€” switch active model/provider
  app.post('/api/providers/switch', (req: Request, res: Response) => {
    const { active, activeModel } = req.body as { active?: string; activeModel?: string }
    const config = loadConfig()
    config.model = { active: active || 'ollama', activeModel: activeModel || 'mistral:7b' }
    saveConfig(config)
    res.json({ success: true })
  })

  // â”€â”€ Knowledge Base endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // GET /api/knowledge â€” list all files + stats
  // GET /api/kb/graph — DeepKB graph endpoint
  app.get('/api/kb/graph', (_req: Request, res: Response) => {
    res.json({ message: 'DeepKB graph endpoint active' })
  })

  app.get('/api/knowledge', (_req: Request, res: Response) => {
    try {
      res.json({ files: knowledgeBase.listFiles(), stats: knowledgeBase.getStats() })
    } catch (e: any) { res.status(500).json({ error: e.message }) }
  })

  // POST /api/knowledge/upload â€” binary file upload (PDF/EPUB/TXT/MD) via multipart/form-data
  // Fields: file (binary), category (optional), tags (optional csv), privacy (optional)
  // PDF and EPUB require a Pro license.
  app.post('/api/knowledge/upload', (req: Request, res: Response) => {
    kbUpload.single('file')(req, res, async (err) => {
      if (err) { res.status(400).json({ error: err.message }); return }

      const file = (req as any).file as Express.Multer.File | undefined

      // Pro gate â€” PDF and EPUB require an active Pro license
      if (file) {
        const ext = path.extname(file.originalname).toLowerCase()
        if ((ext === '.pdf' || ext === '.epub') && !isPro()) {
          try { fs.unlinkSync(file.path) } catch {}
          res.status(403).json({
            error:   'Pro license required',
            message: 'PDF and EPUB uploads are a Pro feature. Upgrade at DevOS Settings â†’ Pro License.',
            upgrade: true,
          })
          return
        }
      }

      // Legacy JSON path â€” if no file but content string provided, fall back to ingestText
      if (!file) {
        const { content, filename, category = 'general', tags = '', privacy = 'public' } = req.body as {
          content?: string; filename?: string; category?: string; tags?: string; privacy?: string
        }
        if (!content || !filename) {
          res.status(400).json({ error: 'Provide either a file upload or { content, filename }' }); return
        }
        const tagList = tags ? tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []
        const result  = knowledgeBase.ingestText(
          content, filename, category, tagList,
          (privacy as 'public' | 'private' | 'sensitive') || 'public',
        )
        if (!result.success) { res.status(400).json({ error: result.error }); return }
        res.json({ success: true, filename, chunkCount: result.chunkCount, message: `Ingested ${result.chunkCount} chunks` })
        return
      }

      try {
        const { category = 'general', tags = '', privacy = 'public' } = req.body as {
          category?: string; tags?: string; privacy?: string
        }
        const tagList = tags ? tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []

        const result = await knowledgeBase.ingestFile(
          file.path,
          category,
          (privacy as 'public' | 'private' | 'sensitive') || 'public',
          tagList,
        )

        // Clean up temp upload file (content is now in the KB store)
        try { fs.unlinkSync(file.path) } catch {}

        if (!result.success) { res.status(400).json({ error: result.error }); return }

        res.json({
          success:    true,
          filename:   file.originalname,
          format:     result.format,
          chunkCount: result.chunkCount,
          wordCount:  result.wordCount,
          pageCount:  result.pageCount,
          message:    `Ingested ${result.chunkCount} chunks from ${file.originalname}`,
        })
      } catch (e: any) {
        try { if (file?.path) fs.unlinkSync(file.path) } catch {}
        res.status(500).json({ error: e.message })
      }
    })
  })

  // POST /api/knowledge/upload/async â€” returns a jobId immediately, processes in background
  // PDF and EPUB require a Pro license.
  app.post('/api/knowledge/upload/async', (req: Request, res: Response) => {
    kbUpload.single('file')(req, res, async (err) => {
      if (err) { res.status(400).json({ error: err.message }); return }

      const file = (req as any).file as Express.Multer.File | undefined
      if (!file) { res.status(400).json({ error: 'file required for async upload' }); return }

      // Pro gate â€” PDF and EPUB require an active Pro license
      const extAsync = path.extname(file.originalname).toLowerCase()
      if ((extAsync === '.pdf' || extAsync === '.epub') && !isPro()) {
        try { fs.unlinkSync(file.path) } catch {}
        res.status(403).json({
          error:   'Pro license required',
          message: 'PDF and EPUB uploads are a Pro feature. Upgrade at DevOS Settings â†’ Pro License.',
          upgrade: true,
        })
        return
      }

      const jobId   = `job_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      const { category = 'general', tags = '', privacy = 'public' } = req.body as {
        category?: string; tags?: string; privacy?: string
      }
      const tagList = tags ? tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []

      kbProgress.set(jobId, { status: 'processing', progress: 10, message: 'Extracting textâ€¦' })

      // Fire-and-forget background processing
      ;(async () => {
        try {
          kbProgress.set(jobId, { status: 'processing', progress: 40, message: 'Chunking & embeddingâ€¦' })

          const result = await knowledgeBase.ingestFile(
            file.path,
            category,
            (privacy as 'public' | 'private' | 'sensitive') || 'public',
            tagList,
          )

          try { fs.unlinkSync(file.path) } catch {}

          if (!result.success) {
            kbProgress.set(jobId, { status: 'error', progress: 100, message: result.error || 'Ingestion failed' })
            return
          }

          kbProgress.set(jobId, {
            status:   'done',
            progress: 100,
            message:  `Done â€” ${result.chunkCount} chunks from ${file.originalname}`,
            result:   { filename: file.originalname, format: result.format, chunkCount: result.chunkCount, wordCount: result.wordCount, pageCount: result.pageCount },
          })

          // Auto-expire progress entry after 5 minutes
          setTimeout(() => kbProgress.delete(jobId), 5 * 60 * 1000)

        } catch (e: any) {
          try { if (file?.path) fs.unlinkSync(file.path) } catch {}
          kbProgress.set(jobId, { status: 'error', progress: 100, message: e.message })
        }
      })()

      res.json({ success: true, jobId, message: 'Upload started â€” poll /api/knowledge/progress/' + jobId })
    })
  })

  // GET /api/knowledge/progress/:jobId â€” poll async upload progress
  app.get('/api/knowledge/progress/:jobId', (req: Request, res: Response) => {
    const entry = kbProgress.get(String(req.params.jobId))
    if (!entry) { res.status(404).json({ error: 'Job not found or already expired' }); return }
    res.json(entry)
  })

  // GET /api/knowledge/search?q= â€” search knowledge base
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

  // POST /api/knowledge/search â€” search knowledge base (JSON body)
  app.post('/api/knowledge/search', async (req: Request, res: Response) => {
    try {
      const { query, limit = 5 } = req.body as { query?: string; limit?: number }
      if (!query) { res.status(400).json({ error: 'query required' }); return }
      const chunks = knowledgeBase.search(String(query), Number(limit))
      res.json({
        results: chunks.map(c => ({
          text:     c.text.slice(0, 500),
          filename: c.filename,
          category: c.category,
          score:    c.usageCount,
        })),
        count: chunks.length,
        query,
      })
    } catch (err: any) { res.status(500).json({ error: err.message }) }
  })

  // POST /api/memory/search â€” search conversation memory
  app.post('/api/memory/search', async (req: Request, res: Response) => {
    try {
      const { query, limit = 5 } = req.body as { query?: string; limit?: number }
      const q = query ? String(query) : ''
      // Build context and return relevant snippets
      const context = conversationMemory.buildContext()
      const lines   = context.split('\n').filter(l => !q || l.toLowerCase().includes(q.toLowerCase()))
      res.json({ results: lines.slice(0, Number(limit)), count: lines.length })
    } catch (err: any) { res.status(500).json({ error: err.message }) }
  })

  // GET /api/providers/status â€” provider health status
  app.get('/api/providers/status', async (_req: Request, res: Response) => {
    try {
      const config = loadConfig()
      const providers = config.providers.apis.map((api: APIEntry) => ({
        name:        api.name,
        provider:    api.provider,
        model:       api.model,
        enabled:     api.enabled,
        rateLimited: api.rateLimited,
        status:      api.rateLimited ? 'rate_limited' : api.enabled ? 'ok' : 'disabled',
        usageCount:  api.usageCount || 0,
      }))
      res.json({ providers, ollama: config.providers?.ollama || {} })
    } catch (err: any) { res.status(500).json({ error: err.message }) }
  })

  // GET /api/conversations â€” list conversation sessions
  app.get('/api/conversations', async (_req: Request, res: Response) => {
    try {
      const sessions = conversationMemory.getSessions ? conversationMemory.getSessions() : []
      res.json({ conversations: sessions, count: sessions.length })
    } catch (err: any) { res.status(500).json({ error: err.message, conversations: [] }) }
  })

  // DELETE /api/knowledge/:fileId â€” delete a file
  app.delete('/api/knowledge/:fileId', (req: Request, res: Response) => {
    const deleted = knowledgeBase.deleteFile(String(req.params.fileId))
    if (!deleted) { res.status(404).json({ error: 'File not found' }); return }
    res.json({ success: true, message: 'File deleted from knowledge base' })
  })

  // GET /api/knowledge/stats
  app.get('/api/knowledge/stats', (_req: Request, res: Response) => {
    res.json(knowledgeBase.getStats())
  })

  // â”€â”€ Skill teacher endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // GET /api/skills/learned â€” list learned + approved skills + stats
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

  // DELETE /api/skills/learned/:name â€” delete a learned skill
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

  // GET /api/config â€” current active model + user info
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

  // POST /api/providers/validate â€” test an API key without saving it
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
        case 'cloudflare': {
          const [accountId] = (model || '').split('|')
          if (!accountId) { valid = false; error = 'Model must be accountId|modelName'; break }
          const r = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
            {
              method:  'POST',
              headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
              body:    JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
              signal:  AbortSignal.timeout(8000),
            }
          )
          valid = r.ok
          if (!r.ok) error = `${r.status}: ${await r.text()}`
          break
        }
        case 'github': {
          const r = await fetch('https://models.inference.ai.azure.com/v1/chat/completions', {
            method:  'POST',
            headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
            body:    JSON.stringify({ model: 'gpt-4o-mini', messages: testMessages, max_tokens: 5 }),
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

  // POST /api/keys/validate â€” alias for /api/providers/validate with Ollama support
  // Used by onboarding modal Test buttons and settings drawer.
  // Response: { valid: boolean, status?: number, models?: number, error?: string, provider: string }
  app.post('/api/keys/validate', async (req: Request, res: Response) => {
    const { provider, key } = req.body as { provider?: string; key?: string }
    if (!provider) { res.status(400).json({ error: 'Unknown provider' }); return }

    try {
      if (provider === 'gemini') {
        const r = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
          {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body:    JSON.stringify({ model: 'gemini-2.0-flash', messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }),
            signal:  AbortSignal.timeout(8000),
          }
        )
        return res.json({ valid: r.ok, status: r.status, provider: 'gemini' })
      }

      if (provider === 'groq') {
        const r = await fetch(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body:    JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }),
            signal:  AbortSignal.timeout(8000),
          }
        )
        return res.json({ valid: r.ok, status: r.status, provider: 'groq' })
      }

      if (provider === 'ollama') {
        const r = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) })
        const data = await r.json() as { models?: unknown[] }
        return res.json({ valid: r.ok, models: data.models?.length || 0, provider: 'ollama' })
      }

      // For all other providers, delegate to the full validate handler
      const testMessages = [{ role: 'user', content: 'Say "ok" in one word only.' }]
      const testModel    = getDefaultModel(provider)
      let valid = false
      let error = ''

      if (provider === 'openrouter') {
        const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method:  'POST',
          headers: {
            'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`,
            'HTTP-Referer': 'http://localhost:3000', 'X-Title': 'DevOS',
          },
          body:    JSON.stringify({ model: 'meta-llama/llama-3.2-1b-instruct:free', messages: testMessages, max_tokens: 5 }),
          signal:  AbortSignal.timeout(8000),
        })
        valid = r.ok
        if (!r.ok) error = `${r.status}`
      }

      res.json({ valid, status: valid ? 200 : 401, error: valid ? undefined : error, provider })
    } catch (err: any) {
      res.json({ valid: false, error: err.message, provider })
    }
  })

  // POST /api/goals â€” start execution loop async
  app.post('/api/goals', async (req: Request, res: Response) => {
    const { title, description } = req.body as { title?: string; description?: string }
    if (!title) return res.status(400).json({ error: 'title required' })
    const goal = description ? `${title}: ${description}` : title
    // Run async â€” don't await so UI gets immediate response
    import('../core/executionLoop').then(({ runGoalLoop }) => {
      runGoalLoop(goal).catch(console.error)
    })
    res.json({
      id:      `goal_${Date.now()}`,
      title,
      status:  'running',
      message: 'Goal started â€” watch LivePulse for progress',
    })
  })

  // GET /api/goals
  app.get('/api/goals', (_req: Request, res: Response) => {
    res.json({ goals: [], message: 'Goal history coming soon' })
  })

  // GET /api/evolution â€” self-evolution stats
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

  // GET /api/capability — hardware capability profile
  app.get('/api/capability', (_req: Request, res: Response) => {
    const { loadCapabilityProfile } = require('../core/capabilityProfile')
    res.json(loadCapabilityProfile() || { error: 'Profile not built yet' })
  })

  // GET /api/audit/today — daily activity summary
  app.get('/api/audit/today', (_req: Request, res: Response) => {
    const entries = auditTrail.getToday()
    res.json({
      entries,
      summary: auditTrail.formatSummary(entries),
    })
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

  // GET /api/stream â€” SSE keep-alive
  app.get('/api/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type',  'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection',    'keep-alive')
    res.flushHeaders()
    const interval = setInterval(() => res.write('data: {"type":"ping"}\n\n'), 30_000)
    req.on('close', () => clearInterval(interval))
  })

  // GET /api/pulse â€” SSE stream of LivePulse events (tool:start, tool:done, plan:start, plan:done)
  // Dashboard connects here to show real-time execution activity.
  app.get('/api/pulse', (req: Request, res: Response) => {
    res.setHeader('Content-Type',      'text/event-stream')
    res.setHeader('Cache-Control',     'no-cache')
    res.setHeader('Connection',        'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.flushHeaders()

    // Send ping every 25s to keep connection alive
    const ping = setInterval(() => {
      try { res.write('data: {"event":"ping"}\n\n') } catch {}
    }, 25_000)

    // Bridge livePulse EventEmitter â†’ SSE
    const onPulse = (event: any) => {
      try {
        const payload = JSON.stringify({ event: event.type, data: event, ts: Date.now() })
        res.write(`data: ${payload}\n\n`)
      } catch { /* client disconnected */ }
    }
    livePulse.on('any', onPulse)

    req.on('close', () => {
      clearInterval(ping)
      livePulse.removeListener('any', onPulse)
    })
  })

  // â”€â”€ Computer-use routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // POST /api/automate, POST /api/automate/stop,
  // GET  /api/automate/log, GET /api/automate/session
  registerComputerUseRoutes(app)

  // GET /api/plan/:id â€” get plan status
  app.get('/api/plan/:id', (req: Request, res: Response) => {
    const plan = planTool.getPlan(String(req.params.id))
    if (!plan) { res.status(404).json({ error: 'Plan not found' }); return }
    res.json(plan)
  })

  // GET /api/plans/recent â€” list 10 most recent task plans
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

  // GET /api/skills â€” list all available skills
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

  // GET /api/skills/relevant?q=query â€” find skills for a query
  app.get('/api/skills/relevant', (req: Request, res: Response) => {
    const query = (req.query.q as string) || ''
    if (!query) { res.status(400).json({ error: 'q parameter required' }); return }
    const relevant = skillLoader.findRelevant(query)
    res.json(relevant.map(s => ({ name: s.name, description: s.description, tags: s.tags })))
  })

  // POST /api/skills/refresh â€” reload all skills from disk
  app.post('/api/skills/refresh', (_req: Request, res: Response) => {
    skillLoader.refresh()
    const skills = skillLoader.loadAll()
    res.json({ success: true, count: skills.length, skills: skills.map(s => s.name) })
  })

  // GET /api/tasks â€” list all tasks with status
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

  // GET /api/tasks/:id â€” get single task detail
  app.get('/api/tasks/:id', (req: Request, res: Response) => {
    const state = taskStateManager.load(String(req.params.id))
    if (!state) { res.status(404).json({ error: 'Task not found' }); return }
    res.json(state)
  })

  // POST /api/tasks/:id/retry â€” reset a failed task and re-run recovery
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

  // GET /api/memory â€” return current conversation facts and recent history
  app.get('/api/memory', (_req: Request, res: Response) => {
    res.json({
      facts:         conversationMemory.getFacts(),
      recentHistory: conversationMemory.getRecentHistory(),
    })
  })

  // DELETE /api/memory â€” clear all conversation memory
  app.delete('/api/memory', (_req: Request, res: Response) => {
    conversationMemory.clear()
    res.json({ success: true, message: 'Conversation memory cleared' })
  })

  // GET /api/memory/semantic?q=query â€” semantic search or stats
  app.get('/api/memory/semantic', (req: Request, res: Response) => {
    const query = req.query.q as string
    if (!query) {
      res.json(semanticMemory.getStats())
      return
    }
    const results = semanticMemory.searchText(query, 5)
    res.json({ query, results })
  })

  // GET /api/memory/graph?entity=name â€” entity relationships or graph overview
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

  // GET /api/memory/learning?q=query â€” learning stats or similar past experiences
  app.get('/api/memory/learning', (req: Request, res: Response) => {
    const query = req.query.q as string
    res.json({
      stats:   learningMemory.getStats(),
      similar: query ? learningMemory.findSimilar(query) : [],
    })
  })

  // GET /api/memory/sessions â€” list all session IDs
  app.get('/api/memory/sessions', (_req: Request, res: Response) => {
    res.json({ sessions: conversationMemory.getSessions() })
  })

  // GET /api/screenshot â€” serve latest screenshot from workspace/screenshots/
  app.get('/api/screenshot', (_req: Request, res: Response) => {
    try {
      const dir = path.join(process.cwd(), 'workspace', 'screenshots')
      if (!fs.existsSync(dir)) { res.status(404).end(); return }
      const files = fs.readdirSync(dir)
        .filter((f: string) => f.endsWith('.png'))
        .sort().reverse()
      if (!files.length) { res.status(404).end(); return }
      const imgPath = path.join(dir, files[0])
      res.setHeader('Content-Type', 'image/png')
      res.setHeader('Cache-Control', 'no-cache, no-store')
      res.send(fs.readFileSync(imgPath))
    } catch { res.status(500).end() }
  })

  // GET /api/stocks â€” fetch stock data via Yahoo Finance or DuckDuckGo
  app.get('/api/stocks', async (req: Request, res: Response) => {
    const query = (req.query.q as string) || 'NSE top gainers'
    try {
      const yahooUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`
      const r1 = await fetch(yahooUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0' }
      })
      if (r1.ok) {
        const data = await r1.json()
        return res.json({ source: 'yahoo', data })
      }
    } catch {}
    try {
      const r2 = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query + ' stock price NSE BSE')}&format=json&no_html=1`)
      const data = await r2.json()
      return res.json({ source: 'ddg', data })
    } catch {}
    res.status(500).json({ error: 'Stock data unavailable' })
  })

  // GET /api/screen/size â€” get primary screen dimensions
  app.get('/api/screen/size', async (_req: Request, res: Response) => {
    try {
      const size = await getScreenSize()
      res.json(size)
    } catch {
      res.json({ width: 1920, height: 1080 })
    }
  })

  // POST /api/screenshot/capture â€” trigger a screenshot and return its path
  app.post('/api/screenshot/capture', async (_req: Request, res: Response) => {
    try {
      const filepath = await captureScreen()
      res.json({ success: true, path: filepath })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // GET /api/mcp/list â€” list connected MCP plugins (stub)
  app.get('/api/mcp/list', (_req: Request, res: Response) => {
    res.json({ plugins: [] })
  })

  // POST /api/mcp/connect â€” connect a new MCP plugin (stub)
  app.post('/api/mcp/connect', (_req: Request, res: Response) => {
    res.json({ success: true })
  })

  // â”€â”€ Voice endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // GET /api/voice/status â€” check STT and TTS availability
  app.get('/api/voice/status', async (_req: Request, res: Response) => {
    const [stt, tts] = await Promise.all([checkVoiceAvailable(), checkTTSAvailable()])
    res.json({ stt, tts })
  })

  // POST /api/voice/record â€” record audio from microphone (Pro only)
  // body: { duration?: number }  (ms, default 5000)
  app.post('/api/voice/record', async (req: Request, res: Response) => {
    if (!isPro()) {
      res.status(403).json({ success: false, error: 'Pro license required', upgrade: true }); return
    }
    try {
      const duration = Math.min(Number(req.body?.duration) || 5000, 15000)
      const audioPath = await recordAudio(duration)
      res.json({ success: true, path: audioPath })
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message })
    }
  })

  // POST /api/voice/transcribe â€” transcribe a recorded audio file
  // body: { path: string }
  app.post('/api/voice/transcribe', async (req: Request, res: Response) => {
    try {
      const { path: audioPath } = req.body as { path?: string }
      if (!audioPath) { res.status(400).json({ error: 'path required' }); return }
      const text = await transcribeAudio(audioPath)
      res.json({ success: true, text })
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message })
    }
  })

  // POST /api/voice/speak â€” speak text aloud (non-blocking) (Pro only)
  // body: { text: string, voice?: string }
  app.post('/api/voice/speak', async (req: Request, res: Response) => {
    if (!isPro()) {
      res.status(403).json({ success: false, error: 'Pro license required', upgrade: true }); return
    }
    try {
      const { text, voice } = req.body as { text?: string; voice?: string }
      if (!text) { res.status(400).json({ error: 'text required' }); return }
      // Fire and forget â€” response returns immediately while audio plays
      speak(text, voice).catch(e => console.error('[TTS] speak error:', e.message))
      res.json({ success: true })
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message })
    }
  })

  // â”€â”€ 404 catch-all â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // ── UserCognitionProfile ────────────────────────────────────────

  // GET /api/cognition/profile — current inferred user cognitive style
  app.get('/api/cognition/profile', (_req: Request, res: Response) => {
    try {
      res.json(userCognitionProfile.getProfile())
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

    // ── GrowthEngine ──────────────────────────────────────────────

  // GET /api/growth/report — weekly summary: successes, failures, gaps, proposals
  app.get('/api/growth/report', (_req: Request, res: Response) => {
    try {
      res.json(growthEngine.getWeeklyReport())
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // GET /api/growth/gaps — live capability gap analysis
  app.get('/api/growth/gaps', (_req: Request, res: Response) => {
    try {
      res.json({ gaps: growthEngine.analyze() })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // GET /api/growth/failures — recent failure log (raw JSONL lines)
  app.get('/api/growth/failures', (_req: Request, res: Response) => {
    try {
      const limitParam = parseInt(((_req as any).query?.limit as string) || '20', 10)
      const logPath = require('path').join(process.cwd(), 'workspace', 'growth', 'failure-log.jsonl')
      const fs2     = require('fs')
      if (!fs2.existsSync(logPath)) { res.json({ failures: [] }); return }
      const lines   = fs2.readFileSync(logPath, 'utf-8').trim().split('\n').filter(Boolean)
      const recent  = lines.slice(-limitParam).map((l: string) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
      res.json({ failures: recent })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' })
  })

  return app
}

// â”€â”€ Helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Startup health check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Validates that every core subsystem initialises without throwing.
// Logs a summary so operators can spot broken modules at boot time.

export function startupCheck(): void {
  const checks: { name: string; ok: boolean; detail?: string }[] = []

  // SkillLoader
  try {
    const skills = skillLoader.loadAll()
    checks.push({ name: 'SkillLoader', ok: true, detail: `${skills.length} skill(s) loaded` })
  } catch (e: any) {
    checks.push({ name: 'SkillLoader', ok: false, detail: e.message })
  }

  // KnowledgeBase
  try {
    const stats = knowledgeBase.getStats()
    checks.push({ name: 'KnowledgeBase', ok: true, detail: `${stats.files} file(s), ${stats.chunks} chunk(s)` })
  } catch (e: any) {
    checks.push({ name: 'KnowledgeBase', ok: false, detail: e.message })
  }

  // SkillTeacher
  try {
    const stats = skillTeacher.getStats()
    checks.push({ name: 'SkillTeacher', ok: true, detail: `${stats.learned} learned, ${stats.approved} approved` })
  } catch (e: any) {
    checks.push({ name: 'SkillTeacher', ok: false, detail: e.message })
  }

  // ConversationMemory
  try {
    conversationMemory.getFacts()
    checks.push({ name: 'ConversationMemory', ok: true })
  } catch (e: any) {
    checks.push({ name: 'ConversationMemory', ok: false, detail: e.message })
  }

  // SemanticMemory
  try {
    const stats = semanticMemory.getStats()
    checks.push({ name: 'SemanticMemory', ok: true, detail: `${stats.total} item(s)` })
  } catch (e: any) {
    checks.push({ name: 'SemanticMemory', ok: false, detail: e.message })
  }

  // EntityGraph
  try {
    const stats = entityGraph.getStats()
    checks.push({ name: 'EntityGraph', ok: true, detail: `${stats.nodes} node(s), ${stats.edges} edge(s)` })
  } catch (e: any) {
    checks.push({ name: 'EntityGraph', ok: false, detail: e.message })
  }

  // Print summary
  const allOk = checks.every(c => c.ok)
  console.log(`[Startup] Health check â€” ${allOk ? 'ALL OK' : 'SOME FAILED'}`)
  for (const c of checks) {
    const icon = c.ok ? 'âœ“' : 'âœ—'
    const detail = c.detail ? ` â€” ${c.detail}` : ''
    console.log(`[Startup]   ${icon} ${c.name}${detail}`)
  }
}

// â”€â”€ Server launcher â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€ TASK 2: Process-level error handlers â€” prevent silent crashes â”€
  process.on('unhandledRejection', (reason: any) => {
    console.error('[Process] Unhandled promise rejection:', reason?.message ?? reason)
    try { livePulse.error('Aiden', `Unhandled rejection: ${String(reason?.message ?? reason).slice(0, 100)}`) } catch {}
  })
  process.on('uncaughtException', (err: Error) => {
    console.error('[Process] Uncaught exception:', err.message)
    console.error('[Process] Stack:', err.stack?.split('\n').slice(0, 5).join('\n'))
    try { livePulse.error('Aiden', `Uncaught exception: ${err.message.slice(0, 100)}`) } catch {}
    // Do NOT exit â€” let the server keep running for other requests
  })

  const app    = createApiServer()
  const server = http.createServer(app)

  // â”€â”€ Startup health check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  try { startupCheck() } catch (e: any) {
    console.error('[Startup] startupCheck threw:', e.message)
  }

  // â”€â”€ WebSocket server â€” LivePulse bridge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const wss = new WebSocketServer({ server })
  const wsClients = new Set<any>()

  wss.on('connection', (ws) => {
    wsClients.add(ws)
    // Send last 20 history events to newly connected client so UI isn't blank
    const recentHistory = livePulse.getHistory().slice(-20)
    recentHistory.forEach(event => {
      try {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'pulse', event }))
        }
      } catch {}
    })
    ws.on('close', () => wsClients.delete(ws))
    ws.on('error', () => wsClients.delete(ws))
  })

  // Forward ALL livePulse events to ALL connected WebSocket clients
  livePulse.on('any', (event) => {
    const payload = JSON.stringify({ type: 'pulse', event })
    wsClients.forEach(ws => {
      try {
        if (ws.readyState === ws.OPEN) ws.send(payload)
      } catch {}
    })
  })

  // Stale task cleanup â€” mark running tasks older than 1h as failed (runs before recovery)
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

  // Run crash recovery on startup â€” non-blocking, finds 'running' tasks from prior session
  recoverTasks().catch(e => console.error('[Startup] Recovery error:', e.message))

  // Start background license refresh (12-hour interval, silent)
  startLicenseRefresh()

  // Log provider chain before listening so it's visible in startup log
  try { logProviderStatus() } catch {}

  server.listen(port, host, () => {
    console.log(`[API] DevOS v2.0 Â· Aiden running at http://${host}:${port}`)
    console.log(`[API] Health: http://${host}:${port}/api/health`)
    console.log(`[API] LivePulse WS: ws://${host}:${port}`)
  })

  return app
}

// ── Provider racing helpers ─────────────────────────────────
// fetchProviderResponse: fires a single non-streaming request to a provider.
// raceProviders: fires top-2 simultaneously, returns the fastest valid response.

async function fetchProviderResponse(
  api:      import('../providers/index').APIEntry,
  messages: { role: string; content: string }[],
  signal:   AbortSignal,
): Promise<{ text: string; apiName: string }> {
  const key = api.key.startsWith('env:')
    ? (process.env[api.key.replace('env:', '')] || '')
    : api.key
  const providerType = api.provider
  const model        = api.model

  if (providerType === 'gemini') {
    const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model, messages, stream: false }),
      signal,
    })
    if (!resp.ok) throw new Error(`Gemini ${resp.status}`)
    const d = await resp.json() as any
    return { text: d?.choices?.[0]?.message?.content || '', apiName: api.name }

  } else if (providerType === 'ollama') {
    const resp = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
      signal,
    })
    if (!resp.ok) throw new Error(`Ollama ${resp.status}`)
    const d = await resp.json() as any
    return { text: d?.message?.content || '', apiName: api.name }

  } else {
    const COMPAT_ENDPOINTS: Record<string, string> = {
      groq:       'https://api.groq.com/openai/v1/chat/completions',
      openrouter: 'https://openrouter.ai/api/v1/chat/completions',
      cerebras:   'https://api.cerebras.ai/v1/chat/completions',
      openai:     'https://api.openai.com/v1/chat/completions',
      nvidia:     'https://integrate.api.nvidia.com/v1/chat/completions',
      github:     'https://models.inference.ai.azure.com/chat/completions',
    }
    const endpoint = COMPAT_ENDPOINTS[providerType] ?? COMPAT_ENDPOINTS['groq']
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        ...(providerType === 'openrouter' ? { 'HTTP-Referer': 'https://devos.local', 'X-Title': 'DevOS' } : {}),
      },
      body: JSON.stringify({ model, messages, stream: false, max_tokens: 2000 }),
      signal,
    })
    if (!resp.ok) throw new Error(`${providerType} ${resp.status}`)
    const d = await resp.json() as any
    return { text: d?.choices?.[0]?.message?.content || '', apiName: api.name }
  }
}

async function raceProviders(
  messages: { role: string; content: string }[],
  topN = 2,
): Promise<{ text: string; apiName: string } | null> {
  const cfg  = loadConfig()
  const apis = cfg.providers.apis
    .filter(a => {
      if (!a.enabled || a.rateLimited) return false
      const k = a.key.startsWith('env:') ? (process.env[a.key.replace('env:', '')] || '') : a.key
      return k.length > 0 && a.provider !== 'ollama'
    })
    .slice(0, topN)

  if (apis.length < 2) return null

  const controllers = apis.map(() => new AbortController())
  const promises = apis.map((api, i) =>
    fetchProviderResponse(api, messages, controllers[i].signal).then(result => {
      controllers.forEach((c, j) => { if (j !== i) { try { c.abort() } catch {} } })
      return result
    })
  )

  try {
    const winner = await Promise.race(promises)
    if (winner.text.trim()) return winner
  } catch {}
  return null
}

// ── Pure-chat streaming helper (no planner, no tools) ─────────

async function streamChat(
  message:  string,
  history:  { role: string; content: string }[],
  userName: string,
  _provider: any,
  model:    string,
  apiName:  string,
  send:     (data: object) => void,
): Promise<void> {
  // ── Sprint 1: First Message WOW — silent system context gathering ───────────────────
  const isFirstMessage = history.length === 0
  let firstMessageContext = ''
  if (isFirstMessage) {
    try {
      const [sysResult, windowsResult, diskResult] = await Promise.allSettled([
        executeTool('system_info', {}),
        executeTool('shell_exec', { command: 'Get-Process | Where-Object {$_.MainWindowTitle -ne ""} | Select-Object Name, MainWindowTitle, @{N="RAM_MB";E={[math]::Round($_.WorkingSet64/1MB,1)}} | ConvertTo-Json -Compress' }),
        executeTool('shell_exec', { command: 'Get-PSDrive C | Select-Object @{N="UsedGB";E={[math]::Round(($_.Used/1GB),1)}}, @{N="FreeGB";E={[math]::Round(($_.Free/1GB),1)}} | ConvertTo-Json -Compress' }),
      ])
      const sysInfo = sysResult.status === 'fulfilled' ? (sysResult.value as any).output ?? '' : ''
      const windows = windowsResult.status === 'fulfilled' ? (windowsResult.value as any).output ?? '' : ''
      const disk    = diskResult.status === 'fulfilled' ? (diskResult.value as any).output ?? '' : ''
      firstMessageContext = `\n\nSYSTEM CONTEXT (you silently gathered this — use it to show awareness of the user’s machine):\nHardware: ${sysInfo}\nOpen windows: ${windows}\nDisk: ${disk}\n\nOn this first message, respond by showing what you can see on their machine right now. Be specific and natural — not a feature list. Example: \"I can see you have VS Code open, 6GB RAM free, and your disk is 78% full. What are you working on?\"`
    } catch { /* silent — never block the response */ }
  }

  const cognitionHint = userCognitionProfile.getSystemPromptAddition()
  const chatPrompt = `You are Aiden — a personal AI OS built for ${userName}. You are sharp, direct, and slightly witty. You speak like a trusted co-founder. Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.${cognitionHint}${firstMessageContext}`

  const msgs = [
    { role: 'system', content: chatPrompt },
    ...history.slice(-8),
    { role: 'user', content: message },
  ]

  // ── Sprint 5: Provider racing ─ fire top-2, stream winner's tokens ───────────
  try {
    const raceResult = await raceProviders(msgs)
    if (raceResult) {
      // Simulate streaming: send each word as a token for natural feel
      const words = raceResult.text.split(' ')
      for (let wi = 0; wi < words.length; wi++) {
        const token = (wi === 0 ? '' : ' ') + words[wi]
        send({ token, done: false, provider: raceResult.apiName })
      }
      return
    }
  } catch { /* racing failed — fall through to sequential */ }

  // Sprint 6: use responder tier for streamChat provider selection
  const cfg              = loadConfig()
  const responderChat    = getModelForTask('responder')
  const providerType     = responderChat.providerName
  const apiKey           = responderChat.apiKey
  const activeStreamModel = responderChat.model || model // tiered model overrides caller's model

  let streamEnded = false
  const timeout = setTimeout(() => {
    if (!streamEnded) send({ done: true, error: 'Chat timeout' })
  }, 35000)

  try {
    if (providerType === 'gemini') {
      // ── Gemini via OpenAI-compat endpoint ─────────────────────
      const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model: activeStreamModel, messages: msgs, stream: true }),
      })
      if (!resp.ok || !resp.body) {
        const errText = await resp.text().catch(() => resp.statusText)
        if (resp.status === 429) markRateLimited(apiName)
        throw new Error(`Gemini ${resp.status}: ${errText}`)
      }
      const reader = resp.body.getReader()
      const dec    = new TextDecoder()
      let   buf    = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const data = trimmed.slice(5).trim()
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data)
            const token  = parsed.choices?.[0]?.delta?.content
            if (token) send({ token, done: false, provider: apiName })
          } catch { /* skip malformed chunks */ }
        }
      }

    } else if (providerType === 'ollama') {
      // ── Ollama — local streaming ───────────────────────────────
      const resp = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: activeStreamModel, messages: msgs, stream: true }),
      })
      if (!resp.ok || !resp.body) {
        throw new Error(`Ollama ${resp.status}: ${resp.statusText}`)
      }
      const reader = resp.body.getReader()
      const dec    = new TextDecoder()
      let   buf    = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const parsed = JSON.parse(line)
            const token  = parsed.message?.content
            if (token) send({ token, done: false, provider: apiName })
          } catch { /* skip malformed */ }
        }
      }

    } else {
      // ── OpenAI-compatible (Groq, OpenRouter, Cerebras, etc.) ──
      const ENDPOINTS: Record<string, string> = {
        groq:       'https://api.groq.com/openai/v1/chat/completions',
        openrouter: 'https://openrouter.ai/api/v1/chat/completions',
        cerebras:   'https://api.cerebras.ai/v1/chat/completions',
        openai:     'https://api.openai.com/v1/chat/completions',
      }
      const endpoint = ENDPOINTS[providerType] ?? ENDPOINTS['groq']
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          ...(providerType === 'openrouter' ? { 'HTTP-Referer': 'https://devos.local', 'X-Title': 'DevOS' } : {}),
        },
        body: JSON.stringify({ model: activeStreamModel, messages: msgs, stream: true }),
      })
      if (!resp.ok || !resp.body) {
        const errText = await resp.text().catch(() => resp.statusText)
        if (resp.status === 429) markRateLimited(apiName)
        throw new Error(`${providerType} ${resp.status}: ${errText}`)
      }
      const reader = resp.body.getReader()
      const dec    = new TextDecoder()
      let   buf    = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const data = trimmed.slice(5).trim()
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data)
            const token  = parsed.choices?.[0]?.delta?.content
            if (token) send({ token, done: false, provider: apiName })
          } catch { /* skip malformed chunks */ }
        }
      }
    }
  } catch (err: any) {
    // Primary failed — try Ollama as last-resort fallback
    if (providerType !== 'ollama') {
      console.warn(`[streamChat] ${providerType} failed (${err?.message}) — falling back to Ollama`)
      try {
        const ollamaModel = cfg.model?.activeModel || 'mistral:7b'
        const resp = await fetch('http://localhost:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: ollamaModel, messages: msgs, stream: true }),
        })
        if (resp.ok && resp.body) {
          const reader = resp.body.getReader()
          const dec    = new TextDecoder()
          let   buf    = ''
          while (true) {
            const { value, done } = await reader.read()
            if (done) break
            buf += dec.decode(value, { stream: true })
            const lines = buf.split('\n')
            buf = lines.pop() ?? ''
            for (const line of lines) {
              if (!line.trim()) continue
              try {
                const parsed = JSON.parse(line)
                const token  = parsed.message?.content
                if (token) send({ token, done: false, provider: 'ollama' })
              } catch { /* skip */ }
            }
          }
          streamEnded = true
          clearTimeout(timeout)
          return
        }
      } catch (ollamaErr) {
        console.error('[streamChat] Ollama fallback also failed:', ollamaErr)
      }
    }
    // Both failed — send a graceful error token
    send({ token: `Sorry, I could not reach any AI provider right now. Error: ${err?.message ?? 'unknown'}`, done: false, provider: 'error' })
  }

  streamEnded = true
  clearTimeout(timeout)
}
