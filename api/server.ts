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

// ── Helpers ───────────────────────────────────────────────────

function getChatModel(): string {
  try {
    const cfg = JSON.parse(fs.readFileSync(
      path.join(process.cwd(), 'config/model-selection.json'), 'utf-8'
    ))
    return cfg.chat || 'mistral:7b'
  } catch {
    return 'mistral:7b'
  }
}

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

  // POST /api/chat — Speed / Balanced / Deep modes
  app.post('/api/chat', async (req: Request, res: Response) => {
    const { message, mode = 'balanced' } = req.body as { message?: string; mode?: string }
    if (!message) return res.status(400).json({ error: 'message required' })

    let model = getChatModel()

    const systemPrompt = `You are DevOS — a personal AI OS running 100% locally. You are calm, direct, and slightly witty. You help users build things, automate tasks, run goals, and control their computer. Keep responses concise and actionable. If asked to do something, confirm you'll do it and describe the plan briefly.`

    try {
      // ── SPEED MODE — just LLM, no research ──────────────────
      if (mode === 'speed') {
        const r = await fetch('http://localhost:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model, stream: false,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user',   content: message },
            ],
          }),
        })
        const data  = await r.json() as any
        const reply: string = data?.message?.content || 'Done.'
        memoryLayers.write(`[speed] User: ${message} | DevOS: ${reply}`, ['chat'])
        return res.json({ reply, mode: 'speed' })
      }

      // ── BALANCED MODE — LLM + optional web hint ──────────────
      if (mode === 'balanced') {
        let context = ''
        const needsWeb = /latest|current|news|today|price|weather|who is|what is/.test(message.toLowerCase())
        if (needsWeb) {
          context = '\n[Web context available — use deep mode for full research]'
        }

        const r = await fetch('http://localhost:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model, stream: false,
            messages: [
              { role: 'system', content: systemPrompt + context },
              { role: 'user',   content: message },
            ],
          }),
        })
        const data  = await r.json() as any
        const reply: string = data?.message?.content || 'Done.'
        memoryLayers.write(`[balanced] User: ${message} | DevOS: ${reply}`, ['chat'])
        return res.json({ reply, mode: 'balanced' })
      }

      // ── DEEP MODE — iterative research loop ──────────────────
      if (mode === 'deep') {
        let iterations       = 0
        let collectedContext = ''
        let confident        = false
        const MAX_ITERATIONS = 3

        while (!confident && iterations < MAX_ITERATIONS) {
          iterations++

          const planRes = await fetch('http://localhost:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model, stream: false,
              messages: [
                {
                  role: 'system',
                  content: 'You are a research planner. Given a question and collected context, decide if you have enough info or what to search for next. Respond in JSON only: { "confident": boolean, "searchQuery": string | null, "reason": string }',
                },
                {
                  role: 'user',
                  content: `Question: ${message}\nCollected so far: ${collectedContext || 'nothing yet'}\nDo you have enough info to answer comprehensively?`,
                },
              ],
            }),
          })
          const planData = await planRes.json() as any
          const planText: string = planData?.message?.content || ''

          try {
            const plan = JSON.parse(planText.replace(/```json|```/g, '').trim())
            confident = plan.confident
            if (!confident && plan.searchQuery) {
              try {
                const webRes = await fetch(`https://r.jina.ai/${encodeURIComponent(plan.searchQuery)}`, {
                  headers: { 'Accept': 'text/plain' },
                })
                const text = await webRes.text()
                collectedContext += `\n\n[Research ${iterations}]: ${text.slice(0, 800)}`
              } catch {
                collectedContext += `\n[Could not fetch: ${plan.searchQuery}]`
                confident = true
              }
            }
          } catch {
            confident = true
          }
        }

        const finalRes = await fetch('http://localhost:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model, stream: false,
            messages: [
              {
                role: 'system',
                content: systemPrompt + '\n\nYou have done deep research. Provide a comprehensive, well-structured answer with your findings.',
              },
              {
                role: 'user',
                content: `Question: ${message}\n\nResearch collected:\n${collectedContext}`,
              },
            ],
          }),
        })
        const finalData = await finalRes.json() as any
        const reply: string = finalData?.message?.content || 'Research complete.'
        memoryLayers.write(`[deep] User: ${message} | DevOS: ${reply}`, ['chat'])
        return res.json({ reply, mode: 'deep', iterations })
      }

    } catch {
      return res.json({
        reply: "I can't reach Ollama. Make sure it's running: ollama serve\nThen pull a model: ollama pull mistral:7b",
      })
    }

    // Fallback if unknown mode
    return res.status(400).json({ error: `Unknown mode: ${mode}` })
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
