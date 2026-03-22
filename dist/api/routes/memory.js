"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
// api/routes/memory.ts — Execution memory REST endpoints
// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require("express");
const executionMemory_1 = require("../../memory/executionMemory");
const router = express.Router();
// GET /api/memory
router.get("/api/memory", (_req, res) => {
    res.json(executionMemory_1.executionMemory.getAll());
});
// GET /api/memory/stats
router.get("/api/memory/stats", (_req, res) => {
    const all = executionMemory_1.executionMemory.getAll();
    const totalEntries = all.length;
    const successRate = totalEntries > 0
        ? all.reduce((sum, e) => sum + (e.successRate ?? 0), 0) / totalEntries
        : 0;
    res.json({
        totalEntries,
        successRate: parseFloat(successRate.toFixed(3)),
        topPatterns: executionMemory_1.executionMemory.getTopPatterns(10),
    });
});
// DELETE /api/memory/prune
router.delete("/api/memory/prune", (_req, res) => {
    const pruned = executionMemory_1.executionMemory.prune();
    res.json({ pruned });
});
// GET /api/memory/:goalType
router.get("/api/memory/:goalType", (req, res) => {
    const entries = executionMemory_1.executionMemory.getAll().filter(e => e.goalType === req.params.goalType);
    res.json(entries);
});
exports.default = router;
