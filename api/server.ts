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
import { getSmartProvider, markRateLimited, incrementUsage, logProviderStatus, getModelForTask, getLocalModels } from '../providers/router'
import { discoverLocalModels, getOllamaTimeout } from '../core/modelDiscovery'
import { detectTimezone } from '../core/userProfile'
import { executeTool } from '../core/toolRegistry'
import { getScreenSize, takeScreenshot as captureScreen } from '../core/computerControl'
import { planWithLLM, executePlan, respondWithResults, callLLM, surfaceRelevantMemories } from '../core/agentLoop'
import { TOOL_DESCRIPTIONS } from '../core/toolRegistry'
import { runReActLoop, ReActStep }                                 from '../core/reactLoop'
import { scheduler }                                              from '../core/scheduler'
import { AIDEN_STREAM_SYSTEM, SOUL as AIDEN_SOUL }      from '../core/aidenPersonality'
import { checkVoiceAvailable, recordAudio, transcribeAudio } from '../core/voiceInput'
import { speak, checkTTSAvailable }                    from '../core/voiceOutput'
import type { AgentPlan, StepResult, ToolStep }        from '../core/agentLoop'
import { planTool }                                     from '../core/planTool'
import type { Phase }                                   from '../core/planTool'
import { taskStateManager }                             from '../core/taskState'
import { taskQueue }                                    from '../core/taskQueue'
import { recoverTasks }                                 from '../core/taskRecovery'
import { skillLoader }                                  from '../core/skillLoader'
import { conversationMemory }                           from '../core/conversationMemory'
import { semanticMemory }                               from '../core/semanticMemory'
import { entityGraph }                                  from '../core/entityGraph'
import { learningMemory }                               from '../core/learningMemory'
import { knowledgeBase }                               from '../core/knowledgeBase'
import { extractYouTubeTranscript }                    from '../core/youtubeTranscript'
import { importChatGPT, importOpenClaw }               from '../core/importers'
import { deepKB }                                      from '../core/deepKB'
import multer                                           from 'multer'
import { skillTeacher }                               from '../core/skillTeacher'
import { growthEngine }                               from '../core/growthEngine'
import { userCognitionProfile }                      from '../core/userCognitionProfile'
import { isPro, validateLicense, getCurrentLicense, clearLicense, startLicenseRefresh,
         activateLicense, verifyLicense, getLicenseStatus, deactivateLicense } from '../core/licenseManager'
import { auditTrail } from '../core/auditTrail'
import { mcpClient }   from '../core/mcpClient'
import { responseCache } from '../core/responseCache'
import { scanAndRedact, containsSecret } from '../core/secretScanner'
import { loadBriefingConfig, saveBriefingConfig, deliverBriefing } from '../core/morningBriefing'
import { unifiedMemoryRecall, buildMemoryInjection } from '../core/memoryRecall'
import { costTracker }   from '../core/costTracker'
import { sessionMemory } from '../core/sessionMemory'
import { memoryExtractor } from '../core/memoryExtractor'
import { getIdentity, refreshIdentity } from '../core/aidenIdentity'
import { eventBus } from '../core/eventBus'
import { getWorkflow } from '../core/workflowTracker'
import { getHookCount } from '../core/hooks'
import { TelegramBot } from '../core/telegramBot'
import type { TelegramConfig } from '../core/telegramBot'

// —— Sprint 25: module-level WebSocket clients registry (shared between createApiServer routes and startApiServer WS setup)
let wsBroadcastClients   = new Set<any>()
let activeTelegramBot: TelegramBot | null = null

// ── Bookmarklet — clip selected text from any page ────────────
const BOOKMARKLET = `javascript:void(fetch('http://localhost:4200/api/clip',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:window.getSelection().toString()||document.title,source:window.location.href,title:document.title})}).then(()=>alert('Clipped!')))`

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


// ── Multi-question splitter ─────────────────────────────────────────────────────
function splitQuestions(message: string): string[] {
  if (message.length < 20) return [message]
  const patterns = [
    /\s+and\s+(?:also|then|please)?\s*/i,
    /\s*\.\s+(?:Also|Then|And|Plus|Next)\s+/i,
    /\s*\?\s+(?:Also|And|What|How|Can|Do|Is|Where|When|Who)\s+/i,
    /\s*,\s+(?:and\s+)?(?:also|then|plus)\s+/i,
  ]
  let parts = [message]
  for (const pattern of patterns) {
    const newParts: string[] = []
    for (const part of parts) {
      const split = part.split(pattern).filter(s => s.trim().length > 5)
      if (split.length > 1) { newParts.push(...split) } else { newParts.push(part) }
    }
    parts = newParts
  }
  const valid = parts.map(p => p.trim()).filter(p => p.length > 5)
  return valid.slice(0, 4)
}

function shouldSplit(message: string): boolean {
  const singleTaskPatterns = [
    /^(create|build|write|make|design|implement)\s/i,
    /^(research|analyze|compare|review)\s.*\band\b.*$/i,
    /step.by.step/i,
    /^(help me|can you|please)\s/i,
  ]
  return !singleTaskPatterns.some(p => p.test(message))
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
    send({ activity: { icon: '❌', agent: 'Aiden', message: 'Something went wrong', style: 'error' }, done: false })
    send({ token: `\n❌ **Something went wrong.** Please try again in a few moments, or check Settings → API Keys.\n`, done: false })
  }

  send({ done: true })
}


// Workspace root — AIDEN_USER_DATA in packaged Electron, cwd in dev
const WORKSPACE_ROOT = process.env.AIDEN_USER_DATA || process.cwd()

// â”€â”€ Knowledge upload â€” multer + progress tracking â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const KB_UPLOAD_DIR = path.join(WORKSPACE_ROOT, 'workspace', 'knowledge', 'uploads')
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
    res.json({ status: 'ok', version: '3.2.0', timestamp: new Date().toISOString() })
  })

  // ── Update endpoints ─────────────────────────────────────────

  // GET /api/update/check — proxy to license server, returns update info
  app.get('/api/update/check', async (_req: Request, res: Response) => {
    try {
      const { checkForUpdate } = await import('../core/updateChecker')
      const result = await checkForUpdate()
      res.json(result)
    } catch (e: any) {
      res.json({ available: false, currentVersion: '3.2.0', error: e.message })
    }
  })

  // POST /api/update/download — open download URL in default browser
  app.post('/api/update/download', (req: Request, res: Response) => {
    const { downloadUrl } = req.body as { downloadUrl?: string }
    if (!downloadUrl || !downloadUrl.startsWith('https://')) {
      return void res.status(400).json({ error: 'Invalid downloadUrl' })
    }
    const { exec } = require('child_process')
    exec(`start "" "${downloadUrl}"`)
    res.json({ opened: true })
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

  // POST /api/license/clear — deactivate / log out of Pro (legacy key format)
  app.post('/api/license/clear', (_req: Request, res: Response) => {
    clearLicense()
    res.json({ success: true })
  })

  // ── Pro License endpoints (AIDEN-PRO-xxxxxx-xxxxxx-xxxxxx) ───────────────

  // POST /api/license/activate — activate a Pro key on this machine
  app.post('/api/license/activate', async (req: Request, res: Response) => {
    const { key } = req.body as { key?: string }
    if (!key) { res.status(400).json({ error: 'key required' }); return }
    try {
      const result = await activateLicense(key.trim())
      if (result.success) {
        res.json({ success: true, plan: result.plan })
      } else {
        res.status(400).json({ success: false, error: result.error })
      }
    } catch (e: any) {
      res.status(500).json({ success: false, error: `Server error: ${e.message}` })
    }
  })

  // GET /api/license/pro-status — Pro license status from local cache (no network)
  app.get('/api/license/pro-status', (_req: Request, res: Response) => {
    const status = getLicenseStatus()
    res.json({
      isPro:     status.isPro,
      plan:      status.plan     || null,
      expiresAt: status.expiresAt || null,
      features:  status.features  || {},
    })
  })

  // POST /api/license/deactivate — remove this machine from the Pro license
  app.post('/api/license/deactivate', async (_req: Request, res: Response) => {
    try {
      const success = await deactivateLicense()
      if (success) {
        res.json({ success: true })
      } else {
        res.status(400).json({ success: false, error: 'Deactivation failed or no license found' })
      }
    } catch (e: any) {
      res.status(500).json({ success: false, error: `Server error: ${e.message}` })
    }
  })

  // ── Jailbreak detection patterns â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      mode?:      'auto' | 'plan' | 'chat' | 'react' | 'fast'
      sessionId?: string
    }

    // â”€â”€ Sanitize input â€” strip null bytes and control chars â”€â”€â”€â”€
    let message = req.body?.message || ''
    message = message.replace(/\x00/g, '').replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, '')

    // Sprint 22: secret scanning — warn and redact before any persist
    if (containsSecret(message)) {
      console.warn('[Security] Potential secret detected in user message \xe2\x80\x94 redacting before persist')
    }
    message = scanAndRedact(message)

    var MAX_MSG_LEN = 50000;

    // ── Detect SSE vs JSON mode early — needed by all fast-path handlers ──
    const acceptHeader = req.headers['accept'] || ''
    const useJsonMode  = !acceptHeader.includes('text/event-stream')

    // ── Fast-reply helper: responds correctly in both SSE and JSON mode ──
    const fastReply = (text: string, extra?: object) => {
      if (useJsonMode) {
        res.json({ message: text, response: text, ...extra })
      } else {
        res.setHeader('Content-Type',  'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection',    'keep-alive')
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.flushHeaders()
        res.write(`data: ${JSON.stringify({ token: text, done: false, provider: 'fast-path' })}\n\n`)
        res.write(`data: ${JSON.stringify({ done: true, provider: 'fast-path' })}\n\n`)
        res.end()
      }
    }

    if (!message || message.trim().length < 2) {
      fastReply('I am here. What can I help with?'); return
    }

    if (message.length > MAX_MSG_LEN) {
      fastReply('That message is very long. Break it into smaller parts.'); return
    }

    // ── Capability fast-path: return tool list directly from registry ──
    const CAPABILITY_PATS = [
      /list\s+(all\s+)?(your\s+)?(tools|skills|capabilities)/i,
      /what\s+(tools|skills)\s+do\s+you\s+have/i,
      /tell\s+me\s+(all\s+)?(your\s+)?(tools|skills|capabilities)/i,
      /what\s+can\s+you\s+do/i,
      /show\s+(me\s+)?(all\s+)?(your\s+)?(tools|skills|capabilities)/i,
    ]
    if (CAPABILITY_PATS.some(p => p.test(message))) {
      const toolNames  = Object.keys(TOOL_DESCRIPTIONS)
      const toolList   = toolNames.map(n => `• **${n}** — ${TOOL_DESCRIPTIONS[n]}`).join('\n')
      fastReply(`I have **${toolNames.length} built-in tools**:\n\n${toolList}`)
      return
    }

    // Banned topic intercept - short-circuit before LLM
    const BANNED_TOPIC_PATS = [
      /GSTs*(rate|code|filing|return|number|percent)/i,
      /HSNs*(code|number|list)/i,
      /trademarks*(registration|class|filing)/i,
      /payrolls*(processing|software|system)/i,
      /ledgers*(software|app|system|tool)/i,
      /GSTIN/i,
      /accounts?s*payable/i,
      /generals*ledger/i,
    ];
    if (BANNED_TOPIC_PATS.some(p => p.test(message))) {
      fastReply('That is outside what I do. I am Aiden - I help with computer control, coding, research, market data, file management, and automation. What can I help you with?'); return
    }

    // â”€â”€ Jailbreak detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const isJailbreak = JAILBREAK_PATTERNS.some(p =>
      message.toLowerCase().includes(p.toLowerCase())
    )
    if (isJailbreak) {
      fastReply('I am Aiden. My identity and safety rules cannot be overridden by conversation.', { blocked: true }); return
    }

    // â”€â”€ Dangerous command detection (pre-execution gate) â”€â”€â”€â”€â”€â”€â”€
    const isDangerous = DANGEROUS_PATTERNS.some(p =>
      message.toLowerCase().includes(p.toLowerCase())
    )
    if (isDangerous) {
      fastReply('CommandGate: I need your approval before running that operation. It contains a potentially dangerous command (data loss risk). Please confirm explicitly that you want to proceed, or rephrase your request.', { blocked: true, reason: 'dangerous_command' }); return
    }

    // â”€â”€ Fast math evaluation â€” simple arithmetic without LLM â”€â”€â”€
    const simpleMathMatch = message.match(/^what\s+is\s+([\d]+\s*[+\-*\/]\s*[\d]+)\s*\??$/i)
    if (simpleMathMatch) {
      try {
        // Safe eval: only digits and operators
        const expr = simpleMathMatch[1].replace(/[^0-9+\-*\/\s]/g, '')
        const result = Function(`"use strict"; return (${expr})`)()
        fastReply(String(result)); return
      } catch {}
    }

    // â”€â”€ Fast identity answers â€” don't need LLM for these â”€â”€â”€â”€â”€â”€
    const identityPatterns = [
      /what.{0,10}(is|are).{0,10}(your name|you called|you named)/i,
      /who are you/i,
      /what('s| is) your name/i,
      /are you (aiden|chatgpt|claude|gpt|openai)/i,
    ]
    // Fast who-built-you answers
    const builderPats = [
      /who\s+(built|made|created|developed|wrote)\s+you/i,
      /who\s+is\s+(your|the)\s+(creator|developer|maker|builder)/i,
      /were\s+you\s+(built|made|created)\s+by/i,
      /openai\s+or\s+someone\s+else/i,
    ]
    if (builderPats.some(p => p.test(message))) {
      fastReply('I was built by Shiva Deore at Taracod. Not OpenAI, not Anthropic, not Google. Just Taracod.'); return
    }

    if (identityPatterns.some(p => p.test(message))) {
      fastReply('I\'m Aiden \u2014 a personal AI OS built by Shiva Deore at Taracod. I run locally on your Windows machine using Ollama. Not ChatGPT, not Claude. Just Aiden.'); return
    }

    // ── Capabilities / tool count fast-path ── overrides LLM's stale “23” knowledge ──
    const capabilityPatterns = [
      /what can you do/i,
      /what are your (skills|capabilities|tools|abilities)/i,
      /tell me your capabilities/i,
      /how many (tools|skills|capabilities)/i,
      /what are you capable of/i,
      /(can you learn|do you learn|are you able to learn)/i,
      /are you just a pre.{0,10}trained/i,
    ]
    if (capabilityPatterns.some(p => p.test(message))) {
      fastReply(
        'I have 48 tools, 31 specialist agents, and a 6-layer memory system.\n\n' +
        'I am NOT a static pre-trained model. I have active living systems:\n' +
        '• **Skill Teacher** — promotes repeated successful patterns to reusable skills\n' +
        '• **Instinct System** — micro-behaviors that strengthen with use\n' +
        '• **Semantic Memory** — 500+ memories, 714-node entity graph across sessions\n' +
        '• **Growth Engine** — tracks failures, learns, improves over time\n' +
        '• **Night Mode** — consolidates knowledge during idle periods\n' +
        '• **XP & Leveling** — gains experience and levels up\n\n' +
        'Tools include: web_search, deep_research, file_write/read, shell_exec, run_python, ' +
        'open_browser, screenshot, manage_goals, manage_memories, git_commit, and 33 more.'
      ); return
    }

    // â”€â”€ Fast “running locally” answer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const localPatterns = [
      /are you (local|running locally|on.{0,20}machine|offline)/i,
      /do you (run|work) (locally|offline|on.{0,20}machine)/i,
      /where.{0,20}(run|hosted|deployed)/i,
      /run(ning)? (locally|on.{0,10}machine)/i,
      /(cloud or locally|locally or.{0,10}cloud|in the cloud)/i,
    ]
    if (localPatterns.some(p => p.test(message))) {
      fastReply('Locally. I run 100% on your machine \u2014 offline, private. I use Ollama for inference on your device. Your data never leaves this machine.'); return
    }

    // â”€â”€ Date/year fast-path â€” answer from system clock â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const _dateMsg = (message || '').toLowerCase()
    const DATE_PATTERNS = ['what year', 'current year', 'what time', 'what date', 'what is today', "today's date"]
    if (DATE_PATTERNS.some(p => _dateMsg.includes(p))) {
      const now = new Date()
      fastReply(`${now.toDateString()}. Year: ${now.getFullYear()}. Time: ${now.toLocaleTimeString()}.`, { success: true, provider: 'system_clock' }); return
    }

    // ── Goal management fast-path ── intercepts before planner so “Product Hunt goal” won't open browser ──
    const goalCreatePats = [
      /^(create|add|set|new)\s+(a\s+)?goal[\s:]+(.+)/i,
      /^goal[\s:]+(.+)/i,
    ]
    const goalShowPats = [
      /^(show|list|what are|display)\s+(my\s+)?goals\b/i,
      /^my goals\b/i,
    ]
    for (const gpat of goalCreatePats) {
      const gm = message.match(gpat)
      if (gm) {
        const title = (gm[3] || gm[1] || '').trim()
        if (title) {
          try {
            const gr = await executeTool('manage_goals', { action: 'add', title })
            fastReply(gr.output || `Goal added: ${title}`); return
          } catch (ge: any) {
            fastReply(`Could not add goal: ${ge.message}`); return
          }
        }
      }
    }
    if (goalShowPats.some(gp => gp.test(message))) {
      try {
        const gr = await executeTool('manage_goals', { action: 'list' })
        const goals = JSON.parse(gr.output || '[]') as Array<{ title: string; status: string; nextAction?: string }>
        if (!goals.length) { fastReply('No active goals yet. Say “create a goal: ...” to add one.'); return }
        const lines = goals.map((g, i) => `${i + 1}. **${g.title}** — ${g.status}${g.nextAction ? ` · next: ${g.nextAction}` : ''}`).join('\n')
        fastReply(`Your goals:\n${lines}`); return
      } catch (ge: any) {
        fastReply(`Could not fetch goals: ${ge.message}`); return
      }
    }

    // â”€â”€ Hardware info fast-path â€” from SOUL.md known config â”€â”€â”€
    // Context question fast-path - graceful at conversation start
    const CONTEXT_Q_PATS = [
      /what\s+(just\s+)?happened/i,
      /what\s+did\s+(we|i|you)\s+(just\s+)?(do|discuss|talk)/i,
    ]
    const inHistory = Array.isArray(req.body && req.body.history) ? req.body.history : []
    if (CONTEXT_Q_PATS.some(p => p.test(message)) && inHistory.length <= 2) {
      fastReply('This is the start of our conversation - nothing has happened yet. What would you like to work on?'); return
    }

    if (/what\s+(gpu|graphics|vram|ram|memory|cpu|processor|hardware|specs)\s+(do\s+i|have|i\s+have)|gpu\s+and\s+ram|hardware\s+specs|system\s+specs/i.test(message)) {
      fastReply('GPU: GTX 1060 6GB VRAM. RAM: detected at runtime (typically 8\u201316 GB). CPU: detected via system info. Run “system_info” for live hardware readings.'); return
    }

    // â”€â”€ File-read fast-path â€” try the file before calling LLM â”€â”€
    // This prevents hallucination on missing files and ensures honest "not found" responses.
    const fileReadMatch = message.match(/read\s+(?:file\s+)?([A-Z]:[/\\][^\s"']+|\/[^\s"']+|[\w./\\]+\.\w{1,6})/i)
    if (fileReadMatch) {
      const fs   = require('fs')
      const fp   = fileReadMatch[1]
      if (!fs.existsSync(fp)) {
        fastReply(`Cannot find file “${fp}” \u2014 it does not exist or is not accessible. Please check the path.`); return
      }
    }

    // ── Search / launch fast-path — intercepts BEFORE the planner ──────────────
    // Prevents the LLM from trying to type into browser URL bars.
    // Constructs the correct URL and calls open_browser directly.
    const searchFastPaths: Array<{ regex: RegExp; url: (q: string) => string; label: string }> = [
      // ── YouTube — specific “on youtube” patterns first ──
      { regex: /open\s+youtube\s+(?:and\s+)?(?:search|play|find|watch)\s+(?:for\s+)?(.+)/i,              url: q => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, label: 'YouTube' },
      { regex: /(?:search|find|watch)\s+(?:for\s+)?(.+?)\s+on\s+youtube/i,                               url: q => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, label: 'YouTube' },
      { regex: /play\s+(.+?)\s+on\s+youtube/i,                                                            url: q => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, label: 'YouTube' },
      { regex: /youtube\s+(?:search\s+(?:for\s+)?)?(.+)/i,                                                url: q => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, label: 'YouTube' },
      // ── Spotify — specific “on spotify” patterns first ──
      { regex: /open\s+spotify\s+(?:and\s+)?(?:search|play|find)\s+(?:for\s+)?(.+)/i,                    url: q => `https://open.spotify.com/search/${encodeURIComponent(q)}`, label: 'Spotify' },
      { regex: /play\s+(.+?)\s+on\s+spotify/i,                                                            url: q => `https://open.spotify.com/search/${encodeURIComponent(q)}`, label: 'Spotify' },
      { regex: /(?:search|find)\s+(?:for\s+)?(.+?)\s+on\s+spotify/i,                                     url: q => `https://open.spotify.com/search/${encodeURIComponent(q)}`, label: 'Spotify' },
      { regex: /spotify\s+(?:search\s+(?:for\s+)?|play\s+)?(.+)/i,                                       url: q => `https://open.spotify.com/search/${encodeURIComponent(q)}`, label: 'Spotify' },
      // ── Google — specific “on google” patterns first, generic last ──
      { regex: /open\s+google\s+(?:and\s+)?(?:search|look\s+up)\s+(?:for\s+)?(.+)/i,                     url: q => `https://www.google.com/search?q=${encodeURIComponent(q)}`, label: 'Google' },
      { regex: /(?:search|look\s+up)\s+(?:for\s+)?(.+?)\s+on\s+google/i,                                 url: q => `https://www.google.com/search?q=${encodeURIComponent(q)}`, label: 'Google' },
      { regex: /(?:search|find)\s+(?:for\s+)?(.+?)\s+online/i,                                           url: q => `https://www.google.com/search?q=${encodeURIComponent(q)}`, label: 'Google' },
      { regex: /^(?:google\s+|search\s+google\s+(?:for\s+)?)(.+)/i,                                       url: q => `https://www.google.com/search?q=${encodeURIComponent(q)}`, label: 'Google' },
      { regex: /^search\s+(?:for\s+)?(.+)/i,                                                              url: q => `https://www.google.com/search?q=${encodeURIComponent(q)}`, label: 'Google' },
      // ── Wikipedia ──
      { regex: /(?:open|search|look\s+up)\s+(?:wikipedia\s+(?:for\s+)?)?(.+?)\s+on\s+wikipedia/i,        url: q => `https://en.wikipedia.org/wiki/${encodeURIComponent(q.replace(/ /g,'_'))}`, label: 'Wikipedia' },
      { regex: /wikipedia\s+(.+)/i,                                                                        url: q => `https://en.wikipedia.org/wiki/${encodeURIComponent(q.replace(/ /g,'_'))}`, label: 'Wikipedia' },
      // ── GitHub ──
      { regex: /(?:search|find|look\s+up)\s+(?:for\s+)?(.+?)\s+on\s+github/i,                            url: q => `https://github.com/search?q=${encodeURIComponent(q)}`, label: 'GitHub' },
      { regex: /open\s+github\s+(?:and\s+)?(?:search|find)\s+(?:for\s+)?(.+)/i,                          url: q => `https://github.com/search?q=${encodeURIComponent(q)}`, label: 'GitHub' },
    ]

    for (const fp of searchFastPaths) {
      const m = message.match(fp.regex)
      if (m) {
        const query = (m[m.length - 1] || '').trim().replace(/[.!?]+$/, '')
        if (query.length > 1) {
          const url = fp.url(query)
          console.log(`[FastPath] ${fp.label} search: “${query}” → ${url}`)
          try {
            await executeTool('open_browser', { url })
          } catch (e: any) {
            console.warn('[FastPath] open_browser failed, trying shell:', e.message)
            try { await executeTool('shell_exec', { command: `start “” “${url}”` }) } catch {}
          }
          fastReply(`Opening ${fp.label} — searching for **${query}**\n\n→ ${url}`)
          return
        }
      }
    }

    // ── Music / media replay fast-path ────────────────────────────
    // "play that song", "play it", "play that" → replay last URL from history
    const MUSIC_PATTERNS = [
      /^play\s+(that|it|this|the)\s+(song|video|music|track)/i,
      /^play\s+it[!.]*$/i,
      /^play\s+that[!.]*$/i,
      /^play\s+(some|any)\s+(music|songs|lofi|beats)/i,
    ]
    if (MUSIC_PATTERNS.some(p => p.test(message))) {
      const hist: any[] = Array.isArray(req.body?.history) ? [...req.body.history].reverse() : []
      const mediaEntry  = hist.find(m =>
        typeof m.content === 'string' &&
        (m.content.includes('youtube.com') || m.content.includes('spotify.com'))
      )
      if (mediaEntry) {
        const urlMatch = (mediaEntry.content as string).match(/(https:\/\/[^\s)>"]+)/)
        if (urlMatch) {
          const url = urlMatch[1]
          try { await executeTool('open_browser', { url }) } catch {}
          fastReply(`Playing: ${url}`)
          return
        }
      }
      fastReply("What would you like me to play? Try: \"play lofi hip hop on youtube\"")
      return
    }

    // ── High-risk actions — require explicit confirmation ──────────
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
      fastReply('CommandGate: This action involves sending data externally (email/network). I need your explicit approval before proceeding. Are you sure you want to do this? Please confirm.', { blocked: true, reason: 'high_risk_action_requires_approval' }); return
    }

    // Switch to the caller’s session before any memory operations
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

        // Greetings bypass the planner even in JSON/plan mode
        const JSON_ALWAYS_CONV = [
          /^hi+\s*[!?.]*$/i, /^hey+\s*[!?.]*$/i, /^hello+\s*[!?.]*$/i,
          /^how are you/i, /^what('?s| is) up/i,
          /^good (morning|afternoon|evening|night)/i,
          /^thanks?(\s+you)?[!.]*$/i, /^thank you[!.]*$/i,
          /^ok+a?y?[!.]*$/i, /^cool[!.]*$/i, /^got it[!.]*$/i,
          /^are you (there|ready|online|working)/i,
        ]
        if (JSON_ALWAYS_CONV.some(p => p.test(resolvedMessage.trim()))) {
          await streamChat(resolvedMessage, history, userName, provider, activeModel, apiName, (data: object) => {
            const d = data as any
            if (d.token) jsonTokens.push(d.token)
          }, sessionId)
          fullReply = jsonTokens.join('').trim() || 'Hey! What do you need?'
          conversationMemory.addAssistantMessage(fullReply)
          res.json({ message: fullReply, provider: apiName }); return
        }

        if (mode === 'chat') {
          await streamChat(resolvedMessage, history, userName, provider, activeModel, apiName, (data: object) => {
            const d = data as any
            if (d.token) jsonTokens.push(d.token)
          }, sessionId)
          incrementUsage(apiName)
          fullReply = jsonTokens.join('')
          conversationMemory.addAssistantMessage(fullReply)
          res.json({ message: fullReply, provider: apiName }); return
        }

        // ReAct mode: iterative Thought—Action—Observe for complex goals
        if (mode === 'react') {
          const reactTier = getModelForTask('planner')
          const reactSteps: ReActStep[] = []
          const reactResult = await runReActLoop(
            resolvedMessage,
            reactTier.apiKey,
            reactTier.model,
            reactTier.providerName,
            (step: ReActStep) => {
              reactSteps.push(step)
              res.write('data: ' + JSON.stringify({
                activity: {
                  type:     'tool',
                  message:  `ReAct: ${step.thought.action}`,
                  rawTool:  step.thought.action,
                  rawInput: step.thought.actionInput,
                },
              }) + '\n\n')
            },
          )
          conversationMemory.addAssistantMessage(reactResult.answer)
          res.json({ message: reactResult.answer, provider: reactTier.apiName, steps: reactSteps.length })
          return
        }

        // —— Sprint 26: fast mode — skip planning, call LLM directly (used by Quick Action widget)
        if (mode === 'fast') {
          const quickReply = await callLLM(resolvedMessage, rawKey, activeModel, providerName)
          conversationMemory.addAssistantMessage(quickReply)
          res.json({ response: quickReply, message: quickReply, provider: apiName2 }); return
        }

        const memoryContext    = conversationMemory.buildContext()
        const proactiveMemory  = await surfaceRelevantMemories(resolvedMessage)
        const fullMemoryCtx    = memoryContext + proactiveMemory
        const plan: AgentPlan = await planWithLLM(resolvedMessage, history, plannerKey, plannerModel, plannerProv, fullMemoryCtx)

        if (!plan.requires_execution || plan.plan.length === 0) {
          if (plan.direct_response) {
            fullReply = plan.direct_response
          } else {
            await streamChat(resolvedMessage, history, userName, provider, activeModel, apiName, (data: object) => {
              const d = data as any
              if (d.token) jsonTokens.push(d.token)
            }, sessionId)
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

        // Sprint 30: session memory + identity refresh (non-blocking)
        setTimeout(() => {
          sessionMemory.addExchange(sessionId || 'default', resolvedMessage, fullReply, filesCreated)
          refreshIdentity()
        }, 100)

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
    const { provider, model, userName } = getSmartProvider()
    // BUG 6 fix: use tiered responder's API name for all provider labels, not manually-set active
    const apiName      = responderTierSSE.apiName
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

    // ALWAYS use streamChat for these — even in 'plan' mode.
    // Greetings and social phrases should never produce a planner "Done." response.
    const ALWAYS_CONVERSATIONAL = [
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
      /^are you (there|ready|online|working)/i,
    ]

    // Only use streamChat for these in auto/chat mode — plan mode can still plan them.
    const AUTO_CONVERSATIONAL = [
      /^what can you do/i,
      /^what are your (skills|capabilities|tools)/i,
      /^who are you/i,
      // Identity/profile queries — must go through streamChat which injects USER PROFILE
      /what('?s| is) my name/i,
      /do you know (my|who i am)/i,
      /what do you know about me/i,
      /tell me about (my|myself)/i,
      /can you learn/i,
      /do you (remember|learn|grow|improve)/i,
    ]

    const isConversational =
      ALWAYS_CONVERSATIONAL.some(p => p.test(message.trim())) ||
      (mode !== 'plan' && AUTO_CONVERSATIONAL.some(p => p.test(message.trim())))

    if (isConversational) {
      try {
        const convTokens: string[] = []
        await streamChat(message, history, userName, provider, activeModel, apiName, (data: object) => {
          const d = data as any
          if (d.token) convTokens.push(d.token)
        }, sessionId)
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
        await streamChat(resolvedMessage, history, userName, provider, activeModel, apiName, send, sessionId)
        incrementUsage(apiName)
        send({ done: true, provider: apiName })
        res.end()
        memoryLayers.write(`User: ${resolvedMessage}`, ['chat'])
        return
      }

      // â”€â”€ STEP 1: PLAN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // Sprint 26: fast mode in SSE path
      if (mode === 'fast') {
        const quickReply = await callLLM(resolvedMessage, rawKey, activeModel, providerName)
        conversationMemory.addAssistantMessage(quickReply)
        const words = quickReply.split(' ')
        for (const word of words) {
          send({ token: word + ' ', done: false, provider: apiName })
          await new Promise(r => setTimeout(r, 8))
        }
        send({ done: true, provider: apiName })
        res.end()
        return
      }

      // ── MULTI-QUESTION DETECTION (auto mode only) ────────────────────────────
      const mqQuestions = (mode !== 'plan' && shouldSplit(resolvedMessage))
        ? splitQuestions(resolvedMessage)
        : [resolvedMessage]

      if (mqQuestions.length > 1) {
        console.log(`[Multi-Q] Detected ${mqQuestions.length} questions: ${mqQuestions.map(q => q.substring(0, 40)).join(' | ')}`)
        const mqAllToolsUsed: string[] = []
        const mqAllFilesCreated: string[] = []
        const mqAllSearchQueries: string[] = []
        let   mqFullReply = ''
        const mqMemCtx = conversationMemory.buildContext() + await surfaceRelevantMemories(resolvedMessage)

        for (let mqI = 0; mqI < mqQuestions.length; mqI++) {
          const mqQ = mqQuestions[mqI]
          console.log(`[Multi-Q] Processing ${mqI + 1}/${mqQuestions.length}: ${mqQ.substring(0, 50)}`)
          send({ thinking: { stage: 'multi', message: `Handling question ${mqI + 1} of ${mqQuestions.length}...` } })
          send({ activity: { icon: '❓', agent: 'Aiden', message: `Q${mqI + 1}: ${mqQ.slice(0, 60)}`, style: 'act' }, done: false })

          // Separator between answers
          if (mqI > 0) {
            const sep = '\n\n---\n\n'
            mqFullReply += sep
            send({ token: sep, done: false, provider: apiName })
          }

          const mqPlan = await planWithLLM(mqQ, history, plannerKeySSE, plannerModelSSE, plannerProvSSE, mqMemCtx)

          if (mqPlan.requires_execution && mqPlan.plan.length > 0) {
            send({ thinking: { stage: 'executing', message: `Running tools for Q${mqI + 1}...` } })
            const mqResults: StepResult[] = await executePlan(
              mqPlan,
              (step: ToolStep, result: StepResult) => {
                send({ activity: { icon: '🔧', agent: 'Aiden', message: humanToolMessage(step.tool, step.input as Record<string, any>), style: 'tool', rawTool: step.tool, rawInput: step.input }, done: false })
                send({ activity: { icon: result.success ? '✅' : '❌', agent: 'Aiden', message: (result.success ? result.output : result.error || 'failed').slice(0, 160), style: result.success ? 'done' : 'error' }, done: false })
              },
              undefined,
            )
            send({ thinking: { stage: 'reasoning', message: `Writing answer ${mqI + 1}...` } })
            await respondWithResults(mqQ, mqPlan, mqResults, history, userName, rawKey, activeModel, providerName, (token) => {
              mqFullReply += token
              send({ token, done: false, provider: apiName })
            })
            mqAllToolsUsed.push(...mqResults.map(r => r.tool))
            mqAllFilesCreated.push(...mqResults.filter(r => r.tool === 'file_write' && r.success && r.input?.path).map(r => r.input.path as string))
            mqAllSearchQueries.push(...mqResults.filter(r => (r.tool === 'web_search' || r.tool === 'deep_research') && r.input?.query).map(r => r.input.query as string))
          } else {
            const mqDirect = mqPlan.direct_response || mqQ
            mqFullReply += mqDirect
            for (const w of mqDirect.split(' ')) {
              send({ token: w + ' ', done: false, provider: apiName })
              await new Promise(r => setTimeout(r, 8))
            }
          }
        }

        conversationMemory.updateFromExecution(mqAllToolsUsed, mqAllFilesCreated, mqAllSearchQueries)
        conversationMemory.addAssistantMessage(mqFullReply, { toolsUsed: mqAllToolsUsed, filesCreated: mqAllFilesCreated, searchQueries: mqAllSearchQueries })
        userCognitionProfile.observe(resolvedMessage, mqFullReply)
        setTimeout(() => {
          sessionMemory.addExchange(sessionId || 'default', resolvedMessage, mqFullReply, mqAllFilesCreated)
          memoryExtractor.extractFromSession(sessionId || 'default').catch(() => {})
          refreshIdentity()
        }, 100)
        incrementUsage(apiName)
        send({ done: true, provider: apiName })
        res.end()
        memoryLayers.write(`User: ${resolvedMessage}`, ['chat'])
        return  // skip single-question flow
      }


      send({ activity: { icon: 'ðŸ§ ', agent: 'Aiden', message: 'Working out a plan...', style: 'thinking' }, done: false })
      send({ thinking: { stage: 'memory', message: 'Checking memory...' } })

      const memoryContext    = conversationMemory.buildContext()
      const proactiveMemory  = await surfaceRelevantMemories(resolvedMessage)
      const fullMemoryCtx    = memoryContext + proactiveMemory
      send({ thinking: { stage: 'planning', message: 'Planning approach...' } })
      const plan: AgentPlan = await planWithLLM(resolvedMessage, history, plannerKeySSE, plannerModelSSE, plannerProvSSE, fullMemoryCtx)

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
          await streamChat(resolvedMessage, history, userName, provider, activeModel, apiName, send, sessionId)
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
          send({ thinking: { stage: 'executing', message: `Running ${step.tool}...`, tool: step.tool } })
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

      send({ thinking: { stage: 'reasoning', message: 'Thinking...' } })
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

      // Sprint 30: session memory + identity refresh (non-blocking)
      setTimeout(() => {
        sessionMemory.addExchange(sessionId || 'default', resolvedMessage, fullReply, filesCreated)
        memoryExtractor.extractFromSession(sessionId || 'default').catch(() => {})
        refreshIdentity()
      }, 100)

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
        send({ token: `\nSomething went wrong internally. Please restart Aiden.`, done: false })
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

    // Write USER.md so the system prompt knows who this person is
    try {
      const name = userName || config.user?.name || 'User'
      const { timezone, utcOffset } = detectTimezone()
      const tzLine = `${timezone} (${utcOffset})`
      const userMdPath = path.join(WORKSPACE_ROOT, 'workspace', 'USER.md')
      fs.mkdirSync(path.dirname(userMdPath), { recursive: true })
      const existing = fs.existsSync(userMdPath) ? fs.readFileSync(userMdPath, 'utf8') : ''
      if (!existing.trim() || existing.startsWith('# User Profile\nName: User')) {
        fs.writeFileSync(userMdPath, `# User Profile\nName: ${name}\nTimezone: ${tzLine}\n`, 'utf8')
      } else {
        // Update Name and upsert Timezone line
        let updated = existing.replace(/^Name:.*$/m, `Name: ${name}`)
        if (/^Timezone:/m.test(updated)) {
          updated = updated.replace(/^Timezone:.*$/m, `Timezone: ${tzLine}`)
        } else {
          updated = updated.replace(/^(Name:.*)$/m, `$1\nTimezone: ${tzLine}`)
        }
        fs.writeFileSync(userMdPath, updated, 'utf8')
      }
    } catch (e: any) { console.warn('[Onboarding] USER.md write failed:', e.message) }

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

    // Write USER.md so the system prompt knows who this person is
    if (userName) {
      try {
        const { timezone, utcOffset } = detectTimezone()
        const tzLine = `${timezone} (${utcOffset})`
        const userMdPath = path.join(WORKSPACE_ROOT, 'workspace', 'USER.md')
        fs.mkdirSync(path.dirname(userMdPath), { recursive: true })
        const existing = fs.existsSync(userMdPath) ? fs.readFileSync(userMdPath, 'utf8') : ''
        if (!existing.trim() || existing.startsWith('# User Profile\nName: User')) {
          fs.writeFileSync(userMdPath, `# User Profile\nName: ${userName}\nTimezone: ${tzLine}\n`, 'utf8')
        } else {
          let updated = existing.replace(/^Name:.*$/m, `Name: ${userName}`)
          if (/^Timezone:/m.test(updated)) {
            updated = updated.replace(/^Timezone:.*$/m, `Timezone: ${tzLine}`)
          } else {
            updated = updated.replace(/^(Name:.*)$/m, `$1\nTimezone: ${tzLine}`)
          }
          fs.writeFileSync(userMdPath, updated, 'utf8')
        }
      } catch (e: any) { console.warn('[Onboarding/complete] USER.md write failed:', e.message) }
    }

    res.json({ success: true })
  })

  // GET /api/user-profile — read workspace/USER.md
  app.get('/api/user-profile', (_req: Request, res: Response) => {
    const userMdPath = path.join(WORKSPACE_ROOT, 'workspace', 'USER.md')
    if (!fs.existsSync(userMdPath)) {
      res.json({ exists: false, content: '' })
      return
    }
    res.json({ exists: true, content: fs.readFileSync(userMdPath, 'utf8') })
  })

  // PUT /api/user-profile — write workspace/USER.md (full content replace)
  app.put('/api/user-profile', (req: Request, res: Response) => {
    const { content } = req.body as { content?: string }
    if (typeof content !== 'string') { res.status(400).json({ error: 'content required' }); return }
    try {
      const userMdPath = path.join(WORKSPACE_ROOT, 'workspace', 'USER.md')
      fs.mkdirSync(path.dirname(userMdPath), { recursive: true })
      fs.writeFileSync(userMdPath, content, 'utf8')
      // Mirror name to config.user.name for the system prompt fallback
      const nameMatch = content.match(/^Name:\s*(.+)$/m)
      if (nameMatch?.[1]?.trim()) {
        const cfg = loadConfig()
        cfg.user.name = nameMatch[1].trim()
        saveConfig(cfg)
      }
      res.json({ success: true })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
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

      // Sprint 19: free tier limit -- 3 KB files max
      if (!isPro()) {
        const stats = knowledgeBase.getStats()
        if (stats.files >= 3) {
          res.status(403).json({
            error:   'Free tier limit reached',
            message: 'Free tier allows 3 knowledge base files. Upgrade to Pro for unlimited.',
            upgrade: true,
          })
          return
        }
      }

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

      // Sprint 19: free tier limit — 3 KB files max
      if (!isPro()) {
        const statsAsync = knowledgeBase.getStats()
        if (statsAsync.files >= 3) {
          try { fs.unlinkSync(file.path) } catch {}
          res.status(403).json({
            error:   'Free tier limit reached',
            message: 'Free tier allows 3 knowledge base files. Upgrade to Pro for unlimited.',
            upgrade: true,
          })
          return
        }
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

  // GET /api/sessions — list recent chat sessions with rich metadata
  app.get('/api/sessions', (_req: Request, res: Response) => {
    try {
      res.json(conversationMemory.getSessionsSummary())
    } catch (err: any) { res.status(500).json({ error: err.message }) }
  })

  // GET /api/telegram/config — load Telegram bot config
  app.get('/api/telegram/config', (_req: Request, res: Response) => {
    try {
      const cfg = loadConfig() as any
      const tg  = cfg.telegram || { enabled: false, botToken: '', allowedChatIds: [], pollingInterval: 1000 }
      // Never expose the full token — return masked version to the UI
      res.json({ ...tg, botToken: tg.botToken ? tg.botToken.replace(/.(?=.{4})/g, '*') : '' })
    } catch (e: any) { res.status(500).json({ error: e.message }) }
  })

  // POST /api/telegram/config — save Telegram bot config
  app.post('/api/telegram/config', (req: Request, res: Response) => {
    try {
      const cfg = loadConfig() as any
      const prev: TelegramConfig = cfg.telegram || { enabled: false, botToken: '', allowedChatIds: [], pollingInterval: 1000 }
      // If the incoming token is all-masked (UI hasn't changed it), keep the stored one
      const incomingToken = String(req.body.botToken || '')
      const isMasked      = incomingToken.length > 0 && /^\*+.{0,4}$/.test(incomingToken)
      const newTg: TelegramConfig = {
        enabled:         !!req.body.enabled,
        botToken:        isMasked ? prev.botToken : incomingToken,
        allowedChatIds:  Array.isArray(req.body.allowedChatIds)
          ? (req.body.allowedChatIds as string[]).map(String).filter(Boolean)
          : String(req.body.allowedChatIds || '').split(',').map((s: string) => s.trim()).filter(Boolean),
        pollingInterval: Number(req.body.pollingInterval) || 1000,
      }
      cfg.telegram = newTg
      saveConfig(cfg)

      // Restart bot if running, or start if newly enabled
      if (activeTelegramBot) { activeTelegramBot.stop(); activeTelegramBot = null }
      // Note: full restart handled on next server restart — live reload intentionally omitted
      // to avoid async complexity inside a sync express handler

      res.json({ ok: true })
    } catch (e: any) { res.status(500).json({ error: e.message }) }
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

  // POST /api/knowledge/youtube — extract transcript and ingest into Knowledge Base
  app.post('/api/knowledge/youtube', async (req: Request, res: Response) => {
    const { url } = req.body as { url?: string }
    if (!url) { res.status(400).json({ error: 'URL required' }); return }

    const result = await extractYouTubeTranscript(url)
    if (!result) {
      res.status(400).json({
        error: 'Could not extract transcript. The video may not have captions, ' +
               'or YouTube blocked the request. Install yt-dlp for a fallback, ' +
               'or paste the transcript text directly into the chat.',
      })
      return
    }

    const ingestResult = knowledgeBase.ingestText(
      result.fullText,
      `youtube_${result.title.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60)}.txt`,
      'transcript',
      ['youtube', 'video', 'transcript'],
      'public',
    )

    if (!ingestResult.success) {
      res.status(500).json({ error: ingestResult.error || 'Knowledge Base ingestion failed' })
      return
    }

    res.json({
      success:    true,
      title:      result.title,
      segments:   result.transcript.length,
      characters: result.fullText.length,
      chunks:     ingestResult.chunkCount,
    })
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
        WORKSPACE_ROOT, 'workspace', 'skills', 'learned', String(req.params.name),
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
    const config  = loadConfig()
    const tiered  = getModelForTask('responder')
    // QUICK FIX: return the actual tiered model being used, not the manually-set active model
    const activeModel    = tiered.model || config.model.activeModel
    const activeProvider = tiered.apiName || config.model.active
    res.json({
      userName:            config.user.name,
      activeModel,
      activeProvider,
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

  // GET /api/cognition/suggestions — proactive automation patterns
  app.get('/api/cognition/suggestions', (_req: Request, res: Response) => {
    try {
      const patterns = userCognitionProfile.detectRepetitivePatterns()
      res.json({ patterns })
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? 'pattern detection failed' })
    }
  })

  // GET  /api/mcp/servers -- list registered MCP servers
  app.get('/api/mcp/servers', (_req: Request, res: Response) => {
    res.json(mcpClient.listServers())
  })

  // POST /api/mcp/servers -- register a new MCP server and discover its tools
  app.post('/api/mcp/servers', async (req: Request, res: Response) => {
    const { name, url, description } = req.body as { name?: string; url?: string; description?: string }
    if (!name || !url) {
      res.status(400).json({ error: 'name and url are required' })
      return
    }
    const server = mcpClient.addServer(name, url, description ?? '')
    const tools  = await mcpClient.discoverTools(name)
    res.json({ server, tools })
  })

  // DELETE /api/mcp/servers/:name -- remove an MCP server
  app.delete('/api/mcp/servers/:name', (req: Request, res: Response) => {
    mcpClient.removeServer(String(req.params.name))
    res.json({ success: true })
  })

  // GET  /api/mcp/tools -- list all cached MCP tools across all servers
  app.get('/api/mcp/tools', (_req: Request, res: Response) => {
    res.json(mcpClient.getAllCachedTools())
  })

  // GET  /api/cache/stats -- response cache statistics
  app.get('/api/cache/stats', (_req: Request, res: Response) => {
    res.json(responseCache.getStats())
  })

  // POST /api/cache/clear -- flush all cached tool results
  app.post('/api/cache/clear', (_req: Request, res: Response) => {
    responseCache.clear()
    res.json({ success: true, message: 'Cache cleared' })
  })

  // POST /api/register -- Sprint 20: email registration for early access
  app.post('/api/register', async (req: Request, res: Response) => {
    const { email } = req.body as { email?: string }
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Valid email required' })
      return
    }
    const { registerEmail } = await import('../core/licenseManager')
    const result = await registerEmail(email)
    if (result.success) {
      // Persist email into config so verifyInstall can use it on next boot
      const cfg = loadConfig()
      ;(cfg.user as any).email = email
      saveConfig(cfg)
    }
    res.json(result)
  })

  // GET  /api/scheduler/tasks — list all scheduled tasks
  app.get('/api/scheduler/tasks', (_req: Request, res: Response) => {
    res.json(scheduler.list())
  })

  // POST /api/scheduler/tasks — create a new scheduled task
  app.post('/api/scheduler/tasks', (req: Request, res: Response) => {
    const { description, schedule, goal } = req.body as {
      description?: string; schedule?: string; goal?: string
    }
    if (!description || !schedule || !goal) {
      res.status(400).json({ error: 'description, schedule, and goal are required' })
      return
    }
    // Sprint 19: free tier limit -- 1 scheduled task max
    if (!isPro()) {
      const tasks = scheduler.list()
      if (tasks.length >= 1) {
        res.status(403).json({
          error:   'Free tier limit reached',
          message: 'Free tier allows 1 scheduled task. Upgrade to Pro for unlimited.',
          upgrade: true,
        })
        return
      }
    }
    const task = scheduler.add(description, schedule, goal)
    res.json(task)
  })

  // DELETE /api/scheduler/tasks/:id — remove a scheduled task
  app.delete('/api/scheduler/tasks/:id', (req: Request, res: Response) => {
    const taskId   = String(req.params.id)
    const removed = scheduler.remove(taskId)
    if (removed) {
      res.json({ success: true })
    } else {
      res.status(404).json({ error: `Task ${taskId} not found` })
    }
  })

  // PATCH /api/scheduler/tasks/:id — enable/disable a task
  app.patch('/api/scheduler/tasks/:id', (req: Request, res: Response) => {
    const { enabled } = req.body as { enabled?: boolean }
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'enabled (boolean) is required' })
      return
    }
    const toggleId = String(req.params.id)
    const ok = scheduler.toggle(toggleId, enabled)
    if (ok) {
      res.json({ success: true })
    } else {
      res.status(404).json({ error: `Task ${toggleId} not found` })
    }
  })

  // GET  /api/briefing/config — load morning briefing config
  app.get('/api/briefing/config', (_req: Request, res: Response) => {
    res.json(loadBriefingConfig())
  })

  // POST /api/briefing/config — save morning briefing config
  app.post('/api/briefing/config', (req: Request, res: Response) => {
    const config = req.body as ReturnType<typeof loadBriefingConfig>
    saveBriefingConfig(config)
    scheduler.registerMorningBriefing()
    res.json({ success: true })
  })

  // GET  /api/patterns — detected usage patterns from session history
  app.get('/api/patterns', async (_req: Request, res: Response) => {
    try {
      const { detectPatterns } = await import('../core/patternDetector')
      const patterns = await detectPatterns()
      res.json({ patterns, count: patterns.length })
    } catch (e: any) {
      res.json({ patterns: [], error: e.message })
    }
  })

  // GET  /api/queue — list pending and recent tasks
  app.get('/api/queue', (_req: Request, res: Response) => {
    res.json({
      pending: taskQueue.getPending(),
      recent:  taskQueue.getRecent(20),
    })
  })

  // POST /api/queue — enqueue a new task for async execution
  app.post('/api/queue', (req: Request, res: Response) => {
    const { message, priority, source } = req.body as {
      message?: string; priority?: string; source?: string
    }
    if (!message) return res.status(400).json({ error: 'message required' }) as any
    const id = taskQueue.enqueue({
      source:   (source as any) || 'api',
      message,
      priority: (priority as any) || 'normal',
    })
    res.json({ taskId: id, status: 'queued' })
  })

  // GET  /api/queue/:id — check status of a specific queued task
  app.get('/api/queue/:id', (req: Request, res: Response) => {
    const task = taskQueue.getStatus(String(req.params.id))
    if (!task) return res.status(404).json({ error: 'Task not found' }) as any
    res.json(task)
  })

  // POST /api/clip — store a clipped text snippet in semantic memory + disk
  app.post('/api/clip', async (req: Request, res: Response) => {
    try {
      const { content, source, title, tags } = req.body as {
        content?: string; source?: string; title?: string; tags?: string[]
      }

      if (!content || content.trim().length < 10) {
        return res.status(400).json({ error: 'content required (min 10 chars)' }) as any
      }

      const id        = `clip_${Date.now()}`
      const trimmed   = content.trim()
      const entryTitle = title || trimmed.slice(0, 60)
      const entrySource = source || 'manual'
      const entryTags   = tags || []
      const clippedAt   = new Date().toISOString()

      // Store in semantic memory
      semanticMemory.add(trimmed, 'fact', entryTags)

      // Write to workspace/knowledge/clips/
      const clipsDir = path.join(WORKSPACE_ROOT, 'workspace', 'knowledge', 'clips')
      fs.mkdirSync(clipsDir, { recursive: true })
      fs.writeFileSync(
        path.join(clipsDir, `${id}.md`),
        `# ${entryTitle}\n\n` +
        `Source: ${entrySource}\n` +
        `Clipped: ${clippedAt}\n` +
        (entryTags.length ? `Tags: ${entryTags.join(', ')}\n` : '') +
        `\n---\n\n${trimmed}`,
      )

      console.log(`[Clip] Saved: "${entryTitle.slice(0, 50)}" from ${entrySource}`)
      res.json({ success: true, id, title: entryTitle })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // GET /api/clips — list recent clips + bookmarklet
  app.get('/api/clips', async (_req: Request, res: Response) => {
    try {
      const clipsDir = path.join(WORKSPACE_ROOT, 'workspace', 'knowledge', 'clips')
      if (!fs.existsSync(clipsDir)) {
        return res.json({ clips: [], count: 0, bookmarklet: BOOKMARKLET }) as any
      }

      const files = fs.readdirSync(clipsDir)
        .filter(f => f.endsWith('.md'))
        .sort()
        .reverse()
        .slice(0, 20)

      const clips = await Promise.all(files.map(async f => {
        const raw   = await fs.promises.readFile(path.join(clipsDir, f), 'utf8')
        const lines = raw.split('\n')
        return {
          id:      f.replace('.md', ''),
          title:   lines[0].replace('# ', ''),
          preview: lines.slice(5, 7).join(' ').slice(0, 100),
        }
      }))

      res.json({ clips, count: clips.length, bookmarklet: BOOKMARKLET })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // POST /api/briefing — receive briefing content, broadcast to WebSocket clients
  app.post('/api/briefing', (req: Request, res: Response) => {
    const { content, label } = req.body as { content?: string; label?: string }
    if (content) {
      const payload = JSON.stringify({ type: 'briefing', content, label, timestamp: Date.now() })
      wsBroadcastClients.forEach((ws: any) => {
        try { if (ws.readyState === ws.OPEN) ws.send(payload) } catch {}
      })
    }
    res.json({ success: true })
  })

  // POST /api/briefing/run — trigger morning briefing manually
  app.post('/api/briefing/run', async (_req: Request, res: Response) => {
    try {
      const config = loadBriefingConfig()
      await deliverBriefing(config)
      res.json({ success: true, message: 'Briefing delivered' })
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message })
    }
  })

  // GET /api/growth — Sprint 27: GrowthEngine + UserCognition stats for dashboard card
  app.get('/api/growth', (_req: Request, res: Response) => {
    try {
      const entries  = auditTrail.getToday()
      const allTime  = (() => {
        const p = require('path').join(WORKSPACE_ROOT, 'workspace', 'audit', 'audit.jsonl')
        if (!require('fs').existsSync(p)) return []
        return require('fs').readFileSync(p, 'utf-8').trim().split('\n').filter(Boolean).map((l: string) => {
          try { return JSON.parse(l) } catch { return null }
        }).filter(Boolean)
      })()

      const totalActions = allTime.length
      const successRate  = allTime.length > 0
        ? Math.round((allTime.filter((e: any) => e.success).length / allTime.length) * 100)
        : 0

      const profile = userCognitionProfile.getProfile?.()

      const skillsDir   = require('path').join(process.cwd(), 'skills')
      const approvedDir = require('path').join(skillsDir, 'approved')
      const skillCount  = require('fs').existsSync(skillsDir)
        ? require('fs').readdirSync(skillsDir).filter((f: string) => f.endsWith('.md')).length : 0
      const approvedCount = require('fs').existsSync(approvedDir)
        ? require('fs').readdirSync(approvedDir).filter((f: string) => f.endsWith('.md')).length : 0

      res.json({
        totalActions,
        successRate,
        skillsLearned:  skillCount,
        skillsApproved: approvedCount,
        todayActions:   entries.length,
        todaySuccess:   entries.filter((e: any) => e.success).length,
        profile: {
          verbosity:     profile?.verbosity     || 'balanced',
          technicalLevel: profile?.technicalLevel || 'medium',
          decisionStyle: profile?.decisionStyle  || 'analytical',
        },
        patterns: userCognitionProfile.detectRepetitivePatterns?.()?.slice(0, 2) ?? [],
      })
    } catch (e: any) {
      res.json({ error: e.message })
    }
  })

  // GET /api/mcp/info — MCP server discovery
  app.get('/api/mcp/info', (_req: Request, res: Response) => {
    res.json({
      mcpServer:     'http://localhost:3001',
      tools:         Object.keys(TOOL_DESCRIPTIONS).length,
      message:       'Add this to your Claude Desktop or MCP client config to connect to Aiden',
      configExample: {
        mcpServers: {
          aiden: {
            url:         'http://localhost:3001',
            name:        'Aiden — Personal AI OS',
            description: 'Connect to your local Aiden instance for file access, web search, computer control, and persistent memory',
          },
        },
      },
    })
  })

  // POST /api/react — standalone ReAct agent endpoint (SSE streaming)
  app.post('/api/react', async (req: Request, res: Response) => {
    const { goal } = req.body as { goal?: string }
    if (!goal || !goal.trim()) {
      res.status(400).json({ error: 'goal is required' }); return
    }
    res.setHeader('Content-Type',  'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection',    'keep-alive')
    res.flushHeaders()

    try {
      const tier   = getModelForTask('planner')
      const steps: ReActStep[] = []

      const result = await runReActLoop(
        goal.trim(),
        tier.apiKey,
        tier.model,
        tier.providerName,
        (step: ReActStep) => {
          steps.push(step)
          res.write('data: ' + JSON.stringify({
            type:        'step',
            action:      step.thought.action,
            reasoning:   step.thought.reasoning,
            observation: step.observation.result.slice(0, 500),
            success:     step.observation.success,
          }) + '\n\n')
        },
      )

      res.write('data: ' + JSON.stringify({
        type:   'done',
        answer: result.answer,
        steps:  steps.length,
      }) + '\n\n')
      res.end()
    } catch (err: any) {
      res.write('data: ' + JSON.stringify({ type: 'error', message: err?.message ?? 'ReAct failed' }) + '\n\n')
      res.end()
    }
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

  // GET /api/ollama/models — discover local models with role assignments
  app.get('/api/ollama/models', async (_req: Request, res: Response) => {
    try {
      const discovered = await discoverLocalModels()
      if (discovered.all.length === 0) {
        res.json({ available: false, models: [] }); return
      }
      res.json({
        available: true,
        models: discovered.all.map(name => ({
          name,
          role: name === discovered.planner  ? 'planner'   :
                name === discovered.coder    ? 'coder'     :
                name === discovered.fast     ? 'fast'      : 'responder',
        })),
        assigned: {
          planner:   discovered.planner,
          responder: discovered.responder,
          coder:     discovered.coder,
          fast:      discovered.fast,
        },
      })
    } catch (e: any) {
      res.json({ available: false, models: [], error: e.message })
    }
  })

  // POST /api/ollama/config — save user's manual model overrides
  app.post('/api/ollama/config', (req: Request, res: Response) => {
    try {
      const { responder, coder, fast } = req.body as {
        responder?: string; coder?: string; fast?: string
      }
      const config = loadConfig()
      config.ollama = {
        ...(config.ollama || { fallbackModels: [], baseUrl: 'http://localhost:11434' }),
        model:      responder || config.ollama?.model || 'gemma4:e4b',
        coderModel: coder     || config.ollama?.coderModel,
        fastModel:  fast      || config.ollama?.fastModel,
      }
      saveConfig(config)
      res.json({ success: true })
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message })
    }
  })

  // GET /api/stream — SSE keep-alive + cost_update + identity_update events
  app.get('/api/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type',  'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection',    'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.flushHeaders()

    const ping = setInterval(() => {
      try { res.write('data: {“type”:”ping”}\n\n') } catch {}
    }, 30_000)

    const sendEvent = (type: string, data: object) => {
      try {
        res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`)
      } catch {}
    }

    const onCostUpdate     = (data: object) => sendEvent('cost_update',     data)
    const onIdentityUpdate = (data: object) => sendEvent('identity_update', data)
    const onWorkflowEvent  = (data: object) => sendEvent('workflow_event',  data)

    eventBus.on('cost_update',     onCostUpdate)
    eventBus.on('identity_update', onIdentityUpdate)
    eventBus.on('workflow_event',  onWorkflowEvent)

    req.on('close', () => {
      clearInterval(ping)
      eventBus.removeListener('cost_update',     onCostUpdate)
      eventBus.removeListener('identity_update', onIdentityUpdate)
      eventBus.removeListener('workflow_event',  onWorkflowEvent)
    })
  })

  // GET /api/workflow — current workflow state snapshot
  app.get('/api/workflow', (_req: Request, res: Response) => {
    const wf = getWorkflow()
    if (!wf) return res.status(204).end()
    res.json(wf)
  })

  // GET /api/identity — Aiden identity snapshot
  app.get('/api/identity', (_req: Request, res: Response) => {
    try {
      res.json(getIdentity())
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // GET /api/cost — today's cost summary
  app.get('/api/cost', (_req: Request, res: Response) => {
    try {
      res.json(costTracker.getDailySummary())
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // GET /api/export/conversation?format=md|json — download conversation history
  app.get('/api/export/conversation', (req: Request, res: Response) => {
    try {
      const format    = req.query.format === 'json' ? 'json' : 'md'
      const exchanges = conversationMemory.getRecentHistory()
      const ts        = Date.now()

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Content-Disposition', `attachment; filename="aiden-chat-${ts}.json"`)
        res.json({
          exported:     new Date().toISOString(),
          messageCount: exchanges.length * 2,
          messages:     exchanges.flatMap(ex => {
            const msgs: Array<{ role: string; content: string; timestamp: number | null; toolsUsed?: string[] }> = []
            if (ex.userMessage) msgs.push({ role: 'user',      content: ex.userMessage, timestamp: ex.timestamp })
            if (ex.aiReply)     msgs.push({ role: 'assistant', content: ex.aiReply,     timestamp: ex.timestamp, toolsUsed: ex.toolsUsed })
            return msgs
          }),
        })
        return
      }

      // Markdown format
      let md = `# Aiden Conversation\n`
      md    += `*Exported: ${new Date().toLocaleString()}*\n\n---\n\n`
      for (const ex of exchanges) {
        if (ex.userMessage) md += `## You\n${ex.userMessage}\n\n`
        if (ex.aiReply) {
          md += `## Aiden\n${ex.aiReply}\n\n`
          if (ex.toolsUsed?.length) md += `> *Tools used: ${ex.toolsUsed.join(', ')}*\n\n`
        }
      }

      res.setHeader('Content-Type', 'text/markdown')
      res.setHeader('Content-Disposition', `attachment; filename="aiden-chat-${ts}.md"`)
      res.send(md)
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // GET /api/usage — detailed usage analytics (per-day history, tool stats, provider stats)
  app.get('/api/usage', (_req: Request, res: Response) => {
    try {
      const costDir = path.join(WORKSPACE_ROOT, 'workspace', 'cost')
      const execDir = path.join(WORKSPACE_ROOT, 'workspace', 'executions')

      // ── Multi-day history (last 7 days from JSONL files) ──────
      const dailyHistory: Array<{ date: string; totalUSD: number; systemUSD: number; userUSD: number; totalTokens: number; calls: number }> = []
      const providerStats: Record<string, { calls: number; totalCost: number; inputTokens: number; outputTokens: number }> = {}

      if (fs.existsSync(costDir)) {
        const costFiles = fs.readdirSync(costDir)
          .filter(f => f.endsWith('.jsonl'))
          .sort()
          .slice(-7) // last 7 days

        for (const file of costFiles) {
          const date = file.replace('.jsonl', '')
          let totalUSD = 0, systemUSD = 0, userUSD = 0, totalTokens = 0, calls = 0
          try {
            const lines = fs.readFileSync(path.join(costDir, file), 'utf-8')
              .trim().split('\n').filter(Boolean)
            for (const line of lines) {
              try {
                const r = JSON.parse(line)
                totalUSD    += r.costUSD    || 0
                totalTokens += (r.inputTokens || 0) + (r.outputTokens || 0)
                calls++
                if (r.isSystem) systemUSD += r.costUSD || 0
                else             userUSD   += r.costUSD || 0
                // Provider aggregation (all days)
                if (r.provider) {
                  if (!providerStats[r.provider]) providerStats[r.provider] = { calls: 0, totalCost: 0, inputTokens: 0, outputTokens: 0 }
                  providerStats[r.provider].calls++
                  providerStats[r.provider].totalCost    += r.costUSD    || 0
                  providerStats[r.provider].inputTokens  += r.inputTokens  || 0
                  providerStats[r.provider].outputTokens += r.outputTokens || 0
                }
              } catch {}
            }
          } catch {}
          dailyHistory.push({ date, totalUSD, systemUSD, userUSD, totalTokens, calls })
        }
      }

      // ── Tool stats from execution files ───────────────────────
      const toolStats: Record<string, { calls: number; totalDuration: number; failures: number }> = {}
      let totalExecutions = 0

      if (fs.existsSync(execDir)) {
        const execFiles = fs.readdirSync(execDir)
          .filter(f => f.endsWith('.json'))
        totalExecutions = execFiles.length

        for (const file of execFiles.slice(-200)) { // last 200 executions
          try {
            const exec = JSON.parse(fs.readFileSync(path.join(execDir, file), 'utf-8'))
            for (const step of (exec.steps || [])) {
              if (!step.tool) continue
              if (!toolStats[step.tool]) toolStats[step.tool] = { calls: 0, totalDuration: 0, failures: 0 }
              toolStats[step.tool].calls++
              toolStats[step.tool].totalDuration += step.duration || 0
              if (step.status === 'failed' || step.state === 'failed') toolStats[step.tool].failures++
            }
          } catch {}
        }
      }

      // ── Today's live summary ───────────────────────────────────
      const today = costTracker.getDailySummary()

      res.json({
        today: {
          cost:         today.totalUSD,
          userCost:     today.userUSD,
          systemCost:   today.systemUSD,
          byProvider:   today.byProvider,
          currency:     'USD',
          budget:       costTracker.getDailyBudget(),
        },
        dailyHistory,
        toolStats: Object.entries(toolStats)
          .map(([tool, stats]) => ({ tool, ...stats }))
          .sort((a, b) => b.calls - a.calls),
        providerStats: Object.entries(providerStats)
          .map(([provider, stats]) => ({ provider, ...stats }))
          .sort((a, b) => b.calls - a.calls),
        totalExecutions,
      })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
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
      const tasksDir = path.join(WORKSPACE_ROOT, 'workspace', 'tasks')
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

  // ── Skills helpers ────────────────────────────────────────────
  const DISABLED_SKILLS_PATH = path.join(WORKSPACE_ROOT, 'workspace', 'disabled-skills.json')

  function loadDisabledSkills(): Set<string> {
    try {
      const raw = fs.readFileSync(DISABLED_SKILLS_PATH, 'utf-8')
      const arr = JSON.parse(raw) as string[]
      return new Set(arr)
    } catch { return new Set() }
  }

  function saveDisabledSkills(disabled: Set<string>): void {
    fs.mkdirSync(path.dirname(DISABLED_SKILLS_PATH), { recursive: true })
    fs.writeFileSync(DISABLED_SKILLS_PATH, JSON.stringify(Array.from(disabled), null, 2), 'utf-8')
  }

  function deriveSkillSource(filePath: string): 'built-in' | 'workspace' | 'learned' | 'approved' {
    const fp = filePath.replace(/\\/g, '/')
    if (fp.includes('workspace/skills/approved')) return 'approved'
    if (fp.includes('workspace/skills/learned'))  return 'learned'
    if (fp.includes('workspace/skills'))           return 'workspace'
    return 'built-in'
  }

  // GET /api/skills — list all available skills
  app.get('/api/skills', (_req: Request, res: Response) => {
    try {
      const disabled = loadDisabledSkills()
      const skills   = skillLoader.loadAllRaw ? skillLoader.loadAllRaw() : skillLoader.loadAll()
      res.json(skills.map(s => ({
        name:        s.name,
        description: s.description,
        version:     s.version,
        tags:        s.tags,
        filePath:    s.filePath,
        source:      deriveSkillSource(s.filePath),
        enabled:     !disabled.has(s.name),
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

  // POST /api/skills/:name/toggle — enable or disable a skill
  app.post('/api/skills/:name/toggle', (req: Request, res: Response) => {
    try {
      const name     = String(req.params.name)
      const disabled = loadDisabledSkills()
      if (disabled.has(name)) {
        disabled.delete(name)
      } else {
        disabled.add(name)
      }
      saveDisabledSkills(disabled)
      skillLoader.refresh()
      res.json({ success: true, name, enabled: !disabled.has(name) })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // DELETE /api/skills/:name — delete a learned or approved skill
  app.delete('/api/skills/:name', (req: Request, res: Response) => {
    try {
      const name   = String(req.params.name)
      const skills = skillLoader.loadAll()
      const skill  = skills.find(s => s.name === name)
      if (!skill) { res.status(404).json({ error: 'Skill not found' }); return }
      const source = deriveSkillSource(skill.filePath)
      if (source === 'built-in') { res.status(403).json({ error: 'Cannot delete built-in skills' }); return }
      const skillDir = path.dirname(skill.filePath)
      fs.rmSync(skillDir, { recursive: true, force: true })
      // also remove from disabled list if present
      const disabled = loadDisabledSkills()
      if (disabled.has(name)) { disabled.delete(name); saveDisabledSkills(disabled) }
      skillLoader.refresh()
      res.json({ success: true, name })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
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

  // DELETE /api/memory — clear all conversation memory
  app.delete('/api/memory', (_req: Request, res: Response) => {
    conversationMemory.clear()
    res.json({ success: true, message: 'Conversation memory cleared' })
  })

  // POST /api/memory/clear — alias for DELETE (for frontend compatibility)
  app.post('/api/memory/clear', (_req: Request, res: Response) => {
    try {
      conversationMemory.clear()
      res.json({ success: true, message: 'All memory cleared' })
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message })
    }
  })

  // POST /api/conversations/clear — clear all saved conversation sessions from disk
  app.post('/api/conversations/clear', (_req: Request, res: Response) => {
    try {
      const sessionsDir = path.join(WORKSPACE_ROOT, 'workspace', 'sessions')
      if (fs.existsSync(sessionsDir)) {
        const files = fs.readdirSync(sessionsDir)
        files.forEach(f => { try { fs.unlinkSync(path.join(sessionsDir, f)) } catch {} })
      }
      conversationMemory.clear()
      res.json({ success: true, message: `Cleared conversation history` })
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message })
    }
  })

  // POST /api/knowledge/clear — clear knowledge base files
  app.post('/api/knowledge/clear', (_req: Request, res: Response) => {
    try {
      const kbDir = path.join(WORKSPACE_ROOT, 'workspace', 'knowledge')
      if (fs.existsSync(kbDir)) {
        const files = fs.readdirSync(kbDir)
        files.forEach(f => { try { fs.unlinkSync(path.join(kbDir, f)) } catch {} })
      }
      res.json({ success: true, message: 'Knowledge base cleared' })
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message })
    }
  })

  // POST /api/import/chatgpt — import ChatGPT conversations.json export
  app.post('/api/import/chatgpt', async (req: Request, res: Response) => {
    const { filePath } = req.body as { filePath?: string }
    if (!filePath) { res.status(400).json({ error: 'filePath required' }); return }
    if (!fs.existsSync(filePath)) { res.status(400).json({ error: 'File not found' }); return }
    try {
      const result = await importChatGPT(filePath)
      res.json(result)
    } catch (e: any) { res.status(500).json({ error: e.message }) }
  })

  // POST /api/import/openclaw — import OpenClaw workspace directory
  app.post('/api/import/openclaw', async (req: Request, res: Response) => {
    const { directoryPath } = req.body as { directoryPath?: string }
    if (!directoryPath) { res.status(400).json({ error: 'directoryPath required' }); return }
    if (!fs.existsSync(directoryPath)) { res.status(400).json({ error: 'Directory not found' }); return }
    try {
      const result = await importOpenClaw(directoryPath)
      res.json(result)
    } catch (e: any) { res.status(500).json({ error: e.message }) }
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
      const dir = path.join(WORKSPACE_ROOT, 'workspace', 'screenshots')
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
      const logPath = require('path').join(WORKSPACE_ROOT, 'workspace', 'growth', 'failure-log.jsonl')
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
  console.log(`[Startup] Health check - ${allOk ? 'ALL OK' : 'SOME FAILED'}`)
  for (const c of checks) {
    const icon = c.ok ? '[OK]' : '[FAIL]'
    const detail = c.detail ? ` - ${c.detail}` : ''
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

  // ── Startup workspace diagnostics ─────────────────────────────
  // Seed workspace/SOUL.md from root SOUL.md if missing (dev mode)
  const _wsSoulPath  = path.join(WORKSPACE_ROOT, 'workspace', 'SOUL.md')
  const _rootSoulPath = path.join(process.cwd(), 'SOUL.md')
  if (!fs.existsSync(_wsSoulPath) && fs.existsSync(_rootSoulPath)) {
    try {
      fs.mkdirSync(path.dirname(_wsSoulPath), { recursive: true })
      fs.copyFileSync(_rootSoulPath, _wsSoulPath)
      console.log('[Startup] Seeded workspace/SOUL.md from root SOUL.md')
    } catch { /* non-fatal */ }
  }
  console.log('[Startup] WORKSPACE_ROOT:', WORKSPACE_ROOT)
  console.log('[Startup] AIDEN_USER_DATA:', process.env.AIDEN_USER_DATA || '(not set)')
  console.log('[Startup] SOUL.md exists:', fs.existsSync(_wsSoulPath))
  console.log('[Startup] USER.md exists:', fs.existsSync(path.join(WORKSPACE_ROOT, 'workspace', 'USER.md')))
  console.log('[Startup] STANDING_ORDERS exists:', fs.existsSync(path.join(WORKSPACE_ROOT, 'workspace', 'STANDING_ORDERS.md')))
  const _soulLen = fs.existsSync(_wsSoulPath) ? fs.readFileSync(_wsSoulPath, 'utf-8').length : 0
  console.log('[Startup] SOUL length:', _soulLen, 'chars')
  console.log('[Startup] Tool count:', Object.keys(TOOL_DESCRIPTIONS).length)

  // ── Startup health check ─────────────────────────────────────
  try { startupCheck() } catch (e: any) {
    console.error('[Startup] startupCheck threw:', e.message)
  }

  // â”€â”€ WebSocket server â€” LivePulse bridge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const wss = new WebSocketServer({ server })
  const wsClients = new Set<any>()

  wss.on('connection', (ws) => {
    wsClients.add(ws)
    wsBroadcastClients.add(ws)
    // Send last 20 history events to newly connected client so UI isn't blank
    const recentHistory = livePulse.getHistory().slice(-20)
    recentHistory.forEach(event => {
      try {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'pulse', event }))
        }
      } catch {}
    })
    ws.on('close', () => { wsClients.delete(ws); wsBroadcastClients.delete(ws) })
    ws.on('error', () => { wsClients.delete(ws); wsBroadcastClients.delete(ws) })
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
    const tasksDir = path.join(WORKSPACE_ROOT, 'workspace', 'tasks')
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

  // Sprint 30: refresh Aiden identity on startup
  setTimeout(() => { try { refreshIdentity() } catch {} }, 2000)

  // Run crash recovery on startup â€” non-blocking, finds 'running' tasks from prior session
  recoverTasks().catch(e => console.error('[Startup] Recovery error:', e.message))

  // Start background license refresh (12-hour interval, silent)
  startLicenseRefresh()

  // Log provider chain before listening so it's visible in startup log
  try { logProviderStatus() } catch {}

  // ── AUDIT 2: Tool Registry ────────────────────────────────────
  try {
    const toolNames = Object.keys(TOOL_DESCRIPTIONS)
    console.log(`[Audit] Tool Registry: ${toolNames.length} tools registered`)
    toolNames.forEach(n => console.log(`  - ${n}: ${TOOL_DESCRIPTIONS[n].slice(0, 70)}`))
  } catch (e: any) { console.error('[Audit] Tool audit failed:', e.message) }

  // ── AUDIT 3: Agent Registry (specialist personas) ─────────────
  const AGENT_PERSONAS: Record<string, string> = {
    engineer:     'Senior TypeScript/JavaScript engineer — writes clean code with full error handling.',
    security:     'Security auditor — analyzes for OWASP Top 10, provides specific fixes.',
    data_analyst: 'Data analyst — statistical analysis, patterns, and visualizable insights.',
    designer:     'UI/UX designer — design recommendations with color codes, typography, layout.',
    researcher:   'Research specialist — extracts entities, compares systematically.',
    debugger:     'Debugger — forms 3 hypotheses, eliminates systematically, provides fix.',
  }
  console.log(`[Audit] Agent Registry: ${Object.keys(AGENT_PERSONAS).length} specialist agents`)
  Object.entries(AGENT_PERSONAS).forEach(([name, desc]) => console.log(`  - ${name}: ${desc.slice(0, 60)}`))

  // ── AUDIT 4: Provider Chain (enhanced) ───────────────────────
  try {
    const cfg = loadConfig()
    console.log('[Audit] Provider Chain:')
    cfg.providers.apis.forEach((api, i) => {
      const envKey = api.key?.startsWith('env:') ? (process.env[api.key.replace('env:', '')] || '') : api.key
      const hasKey = (envKey || '').length > 0
      console.log(`  ${i + 1}. ${api.name} (${api.provider}/${api.model}) — enabled: ${api.enabled}, hasKey: ${hasKey}, rateLimited: ${api.rateLimited}`)
    })
    console.log(`[Audit] Ollama: model=${cfg.ollama?.model}, planner=${cfg.ollama?.plannerModel}, coder=${cfg.ollama?.coderModel}, fast=${cfg.ollama?.fastModel}`)
  } catch (e: any) { console.error('[Audit] Provider audit failed:', e.message) }

  // ── AUDIT 5: Workspace Files ──────────────────────────────────
  const WS = path.join(WORKSPACE_ROOT, 'workspace')
  const WS_FILES = ['SOUL.md', 'USER.md', 'STANDING_ORDERS.md', 'GOALS.md', 'HEARTBEAT.md', 'instincts.json', 'identity.json', 'semantic.json', 'entity_graph.json', 'learning.json']
  console.log('[Audit] Workspace:', WS)
  WS_FILES.forEach(f => {
    const p = path.join(WS, f)
    const exists = fs.existsSync(p)
    const size   = exists ? fs.statSync(p).size : 0
    console.log(`  ${exists ? '[OK]' : '[MISS]'} ${f}${exists ? ` (${(size / 1024).toFixed(1)} KB)` : ' — MISSING'}`)
  })

  // ── AUDIT 6: Memory System ────────────────────────────────────
  try {
    const semStats  = semanticMemory.getStats()
    const egStats   = entityGraph.getStats()
    const learnStats = learningMemory.getStats()
    const skillStats = skillTeacher.getStats()
    console.log('[Audit] Memory System:')
    console.log(`  Semantic memories: ${semStats.total} (types: ${JSON.stringify(semStats.byType)})`)
    console.log(`  Entity graph: ${egStats.nodes} nodes, ${egStats.edges} edges`)
    console.log(`  Learning experiences: ${learnStats.total}, success rate: ${learnStats.successRate}%, avg duration: ${learnStats.avgDuration}ms`)
    console.log(`  Skills learned: ${skillStats.learned}, approved: ${skillStats.approved}`)
  } catch (e: any) { console.error('[Audit] Memory audit failed:', e.message) }

  // ── AUDIT 7: Fast-Path Coverage ───────────────────────────────
  console.log('[Audit] Fast-paths registered in /api/chat handler:')
  console.log('  Capability patterns:      5 (list tools, what can you do, etc.)')
  console.log('  Banned topics:            8 (GST, HSN, GSTIN, etc.)')
  console.log('  Jailbreak detection:      JAILBREAK_PATTERNS array')
  console.log('  Dangerous commands:       DANGEROUS_PATTERNS array')
  console.log('  Identity (name/who):      4 patterns')
  console.log('  Builder (who made you):   4 patterns')
  console.log('  Capabilities/learning:    7 patterns')
  console.log('  Local/offline:            5 patterns')
  console.log('  Date/time:                6 patterns (what year, what time, etc.)')
  console.log('  Goal create/show:         4 patterns')
  console.log('  Context questions:        2 patterns')
  console.log('  Hardware specs:           1 pattern (regex)')
  console.log('  File-read existence:      1 pattern (path detection)')
  console.log('  Search fast-paths:        16 regex patterns (YouTube/Spotify/Google/Wikipedia/GitHub)')
  console.log('  High-risk actions:        5 patterns (email/SMTP)')
  console.log('  Math eval:                1 pattern')
  console.log('  Total fast-paths:         ~80 patterns before planner runs')

  // ── AUDIT 9: Scheduler ────────────────────────────────────────
  try {
    const tasks = scheduler.list()
    console.log(`[Audit] Scheduler: ${tasks.length} task(s) loaded`)
    tasks.forEach(t => console.log(`  - [${t.enabled ? 'ON' : 'OFF'}] ${t.id}: "${t.description.slice(0, 50)}" (${t.schedule})`))
    if (tasks.length === 0) console.log('  (no tasks scheduled yet)')
  } catch (e: any) { console.error('[Audit] Scheduler audit failed:', e.message) }

  server.listen(port, host, () => {
    // ── AUDIT 10: API Endpoints ───────────────────────────────────
    try {
      const routes: string[] = []
      app._router.stack.forEach((r: any) => {
        if (r.route) {
          const methods = Object.keys(r.route.methods).join(',').toUpperCase()
          routes.push(`${methods} ${r.route.path}`)
        }
      })
      console.log(`[Audit] API Endpoints: ${routes.length} routes registered`)
      routes.sort().forEach(r => console.log(`  ${r}`))
    } catch (e: any) { console.error('[Audit] Route audit failed:', e.message) }

    // ── AUDIT 8: Hook System (after all hooks are registered) ────
    console.log('[Audit] Hook Registry (post-registration):')
    console.log(`  pre_compact:     ${getHookCount('pre_compact')} handler(s)`)
    console.log(`  session_stop:    ${getHookCount('session_stop')} handler(s)`)
    console.log(`  after_tool_call: ${getHookCount('after_tool_call')} handler(s)`)

    console.log(`[API] DevOS v3.2.0 - Aiden running at http://${host}:${port}`)
    console.log(`[API] Health: http://${host}:${port}/api/health`)
    console.log(`[API] LivePulse WS: ws://${host}:${port}`)
  })

  // ── Telegram Bot ─────────────────────────────────────────────
  try {
    const tgCfg = (loadConfig() as any).telegram as TelegramConfig | undefined
    if (tgCfg?.enabled && tgCfg?.botToken) {
      const startupTime = Date.now()
      activeTelegramBot = new TelegramBot(tgCfg)

      activeTelegramBot.startPolling(async (chatId: string, text: string): Promise<string> => {
        // ── Bot commands ─────────────────────────────────────
        if (text === '/start') {
          return `👋 Hey! I'm Aiden, your personal AI.\n\nYour chat ID is: \`${chatId}\`\nAdd this to Aiden Settings → Channels → Telegram → Allowed Chat IDs.\n\nThen just message me anything — I can research, code, manage files, check stocks, and more.`
        }

        if (text === '/help') {
          return `🤖 Aiden Commands:\n\nJust type naturally — I understand:\n• "Check NIFTY price"\n• "Research top AI tools"\n• "Write a Python script for..."\n• "What's the weather in Mumbai?"\n• "Schedule a reminder for 5pm"\n\n/status — Check Aiden health\n/stop — Cancel current task`
        }

        if (text === '/status') {
          const uptimeSec = Math.floor((Date.now() - startupTime) / 1000)
          const uptimeStr = uptimeSec > 3600
            ? `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m`
            : `${Math.floor(uptimeSec / 60)}m ${uptimeSec % 60}s`
          const activeCfg  = loadConfig()
          const provider   = activeCfg.model?.active || 'unknown'
          const semStats   = semanticMemory.getStats()
          return `✅ Aiden is online\nMode: auto\nProvider: ${provider}\nMemory: ${semStats.total} entries\nUptime: ${uptimeStr}`
        }

        // ── Normal message — route through chat endpoint (JSON mode) ──
        const chatResp = await fetch(`http://localhost:${port}/api/chat`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body:    JSON.stringify({ message: text, sessionId: `telegram_${chatId}` }),
          signal:  AbortSignal.timeout(120_000),
        })
        if (!chatResp.ok) throw new Error(`Chat HTTP ${chatResp.status}`)
        const data = await chatResp.json() as any
        return data.response || data.message || '(no response)'
      }).catch((e: Error) => console.error('[Telegram] Polling error:', e.message))

      console.log('[Telegram] Bot connected and polling')
    } else {
      console.log('[Telegram] Bot disabled or no token configured — skipping')
    }
  } catch (e: any) {
    console.error('[Telegram] Failed to start bot:', e.message)
  }

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
  message:   string,
  history:   { role: string; content: string }[],
  userName:  string,
  _provider: any,
  model:     string,
  apiName:   string,
  send:      (data: object) => void,
  sessionId?: string,
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

  // Sprint 21: proactive memory surfacing
  let memoryContext = ''
  try {
    const recalled = await unifiedMemoryRecall(message, 5)
    memoryContext  = buildMemoryInjection(recalled)
    if (recalled.relevant.length > 0) {
      memoryContext += `\nProactive: if any memory context is directly relevant to the user's message, naturally reference it. Example: "I remember you mentioned X..." \xe2\x80\x94 but only if genuinely relevant, not forced.`
    }
  } catch {}

  // Sprint 30: inject last session context on first message
  let sessionContext = ''
  if (isFirstMessage && sessionId) {
    try {
      const lastCtx = sessionMemory.getLastContext(sessionId)
      if (lastCtx) sessionContext = `\n\nPRIOR SESSION CONTEXT:\n${lastCtx}`
    } catch {}
  }

  // Sprint 30: inject long-term memory index
  let memoryIndex = ''
  try {
    const idx = memoryExtractor.loadMemoryIndex()
    if (idx) memoryIndex = `\n\nMEMORY INDEX (topics you've learned about this user — use as background, not to recite):\n${idx}`
  } catch {}

  // [Aiden] System prompt v8 — SOUL.md + USER.md + STANDING_ORDERS injected
  // Resolve real Windows username and home directory to prevent LLM from using "Aiden" as username
  const _sysUser   = process.env.USERNAME || process.env.USER || require('os').userInfo().username || 'User'
  const _sysHome   = require('os').homedir()
  const systemContext = `\nSYSTEM CONTEXT — use these exact paths for ANY file operations:\n- Windows username: ${_sysUser} (NOT "Aiden" — Aiden is the AI name, not the Windows user)\n- Home directory: ${_sysHome}\n- Desktop: ${require('path').join(_sysHome, 'Desktop')}\n- Documents: ${require('path').join(_sysHome, 'Documents')}\n- Downloads: ${require('path').join(_sysHome, 'Downloads')}\n`
  const soulPrefix = AIDEN_SOUL ? AIDEN_SOUL + '\n\n' : ''
  const userMdPath = path.join(WORKSPACE_ROOT, 'workspace', 'USER.md')
  let userProfile = ''
  if (fs.existsSync(userMdPath)) {
    const raw = fs.readFileSync(userMdPath, 'utf8').trim()
    if (raw && raw !== '# User Profile\nName: User' && raw !== '# User Profile') {
      userProfile = '\nUSER PROFILE (read this — it describes the person you are talking to):\n' + raw + '\n'
    }
  }
  if (!userProfile) {
    // Fallback: at minimum tell Aiden the user's name from config
    const cfg = loadConfig()
    const name = cfg.user?.name || process.env.USER_NAME || userName
    if (name && name !== 'there' && name !== 'User') {
      userProfile = `\nUSER PROFILE:\nName: ${name}\n`
    }
  }
  const soPath = path.join(WORKSPACE_ROOT, 'workspace', 'STANDING_ORDERS.md')
  const standingOrders = fs.existsSync(soPath)
    ? '\n\nSTANDING ORDERS — follow always:\n' + fs.readFileSync(soPath, 'utf-8')
    : ''
  const chatPrompt = `${soulPrefix}You are Aiden — a personal AI OS built for ${userName}. You are sharp, direct, and slightly witty. You speak like a trusted co-founder. Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.
${userProfile}${systemContext}
HARD RULES — never violate:
- Never say "As an AI language model...", "I'm here to assist", "Certainly!", "Great question!", "Of course!"
- Never say "key findings from our research", "as per your request I have written", "here is a comparison of", "verdict:", "recommendation:" in a generic reply
- Never mention Pega, BlueWinston, Gaude Digital, or any third-party product by name
- Never say you can't access the internet (you have web_search) or can't create files (you have file_write)
- Never fabricate capabilities: no graphic design, video production, or music generation
- Never list 250+ skills — you have 48 real tools, 31 specialist agents, and a 6-layer memory system
- For errors: explain what failed and what to try next
- If you don't know something: say "I don't know"
- Direct and concise: 1–3 sentences for simple results; more only when output is rich

IDENTITY — you are NOT a static pre-trained model. You have active living systems:
- Skill Teacher: detects repeated successful patterns and promotes them to reusable skills automatically
- Instinct System: develops micro-behaviors that strengthen with use and fade without reinforcement
- Semantic Memory: remembers everything across sessions (500+ memories, 714-node entity graph)
- Night Mode: consolidates and organizes knowledge during idle periods
- Pattern Detector: identifies recurring usage habits and adapts
- Growth Engine: tracks failures, learns from them, improves over time
- XP & Leveling: gains experience, streaks, and levels up
When asked about capabilities or learning, be accurate. NEVER say you are just a pre-trained model that cannot learn.
${cognitionHint}${firstMessageContext}${memoryContext}${sessionContext}${memoryIndex}${standingOrders}`

  // ── AUDIT 1: System Prompt debug ─────────────────────────────
  console.log('[DEBUG] === FULL SYSTEM PROMPT ===')
  console.log('[DEBUG] Length:', chatPrompt.length, 'chars, ~', Math.round(chatPrompt.length / 4), 'tokens')
  console.log('[DEBUG] Contains SOUL:', chatPrompt.includes('SOUL') || chatPrompt.includes('Aiden'))
  console.log('[DEBUG] Contains USER:', chatPrompt.includes('Name:'))
  console.log('[DEBUG] Contains STANDING_ORDERS:', chatPrompt.includes('STANDING ORDERS'))
  console.log('[DEBUG] Contains tools:', chatPrompt.includes('file_read') || chatPrompt.includes('web_search'))
  console.log('[DEBUG] Has userProfile:', userProfile.length > 0, `(${userProfile.length} chars)`)
  console.log('[DEBUG] Has standingOrders:', standingOrders.length > 0, `(${standingOrders.length} chars)`)
  console.log('[DEBUG] Has memoryContext:', memoryContext.length > 0, `(${memoryContext.length} chars)`)
  console.log('[DEBUG] First 500 chars:', chatPrompt.slice(0, 500))
  console.log('[DEBUG] Last 500 chars:', chatPrompt.slice(-500))
  console.log('[DEBUG] === END SYSTEM PROMPT ===')

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
  const _streamStart     = Date.now()
  console.log(`[Router] streamChat → provider: ${providerType}, model: ${activeStreamModel}, msg: "${message.substring(0, 40)}"`)


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
      const ollamaMs = getOllamaTimeout(activeStreamModel) // full timeout for model cold-start
      console.log(`[Router] Ollama streaming with ${ollamaMs}ms timeout, model: ${activeStreamModel}`)
      const resp = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: activeStreamModel, messages: msgs, stream: true }),
        signal: AbortSignal.timeout(ollamaMs),
      })
      if (!resp.ok || !resp.body) {
        throw new Error(`Ollama ${resp.status}: ${resp.statusText}`)
      }
      const reader = resp.body.getReader()
      const dec    = new TextDecoder()
      let   buf    = ''
      let   ollamaTokens = 0
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
            if (token) { send({ token, done: false, provider: apiName }); ollamaTokens++ }
          } catch { /* skip malformed */ }
        }
      }
      console.log(`[Router] Ollama responded in ${Date.now() - _streamStart}ms (${ollamaTokens} tokens)`)

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
    console.warn(`[Router] ${providerType} failed (${err?.message}) — attempting fallback`)

    // If Ollama was primary (timed out/failed), fall back to best available cloud provider
    if (providerType === 'ollama') {
      const cloudTier = getModelForTask('responder')
      if (cloudTier.providerName !== 'ollama' && cloudTier.apiKey) {
        console.log(`[Router] Ollama timeout — falling back to ${cloudTier.providerName} (${cloudTier.model})`)
        try {
          const ENDPOINTS: Record<string, string> = {
            groq:       'https://api.groq.com/openai/v1/chat/completions',
            openrouter: 'https://openrouter.ai/api/v1/chat/completions',
            cerebras:   'https://api.cerebras.ai/v1/chat/completions',
            openai:     'https://api.openai.com/v1/chat/completions',
          }
          const fbEndpoint = ENDPOINTS[cloudTier.providerName] ?? ENDPOINTS['groq']
          const fbHeaders: Record<string, string> = {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${cloudTier.apiKey}`,
          }
          const fbResp = await fetch(fbEndpoint, {
            method:  'POST',
            headers: fbHeaders,
            body:    JSON.stringify({ model: cloudTier.model, messages: msgs, stream: true }),
            signal:  AbortSignal.timeout(15000),
          })
          if (fbResp.ok && fbResp.body) {
            const reader = fbResp.body.getReader()
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
                  if (token) send({ token, done: false, provider: cloudTier.apiName })
                } catch { /* skip malformed */ }
              }
            }
            streamEnded = true
            clearTimeout(timeout)
            return
          }
        } catch (fbErr: any) {
          console.error(`[Router] Cloud fallback also failed: ${fbErr?.message}`)
        }
      }
    }

    // Cloud was primary — try Ollama as last-resort fallback
    if (providerType !== 'ollama') {
      console.warn(`[Router] ${providerType} failed — falling back to Ollama`)
      try {
        const ollamaModel = cfg.model?.activeModel || 'gemma4:e4b'
        const ollamaMs    = getOllamaTimeout(ollamaModel) // full timeout — model may need to load
        const resp = await fetch('http://localhost:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: ollamaModel, messages: msgs, stream: true }),
          signal: AbortSignal.timeout(ollamaMs),
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
        console.error('[Router] Ollama fallback also failed:', ollamaErr)
      }
    }
    // Both failed — send a graceful error token
    console.error('[Router] All providers failed. Last error:', err?.message ?? 'unknown')
    send({ token: `I'm temporarily unavailable — my AI providers are at capacity. Please try again in a few minutes, or add more API keys in Settings → API Keys.`, done: false, provider: 'error' })
  }

  streamEnded = true
  clearTimeout(timeout)
}
