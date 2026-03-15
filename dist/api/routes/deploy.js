"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
// api/routes/deploy.ts — Vercel + Railway deploy endpoints
// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require('express');
const index_1 = require("../../integrations/vercel/index");
const index_2 = require("../../integrations/railway/index");
const router = express.Router();
// ── Vercel ────────────────────────────────────────────────
// GET /api/deploy/vercel/projects — list Vercel projects
router.get('/api/deploy/vercel/projects', async (_req, res) => {
    try {
        const projects = await index_1.vercel.listProjects();
        res.json(projects);
    }
    catch (err) {
        res.status(500).json({ error: err?.message ?? String(err) });
    }
});
// GET /api/deploy/vercel/deployments/:name — list deployments for project
router.get('/api/deploy/vercel/deployments/:name', async (req, res) => {
    const { name } = req.params;
    try {
        const deployments = await index_1.vercel.listDeployments(name);
        res.json(deployments);
    }
    catch (err) {
        res.status(500).json({ error: err?.message ?? String(err) });
    }
});
// POST /api/deploy/vercel/:name — trigger a Vercel deployment
router.post('/api/deploy/vercel/:name', async (req, res) => {
    const { name } = req.params;
    try {
        const result = await index_1.vercel.deploy('', name);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err?.message ?? String(err) });
    }
});
// ── Railway ───────────────────────────────────────────────
// GET /api/deploy/railway/projects — list Railway projects
router.get('/api/deploy/railway/projects', async (_req, res) => {
    try {
        const projects = await index_2.railway.listProjects();
        res.json(projects);
    }
    catch (err) {
        res.status(500).json({ error: err?.message ?? String(err) });
    }
});
// POST /api/deploy/railway/:projectId/deploy/:serviceId — trigger Railway deploy
router.post('/api/deploy/railway/:projectId/deploy/:serviceId', async (req, res) => {
    const { projectId, serviceId } = req.params;
    try {
        const result = await index_2.railway.deployService(projectId, serviceId);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err?.message ?? String(err) });
    }
});
exports.default = router;
