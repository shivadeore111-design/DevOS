// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// api/routes/system.ts — System health and status endpoints

// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require("express") as any;

import * as fs               from "fs";
import * as path             from "path";
import http                  from "http";
import { emergencyStop }     from "../../control/emergencyStop";
import { sessionManager }    from "../../core/sessionManager";
import { executionMemory }   from "../../memory/executionMemory";
import { knowledgeStore }    from "../../knowledge/knowledgeStore";
import { pilotRegistry }     from "../../devos/pilots/pilotRegistry";
import { skillIndex }        from "../../skills/skillIndex";
import { blueprintRegistry } from "../../devos/product/blueprintRegistry";
import { auditLogger, AuditEntry } from "../../security/auditLogger";

const router   = express.Router();
const START_TIME = Date.now();

function readVersion(): string {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "package.json"), "utf-8");
    return JSON.parse(raw).version ?? "unknown";
  } catch { return "unknown"; }
}

function checkOllama(): Promise<boolean> {
  return new Promise(resolve => {
    const req = http.get("http://localhost:11434/api/tags", res => {
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

// GET /api/system/health
router.get("/api/system/health", async (_req: any, res: any) => {
  const ollamaConnected = await checkOllama();
  res.json({ status: "ok", uptime: Math.floor((Date.now() - START_TIME) / 1000),
    version: readVersion(), ollamaConnected });
});

// GET /api/system/status
router.get("/api/system/status", async (_req: any, res: any) => {
  const ollamaConnected = await checkOllama();
  const activeSessions  = sessionManager.getActive();
  res.json({
    status: "ok", version: readVersion(),
    uptime: Math.floor((Date.now() - START_TIME) / 1000),
    ollamaConnected,
    activeGoals:      activeSessions.length,
    activeGoalIds:    activeSessions.map(s => ({ id: s.id, goal: s.goal })),
    pilotsScheduled:  pilotRegistry.listEnabled().length,
    totalPilots:      pilotRegistry.list().length,
    memoryEntries:    executionMemory.getAll().length,
    knowledgeEntries: knowledgeStore.list().length,
  });
});

// POST /api/system/stop
router.post("/api/system/stop", async (_req: any, res: any) => {
  await emergencyStop.stopAll();
  res.json({ status: "stopped", message: "Emergency stop triggered for all active goals" });
});

// GET /api/system/sessions
router.get("/api/system/sessions", (_req: any, res: any) => {
  const sessions = sessionManager.list()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50);
  res.json(sessions);
});

// GET /api/system/skills
router.get("/api/system/skills", (_req: any, res: any) => {
  res.json(skillIndex.getAll());
});

// GET /api/system/blueprints
router.get("/api/system/blueprints", (_req: any, res: any) => {
  res.json(blueprintRegistry.list());
});

// GET /api/system/audit — last 50 audit entries (admin only)
// Supports ?type=<entryType> query param for filtering
router.get("/api/system/audit", (req: any, res: any) => {
  // Admin-only guard
  if (req.role && req.role !== "admin") {
    res.status(403).json({ error: "Audit log requires admin role" });
    return;
  }

  const typeFilter = req.query?.type as AuditEntry["type"] | undefined;
  const entries    = typeFilter
    ? auditLogger.getByType(typeFilter)
    : auditLogger.getRecent(50);

  res.json(entries);
});

export default router;
