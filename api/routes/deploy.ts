// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// api/routes/deploy.ts — Vercel + Railway deploy endpoints

// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require('express') as any

import { vercel  } from '../../integrations/vercel/index'
import { railway } from '../../integrations/railway/index'

const router = express.Router()

// ── Vercel ────────────────────────────────────────────────

// GET /api/deploy/vercel/projects — list Vercel projects
router.get('/api/deploy/vercel/projects', async (_req: any, res: any) => {
  try {
    const projects = await vercel.listProjects()
    res.json(projects)
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) })
  }
})

// GET /api/deploy/vercel/deployments/:name — list deployments for project
router.get('/api/deploy/vercel/deployments/:name', async (req: any, res: any) => {
  const { name } = req.params
  try {
    const deployments = await vercel.listDeployments(name)
    res.json(deployments)
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) })
  }
})

// POST /api/deploy/vercel/:name — trigger a Vercel deployment
router.post('/api/deploy/vercel/:name', async (req: any, res: any) => {
  const { name } = req.params
  try {
    const result = await vercel.deploy('', name)
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) })
  }
})

// ── Railway ───────────────────────────────────────────────

// GET /api/deploy/railway/projects — list Railway projects
router.get('/api/deploy/railway/projects', async (_req: any, res: any) => {
  try {
    const projects = await railway.listProjects()
    res.json(projects)
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) })
  }
})

// POST /api/deploy/railway/:projectId/deploy/:serviceId — trigger Railway deploy
router.post('/api/deploy/railway/:projectId/deploy/:serviceId', async (req: any, res: any) => {
  const { projectId, serviceId } = req.params
  try {
    const result = await railway.deployService(projectId, serviceId)
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) })
  }
})

export default router
