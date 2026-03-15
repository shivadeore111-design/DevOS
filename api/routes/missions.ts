// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// api/routes/missions.ts — Mission orchestration REST endpoints

// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require('express') as any

import { autonomousMission } from '../../coordination/autonomousMission'
import { missionState }      from '../../coordination/missionState'
import { missionTodo }       from '../../coordination/missionTodo'
import { taskBus }           from '../../coordination/taskBus'
import { humanInTheLoop }    from '../../coordination/humanInTheLoop'

const router = express.Router()

// POST /api/missions — start a new mission
router.post('/api/missions', async (req: any, res: any) => {
  const { goal, description, options } = req.body ?? {}
  if (!goal || typeof goal !== 'string') {
    res.status(400).json({ error: 'Missing required field: goal' }); return
  }
  try {
    // Fire async — respond immediately with missionId
    const descStr = (description as string) || goal
    let missionId: string | null = null

    // Create the mission state stub before full execution so we can return the ID
    const { randomUUID } = require('crypto')
    missionId = randomUUID()

    // Start async, don't await
    autonomousMission.startMission(goal, descStr, options ?? {}).catch((err: any) => {
      console.error(`[MissionsRoute] Mission error: ${err?.message}`)
    })

    res.status(202).json({ message: 'Mission started', goal, options: options ?? {} })
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) })
  }
})

// GET /api/missions — list all missions
router.get('/api/missions', (_req: any, res: any) => {
  try {
    res.json(missionState.listMissions())
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) })
  }
})

// GET /api/missions/:id — mission detail + task queue
router.get('/api/missions/:id', (req: any, res: any) => {
  try {
    const mission = missionState.loadMission(req.params.id)
    if (!mission) { res.status(404).json({ error: `Mission not found: ${req.params.id}` }); return }
    const tasks = taskBus.getQueue(req.params.id)
    res.json({ ...mission, tasks })
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) })
  }
})

// GET /api/missions/:id/todo — raw markdown TODO
router.get('/api/missions/:id/todo', (req: any, res: any) => {
  try {
    const todo = missionTodo.readTodo(req.params.id)
    res.setHeader('Content-Type', 'text/plain')
    res.send(todo || '(no todo file yet)')
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) })
  }
})

// POST /api/missions/:id/pause
router.post('/api/missions/:id/pause', (req: any, res: any) => {
  try {
    autonomousMission.pauseMission(req.params.id)
    res.json({ id: req.params.id, status: 'paused' })
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) })
  }
})

// POST /api/missions/:id/resume
router.post('/api/missions/:id/resume', async (req: any, res: any) => {
  try {
    autonomousMission.resumeMission(req.params.id).catch(() => {})
    res.json({ id: req.params.id, status: 'resuming' })
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) })
  }
})

// POST /api/missions/:id/cancel
router.post('/api/missions/:id/cancel', (req: any, res: any) => {
  try {
    autonomousMission.cancelMission(req.params.id)
    res.json({ id: req.params.id, status: 'cancelled' })
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) })
  }
})

// POST /api/coordination/approve — approve a pending human-in-the-loop task
router.post('/api/coordination/approve', (req: any, res: any) => {
  const { taskId } = req.body ?? {}
  if (!taskId) { res.status(400).json({ error: 'Missing field: taskId' }); return }
  humanInTheLoop.approve(taskId as string)
  res.json({ taskId, approved: true })
})

// POST /api/coordination/reject — reject a pending human-in-the-loop task
router.post('/api/coordination/reject', (req: any, res: any) => {
  const { taskId, reason } = req.body ?? {}
  if (!taskId) { res.status(400).json({ error: 'Missing field: taskId' }); return }
  humanInTheLoop.reject(taskId as string, reason as string | undefined)
  res.json({ taskId, approved: false, reason: reason ?? null })
})

export default router
