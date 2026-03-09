// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// api/routes/memory.ts — Execution memory REST endpoints

// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require("express") as any;

import { executionMemory } from "../../memory/executionMemory";

const router = express.Router();

// GET /api/memory
router.get("/api/memory", (_req: any, res: any) => {
  res.json(executionMemory.getAll());
});

// GET /api/memory/stats
router.get("/api/memory/stats", (_req: any, res: any) => {
  const all          = executionMemory.getAll();
  const totalEntries = all.length;
  const successRate  = totalEntries > 0
    ? all.reduce((sum, e) => sum + (e.successRate ?? 0), 0) / totalEntries
    : 0;
  res.json({
    totalEntries,
    successRate:  parseFloat(successRate.toFixed(3)),
    topPatterns:  executionMemory.getTopPatterns(10),
  });
});

// DELETE /api/memory/prune
router.delete("/api/memory/prune", (_req: any, res: any) => {
  const pruned = executionMemory.prune();
  res.json({ pruned });
});

// GET /api/memory/:goalType
router.get("/api/memory/:goalType", (req: any, res: any) => {
  const entries = executionMemory.getAll().filter(e => e.goalType === req.params.goalType);
  res.json(entries);
});

export default router;
