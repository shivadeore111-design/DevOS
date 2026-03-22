// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// api/routes/agents.ts — Agent Layer REST endpoints

// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require('express') as any

import { agentRegistry }   from '../../agents/agentRegistry'
import { agentMessenger }  from '../../agents/agentMessenger'
import { coordinationLoop } from '../../agents/coordinationLoop'
import { AgentRole }        from '../../agents/types'

const router = express.Router()

const VALID_ROLES: AgentRole[] = [
  'ceo', 'cto', 'software-engineer', 'frontend-developer', 'backend-developer',
  'devops-engineer', 'qa-engineer', 'security-engineer', 'data-scientist', 'ml-engineer',
  'product-manager', 'project-manager', 'ux-designer', 'technical-writer', 'researcher',
  'legal-advisor', 'finance-analyst', 'marketing-strategist', 'sales-agent', 'customer-support',
  'hr-manager', 'database-admin', 'api-specialist', 'cloud-architect', 'mobile-developer',
  'content-creator', 'seo-specialist', 'business-analyst', 'blockchain-developer', 'system-architect',
]

// GET /api/agents — list all agents with status
router.get('/api/agents', (_req: any, res: any) => {
  try {
    const agents = agentRegistry.list().map(a => ({
      id:             a.id,
      role:           a.role,
      name:           a.name,
      description:    a.description,
      status:         a.status,
      tools:          a.tools,
      budget:         a.budget,
      completedTasks: a.completedTasks,
      failedTasks:    a.failedTasks,
      currentTaskId:  a.currentTaskId ?? null,
      lastActiveAt:   a.lastActiveAt  ?? null,
    }))
    res.json(agents)
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) })
  }
})

// GET /api/agents/messages — recent agent messages (last 50)
router.get('/api/agents/messages', (req: any, res: any) => {
  try {
    const limit = parseInt(req.query.limit ?? '50', 10)
    res.json(agentMessenger.getRecent(limit))
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) })
  }
})

// GET /api/agents/messages/:taskId — message thread for a task/goal
router.get('/api/agents/messages/:taskId', (req: any, res: any) => {
  try {
    const { taskId } = req.params
    res.json(agentMessenger.getThread(taskId))
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) })
  }
})

// GET /api/agents/:role — agent detail + recent messages
router.get('/api/agents/:role', (req: any, res: any) => {
  const { role } = req.params
  if (!VALID_ROLES.includes(role as AgentRole)) {
    res.status(400).json({ error: `Invalid role: ${role}. Valid: ${VALID_ROLES.join(', ')}` }); return
  }
  try {
    const agent = agentRegistry.get(role as AgentRole)
    if (!agent) { res.status(404).json({ error: `Agent not found: ${role}` }); return }
    const recentMessages = agentMessenger.getRecent(50).filter(
      m => m.fromAgent === role || m.toAgent === role || m.toAgent === 'all'
    ).slice(-20)
    res.json({ ...agent, recentMessages })
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) })
  }
})

// POST /api/agents/coordinate — two modes:
//   { goalId }             → fire-and-forget start() on an existing stored goal
//   { goal, description }  → blocking run() — returns CoordinationResult when done
router.post('/api/agents/coordinate', async (req: any, res: any) => {
  const { goalId, goal, description } = req.body ?? {}

  // ── Mode 1: direct mission run ────────────────────────────────
  if (goal && typeof goal === 'string') {
    const desc = (description && typeof description === 'string') ? description : goal
    try {
      const result = await coordinationLoop.run(goal, desc)
      res.json(result)
    } catch (err: any) {
      console.error(`[CoordinationLoop] run() error: ${err?.message}`)
      res.status(500).json({ error: err?.message ?? String(err) })
    }
    return
  }

  // ── Mode 2: goal-store coordination loop (fire-and-forget) ────
  if (!goalId || typeof goalId !== 'string') {
    res.status(400).json({ error: 'Provide either { goal, description } or { goalId }' }); return
  }
  coordinationLoop.start(goalId).catch((err: any) => {
    console.error(`[CoordinationLoop] Error for goal ${goalId}: ${err?.message}`)
  })
  res.status(202).json({ goalId, status: 'coordinating', message: 'Coordination loop started' })
})

export default router
