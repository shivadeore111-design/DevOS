"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
// api/routes/goals_v2.ts — Goal Engine REST endpoints (v2)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require('express');
const goalEngine_1 = require("../../goals/goalEngine");
const goalPlanner_1 = require("../../goals/goalPlanner");
const goalExecutor_1 = require("../../goals/goalExecutor");
const router = express.Router();
// POST /api/goals/v2 — create + plan + execute
router.post('/api/goals/v2', async (req, res) => {
    const { title, description } = req.body ?? {};
    if (!title || typeof title !== 'string') {
        res.status(400).json({ error: 'Missing required field: title' });
        return;
    }
    if (!description || typeof description !== 'string') {
        res.status(400).json({ error: 'Missing required field: description' });
        return;
    }
    try {
        const goal = await goalEngine_1.goalEngine.run(title, description);
        res.json({ goalId: goal.id, status: goal.status, title: goal.title });
    }
    catch (err) {
        res.status(500).json({ error: err?.message ?? String(err) });
    }
});
// GET /api/goals/v2 — list all goals
router.get('/api/goals/v2', async (_req, res) => {
    try {
        const goals = await goalEngine_1.goalEngine.list();
        res.json(goals.map(g => ({
            goalId: g.id,
            title: g.title,
            status: g.status,
            projectCount: g.projects.length,
            createdAt: g.createdAt,
            updatedAt: g.updatedAt,
        })));
    }
    catch (err) {
        res.status(500).json({ error: err?.message ?? String(err) });
    }
});
// GET /api/goals/v2/:id — full status: goal + projects + tasks
router.get('/api/goals/v2/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const status = await goalEngine_1.goalEngine.getStatus(id);
        if (!status.goal) {
            res.status(404).json({ error: `Goal not found: ${id}` });
            return;
        }
        res.json(status);
    }
    catch (err) {
        res.status(500).json({ error: err?.message ?? String(err) });
    }
});
// POST /api/goals/v2/:id/pause — pause execution
router.post('/api/goals/v2/:id/pause', (req, res) => {
    const { id } = req.params;
    try {
        goalExecutor_1.goalExecutor.pause(id);
        res.json({ goalId: id, status: 'paused' });
    }
    catch (err) {
        res.status(500).json({ error: err?.message ?? String(err) });
    }
});
// POST /api/goals/v2/:id/resume — resume execution
router.post('/api/goals/v2/:id/resume', async (req, res) => {
    const { id } = req.params;
    try {
        goalExecutor_1.goalExecutor.resume(id).catch(() => { }); // run async
        res.json({ goalId: id, status: 'resuming' });
    }
    catch (err) {
        res.status(500).json({ error: err?.message ?? String(err) });
    }
});
// POST /api/goals/v2/:id/replan — replan failed goal
router.post('/api/goals/v2/:id/replan', async (req, res) => {
    const { id } = req.params;
    try {
        await goalPlanner_1.goalPlanner.replan(id);
        res.json({ goalId: id, status: 'replanned' });
    }
    catch (err) {
        res.status(500).json({ error: err?.message ?? String(err) });
    }
});
exports.default = router;
