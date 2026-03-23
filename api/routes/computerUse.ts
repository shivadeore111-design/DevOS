// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// api/routes/computerUse.ts — Computer-use REST endpoints
//
//   POST /api/automate           Start a VisionLoop session
//   POST /api/automate/stop      Abort the running session
//   GET  /api/automate/log       Return the screenAgent action log

import type { Express, Request, Response } from 'express'

export function registerComputerUseRoutes(app: Express): void {

  // ── POST /api/automate ──────────────────────────────────────
  // Body: { task: string, visionModel?: 'local'|'claude'|'auto', requireApproval?: boolean }
  app.post('/api/automate', async (req: Request, res: Response) => {
    const { task, visionModel, requireApproval } = req.body as {
      task:             string
      visionModel?:     'local' | 'claude' | 'auto'
      requireApproval?: boolean
    }

    if (!task || typeof task !== 'string' || !task.trim()) {
      return res.status(400).json({ error: 'task is required' })
    }

    try {
      const { visionLoop } = await import('../../integrations/computerUse/visionLoop')

      // Run non-blocking — return accepted immediately, result via SSE
      res.json({ status: 'started', task })

      const result = await visionLoop.run(task.trim(), {
        visionModel:     (visionModel ?? 'auto') as 'local' | 'claude' | 'auto',
        requireApproval: requireApproval !== false,
      })

      console.log(
        result.success
          ? `[AutomateAPI] ✅ ${task} — done in ${result.iterations} iteration(s)`
          : `[AutomateAPI] ❌ ${task} — failed: ${result.failureReason}`,
      )
    } catch (err: any) {
      console.error(`[AutomateAPI] Error: ${err?.message}`)
    }
  })

  // ── POST /api/automate/stop ─────────────────────────────────
  app.post('/api/automate/stop', async (_req: Request, res: Response) => {
    try {
      const { visionLoop } = await import('../../integrations/computerUse/visionLoop')
      visionLoop.abort()
      res.json({ status: 'aborted' })
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? 'abort failed' })
    }
  })

  // ── GET /api/automate/log ───────────────────────────────────
  // Returns the full action log from screenAgent for the current session.
  app.get('/api/automate/log', async (_req: Request, res: Response) => {
    try {
      const { screenAgent } = await import('../../integrations/computerUse/screenAgent')
      res.json({ log: screenAgent.getLog() })
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? 'log unavailable' })
    }
  })
}
