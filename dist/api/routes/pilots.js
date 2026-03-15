"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
// api/routes/pilots.ts — Pilots REST endpoints
// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require("express");
const pilotRegistry_1 = require("../../devos/pilots/pilotRegistry");
const pilotExecutor_1 = require("../../devos/pilots/pilotExecutor");
const pilotScheduler_1 = require("../../devos/pilots/pilotScheduler");
const router = express.Router();
// GET /api/pilots
router.get("/api/pilots", (_req, res) => {
    const pilots = pilotRegistry_1.pilotRegistry.list().map((p) => ({
        ...p, lastRun: pilotExecutor_1.pilotExecutor.getLastRun(p.id),
    }));
    res.json(pilots);
});
// GET /api/pilots/:id
router.get("/api/pilots/:id", (req, res) => {
    const manifest = pilotRegistry_1.pilotRegistry.get(req.params.id);
    if (!manifest) {
        res.status(404).json({ error: `Pilot not found: ${req.params.id}` });
        return;
    }
    res.json({ ...manifest, lastRun: pilotExecutor_1.pilotExecutor.getLastRun(manifest.id),
        recentRuns: pilotExecutor_1.pilotExecutor.getHistory(manifest.id).slice(0, 5) });
});
// POST /api/pilots/:id/run
router.post("/api/pilots/:id/run", async (req, res) => {
    const manifest = pilotRegistry_1.pilotRegistry.get(req.params.id);
    if (!manifest) {
        res.status(404).json({ error: `Pilot not found: ${req.params.id}` });
        return;
    }
    try {
        const run = await pilotScheduler_1.pilotScheduler.runNow(req.params.id);
        res.json(run);
    }
    catch (err) {
        res.status(500).json({ error: err?.message ?? String(err) });
    }
});
// POST /api/pilots/:id/enable
router.post("/api/pilots/:id/enable", (req, res) => {
    if (!pilotRegistry_1.pilotRegistry.get(req.params.id)) {
        res.status(404).json({ error: `Pilot not found: ${req.params.id}` });
        return;
    }
    pilotRegistry_1.pilotRegistry.enable(req.params.id);
    res.json({ id: req.params.id, enabled: true });
});
// POST /api/pilots/:id/disable
router.post("/api/pilots/:id/disable", (req, res) => {
    if (!pilotRegistry_1.pilotRegistry.get(req.params.id)) {
        res.status(404).json({ error: `Pilot not found: ${req.params.id}` });
        return;
    }
    pilotRegistry_1.pilotRegistry.disable(req.params.id);
    res.json({ id: req.params.id, enabled: false });
});
// GET /api/pilots/:id/history
router.get("/api/pilots/:id/history", (req, res) => {
    if (!pilotRegistry_1.pilotRegistry.get(req.params.id)) {
        res.status(404).json({ error: `Pilot not found: ${req.params.id}` });
        return;
    }
    res.json(pilotExecutor_1.pilotExecutor.getHistory(req.params.id));
});
// PUT /api/pilots/:id
router.put("/api/pilots/:id", (req, res) => {
    const existing = pilotRegistry_1.pilotRegistry.get(req.params.id);
    if (!existing) {
        res.status(404).json({ error: `Pilot not found: ${req.params.id}` });
        return;
    }
    const allowed = [
        "name", "description", "schedule", "triggerOnStart",
        "systemPrompt", "tools", "maxIterations", "outputFormat", "outputPath", "enabled",
    ];
    const updated = { ...existing };
    for (const key of allowed) {
        if (key in req.body)
            updated[key] = req.body[key];
    }
    pilotRegistry_1.pilotRegistry.register(updated);
    res.json(updated);
});
exports.default = router;
