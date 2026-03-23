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
import express, { Express, Request, Response, NextFunction } from 'express'

// ── Real imports only ─────────────────────────────────────────
import { memoryLayers }   from '../memory/memoryLayers'
import { livePulse }      from '../coordination/livePulse'
import { runDoctor }      from '../core/doctor'
import { modelRouter }    from '../core/modelRouter'
import { registerComputerUseRoutes } from './routes/computerUse'

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

  // POST /api/chat
  app.post('/api/chat', async (req: Request, res: Response) => {
    const { message } = req.body as { message?: string }
    if (!message) return res.status(400).json({ error: 'message required' })
    memoryLayers.write(`User: ${message}`, ['chat', 'user'])
    res.json({ reply: 'Goal received. DevOS is processing.', status: 'queued' })
  })

  // POST /api/goals
  app.post('/api/goals', async (req: Request, res: Response) => {
    const { title, description } = req.body as { title?: string; description?: string }
    if (!title) return res.status(400).json({ error: 'title required' })
    memoryLayers.write(`Goal: ${title} — ${description ?? ''}`, ['goal', 'queued'])
    livePulse.act('CEO', `Goal queued: ${title}`)
    res.json({ id: `goal_${Date.now()}`, title, status: 'queued' })
  })

  // GET /api/goals
  app.get('/api/goals', (_req: Request, res: Response) => {
    res.json({ goals: [], message: 'Goal history coming soon' })
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
      host = (cfg.host as string)  || host
      port = (cfg.port as number)  || port
    }
  } catch { /* use defaults */ }

  const app = createApiServer()
  app.listen(port, host, () => {
    console.log(`[API] DevOS API running at http://${host}:${port}`)
    console.log(`[API] Health: http://${host}:${port}/api/health`)
  })
  return app
}
