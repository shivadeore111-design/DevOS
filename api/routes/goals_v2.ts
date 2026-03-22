// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// api/routes/goals_v2.ts — Goal Engine REST endpoints (v2)

// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require('express') as any

import { goalEngine }   from '../../goals/goalEngine'
import { goalPlanner }  from '../../goals/goalPlanner'
import { goalExecutor } from '../../goals/goalExecutor'

const router = express.Router()

// POST /api/goals/v2 — create + plan + execute
router.post('/api/goals/v2', async (req: any, res: any) => {
  const { title, description } = req.body ?? {}
  if (!title || typeof title !== 'string') {
    res.status(400).json({ error: 'Missing required field: title' }); return
  }
  if (!description || typeof description !== 'string') {
    res.status(400).json({ error: 'Missing required field: description' }); return
  }
  try {
    const goal = await goalEngine.run(title, description)
    res.json({ goalId: goal.id, status: goal.status, title: goal.title })
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) })
  }
})

// GET /api/goals/v2 — list all goals
router.get('/api/goals/v2', async (_req: any, res: any) => {
  try {
    const goals = await goalEngine.list()
    res.json(goals.map(g => ({
      goalId:      g.id,
      title:       g.title,
      status:      g.status,
      projectCount: g.projects.length,
      createdAt:   g.createdAt,
      updatedAt:   g.updatedAt,
    })))
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) })
  }
})

// GET /api/goals/v2/:id — full status: goal + projects + tasks
router.get('/api/goals/v2/:id', async (req: any, res: any) => {
  const { id } = req.params
  try {
    const status = await goalEngine.getStatus(id)
    if (!status.goal) { res.status(404).json({ error: `Goal not found: ${id}` }); return }
    res.json(status)
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) })
  }
})

// POST /api/goals/v2/:id/pause — pause execution
router.post('/api/goals/v2/:id/pause', (req: any, res: any) => {
  const { id } = req.params
  try {
    goalExecutor.pause(id)
    res.json({ goalId: id, status: 'paused' })
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) })
  }
})

// POST /api/goals/v2/:id/resume — resume execution
router.post('/api/goals/v2/:id/resume', async (req: any, res: any) => {
  const { id } = req.params
  try {
    goalExecutor.resume(id).catch(() => {}) // run async
    res.json({ goalId: id, status: 'resuming' })
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) })
  }
})

// POST /api/goals/v2/:id/replan — replan failed goal
router.post('/api/goals/v2/:id/replan', async (req: any, res: any) => {
  const { id } = req.params
  try {
    await goalPlanner.replan(id)
    res.json({ goalId: id, status: 'replanned' })
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) })
  }
})

export default router
