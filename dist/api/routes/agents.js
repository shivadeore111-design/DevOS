"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
// api/routes/agents.ts — Agent Layer REST endpoints
// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require('express');
const agentRegistry_1 = require("../../agents/agentRegistry");
const agentMessenger_1 = require("../../agents/agentMessenger");
const coordinationLoop_1 = require("../../agents/coordinationLoop");
const router = express.Router();
const VALID_ROLES = ['ceo', 'engineer', 'researcher', 'operator'];
// GET /api/agents — list all agents with status
router.get('/api/agents', (_req, res) => {
    try {
        const agents = agentRegistry_1.agentRegistry.list().map(a => ({
            id: a.id,
            role: a.role,
            name: a.name,
            description: a.description,
            status: a.status,
            tools: a.tools,
            budget: a.budget,
            completedTasks: a.completedTasks,
            failedTasks: a.failedTasks,
            currentTaskId: a.currentTaskId ?? null,
            lastActiveAt: a.lastActiveAt ?? null,
        }));
        res.json(agents);
    }
    catch (err) {
        res.status(500).json({ error: err?.message ?? String(err) });
    }
});
// GET /api/agents/messages — recent agent messages (last 50)
router.get('/api/agents/messages', (req, res) => {
    try {
        const limit = parseInt(req.query.limit ?? '50', 10);
        res.json(agentMessenger_1.agentMessenger.getRecent(limit));
    }
    catch (err) {
        res.status(500).json({ error: err?.message ?? String(err) });
    }
});
// GET /api/agents/messages/:taskId — message thread for a task/goal
router.get('/api/agents/messages/:taskId', (req, res) => {
    try {
        const { taskId } = req.params;
        res.json(agentMessenger_1.agentMessenger.getThread(taskId));
    }
    catch (err) {
        res.status(500).json({ error: err?.message ?? String(err) });
    }
});
// GET /api/agents/:role — agent detail + recent messages
router.get('/api/agents/:role', (req, res) => {
    const { role } = req.params;
    if (!VALID_ROLES.includes(role)) {
        res.status(400).json({ error: `Invalid role: ${role}. Valid: ${VALID_ROLES.join(', ')}` });
        return;
    }
    try {
        const agent = agentRegistry_1.agentRegistry.get(role);
        if (!agent) {
            res.status(404).json({ error: `Agent not found: ${role}` });
            return;
        }
        const recentMessages = agentMessenger_1.agentMessenger.getRecent(50).filter(m => m.fromAgent === role || m.toAgent === role || m.toAgent === 'all').slice(-20);
        res.json({ ...agent, recentMessages });
    }
    catch (err) {
        res.status(500).json({ error: err?.message ?? String(err) });
    }
});
// POST /api/agents/coordinate — { goalId } → start coordination loop
router.post('/api/agents/coordinate', async (req, res) => {
    const { goalId } = req.body ?? {};
    if (!goalId || typeof goalId !== 'string') {
        res.status(400).json({ error: 'Missing required field: goalId' });
        return;
    }
    // Fire-and-forget — respond immediately, loop runs async
    coordinationLoop_1.coordinationLoop.start(goalId).catch((err) => {
        console.error(`[CoordinationLoop] Error for goal ${goalId}: ${err?.message}`);
    });
    res.status(202).json({ goalId, status: 'coordinating', message: 'Coordination loop started' });
});
exports.default = router;
