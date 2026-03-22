// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// api/routes/pilots.ts — Pilots REST endpoints

// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require("express") as any;

import { pilotRegistry }  from "../../devos/pilots/pilotRegistry";
import { pilotExecutor }  from "../../devos/pilots/pilotExecutor";
import { pilotScheduler } from "../../devos/pilots/pilotScheduler";
import { PilotManifest }  from "../../devos/pilots/types";

const router = express.Router();

// GET /api/pilots
router.get("/api/pilots", (_req: any, res: any) => {
  const pilots = pilotRegistry.list().map((p: PilotManifest) => ({
    ...p, lastRun: pilotExecutor.getLastRun(p.id),
  }));
  res.json(pilots);
});

// GET /api/pilots/:id
router.get("/api/pilots/:id", (req: any, res: any) => {
  const manifest = pilotRegistry.get(req.params.id);
  if (!manifest) { res.status(404).json({ error: `Pilot not found: ${req.params.id}` }); return; }
  res.json({ ...manifest, lastRun: pilotExecutor.getLastRun(manifest.id),
    recentRuns: pilotExecutor.getHistory(manifest.id).slice(0, 5) });
});

// POST /api/pilots/:id/run
router.post("/api/pilots/:id/run", async (req: any, res: any) => {
  const manifest = pilotRegistry.get(req.params.id);
  if (!manifest) { res.status(404).json({ error: `Pilot not found: ${req.params.id}` }); return; }
  try {
    const run = await pilotScheduler.runNow(req.params.id);
    res.json(run);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// POST /api/pilots/:id/enable
router.post("/api/pilots/:id/enable", (req: any, res: any) => {
  if (!pilotRegistry.get(req.params.id)) {
    res.status(404).json({ error: `Pilot not found: ${req.params.id}` }); return;
  }
  pilotRegistry.enable(req.params.id);
  res.json({ id: req.params.id, enabled: true });
});

// POST /api/pilots/:id/disable
router.post("/api/pilots/:id/disable", (req: any, res: any) => {
  if (!pilotRegistry.get(req.params.id)) {
    res.status(404).json({ error: `Pilot not found: ${req.params.id}` }); return;
  }
  pilotRegistry.disable(req.params.id);
  res.json({ id: req.params.id, enabled: false });
});

// GET /api/pilots/:id/history
router.get("/api/pilots/:id/history", (req: any, res: any) => {
  if (!pilotRegistry.get(req.params.id)) {
    res.status(404).json({ error: `Pilot not found: ${req.params.id}` }); return;
  }
  res.json(pilotExecutor.getHistory(req.params.id));
});

// PUT /api/pilots/:id
router.put("/api/pilots/:id", (req: any, res: any) => {
  const existing = pilotRegistry.get(req.params.id);
  if (!existing) { res.status(404).json({ error: `Pilot not found: ${req.params.id}` }); return; }

  const allowed: (keyof PilotManifest)[] = [
    "name", "description", "schedule", "triggerOnStart",
    "systemPrompt", "tools", "maxIterations", "outputFormat", "outputPath", "enabled",
  ];
  const updated = { ...existing };
  for (const key of allowed) {
    if (key in req.body) (updated as any)[key] = req.body[key];
  }
  pilotRegistry.register(updated);
  res.json(updated);
});

export default router;
