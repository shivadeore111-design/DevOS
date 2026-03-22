// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// api/routes/memory.ts — Execution memory REST endpoints

// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require("express") as any;

import { executionMemory }  from "../../memory/executionMemory";
import { persistentMemory } from "../../memory/persistentMemory";

const router = express.Router();

// GET /api/memory
router.get("/api/memory", (_req: any, res: any) => {
  res.json(executionMemory.getAll());
});

// GET /api/memory/stats
router.get("/api/memory/stats", async (_req: any, res: any) => {
  const all          = executionMemory.getAll();
  const totalEntries = all.length;
  const successRate  = totalEntries > 0
    ? all.reduce((sum, e) => sum + (e.successRate ?? 0), 0) / totalEntries
    : 0;
  res.json({
    // Execution memory (in-process, session-only)
    totalEntries,
    successRate:       parseFloat(successRate.toFixed(3)),
    topPatterns:       executionMemory.getTopPatterns(10),
    // Persistent memory (SQLite, cross-session)
    persistent:        await persistentMemory.getStats(),
  });
});

// GET /api/memory/facts — all facts from persistent memory, optionally filtered by category
router.get("/api/memory/facts", async (req: any, res: any) => {
  const category = req.query?.category as string | undefined;
  if (category) {
    res.json(await persistentMemory.getCategory(category));
  } else {
    const categories = ['user', 'projects', 'preferences', 'learned'];
    const result: Record<string, any> = {};
    for (const cat of categories) {
      result[cat] = await persistentMemory.getCategory(cat);
    }
    res.json(result);
  }
});

// GET /api/memory/goals — recent goal history from persistent memory
router.get("/api/memory/goals", async (req: any, res: any) => {
  const limit = parseInt(req.query?.limit as string || '20', 10);
  res.json(await persistentMemory.getRecentGoals(limit));
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
