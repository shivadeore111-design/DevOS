// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// api/routes/goals.ts — Goals REST endpoints

// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require("express") as any;

import { Runner }            from "../../core/runner";
import { DevOSEngine }       from "../../executor/engine";
import { sessionManager }    from "../../core/sessionManager";
import { emergencyStop }     from "../../control/emergencyStop";
import * as path             from "path";
import crypto                from "crypto";

const router = express.Router();

// Queue of async goals
const goalQueue = new Map<string, {
  status:       "queued" | "running" | "completed" | "failed";
  goal:         string;
  result?:      any;
  error?:       string;
  startedAt:    Date;
  completedAt?: Date;
}>();

function makeGoalId(): string {
  return "goal_" + crypto.randomBytes(6).toString("hex");
}

function makeRunner(id: string): Runner {
  const ws     = path.join(process.cwd(), "workspace", "sandbox");
  const engine = new DevOSEngine(ws, false);
  return new Runner({ agentId: id, engine });
}

function runAsync(goalId: string, goal: string): void {
  const entry = goalQueue.get(goalId)!;
  entry.status = "running";
  makeRunner("api-async-" + goalId)
    .runOnce(goal)
    .then(task => {
      entry.status      = "completed";
      entry.result      = { taskId: task.id, status: task.status, output: (task as any).output };
      entry.completedAt = new Date();
    })
    .catch(err => {
      entry.status      = "failed";
      entry.error       = String(err?.message ?? err);
      entry.completedAt = new Date();
    });
}

// POST /api/goals
router.post("/api/goals", async (req: any, res: any) => {
  const { goal, async: isAsync } = req.body ?? {};
  if (!goal || typeof goal !== "string") {
    res.status(400).json({ error: "Missing required field: goal" }); return;
  }
  if (isAsync) {
    const goalId = makeGoalId();
    goalQueue.set(goalId, { status: "queued", goal, startedAt: new Date() });
    runAsync(goalId, goal);
    res.status(202).json({ goalId, status: "queued" });
    return;
  }
  try {
    const task = await makeRunner("api-sync").runOnce(goal);
    res.json({ goalId: task.id, status: task.status, goal, result: (task as any).output ?? null });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// GET /api/goals
router.get("/api/goals", (_req: any, res: any) => {
  const sessions = sessionManager.list()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20)
    .map(s => ({ goalId: s.id, goal: s.goal, status: s.status, startedAt: s.createdAt }));

  const sessionIds = new Set(sessions.map((s: any) => s.goalId));
  const queuedGoals = Array.from(goalQueue.entries())
    .filter(([id]) => !sessionIds.has(id))
    .map(([id, entry]) => ({ goalId: id, goal: entry.goal, status: entry.status, startedAt: entry.startedAt }))
    .slice(0, 20);

  res.json([...sessions, ...queuedGoals].slice(0, 20));
});

// GET /api/goals/:id
router.get("/api/goals/:id", (req: any, res: any) => {
  const { id } = req.params;
  const queued  = goalQueue.get(id);
  if (queued) {
    res.json({ goalId: id, goal: queued.goal, status: queued.status,
      startedAt: queued.startedAt, completedAt: queued.completedAt ?? null,
      result: queued.result ?? null, error: queued.error ?? null });
    return;
  }
  const session = sessionManager.get(id);
  if (!session) { res.status(404).json({ error: `Goal not found: ${id}` }); return; }
  res.json({
    goalId:  session.id,
    goal:    session.goal,
    status:  session.status,
    history: session.history ?? [],
    result:  (session as any).result ?? null,
  });
});

// DELETE /api/goals/:id
router.delete("/api/goals/:id", async (req: any, res: any) => {
  const { id } = req.params;
  try {
    await emergencyStop.stop(id);
    const queued = goalQueue.get(id);
    if (queued) { queued.status = "failed"; queued.error = "Cancelled by API"; queued.completedAt = new Date(); }
    res.json({ goalId: id, status: "cancelled" });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// POST /api/goals/:id/retry
router.post("/api/goals/:id/retry", async (req: any, res: any) => {
  const { id }  = req.params;
  const queued  = goalQueue.get(id);
  const session = sessionManager.get(id);
  const goal    = queued?.goal ?? session?.goal;
  if (!goal) { res.status(404).json({ error: `Goal not found: ${id}` }); return; }
  const newGoalId = makeGoalId();
  goalQueue.set(newGoalId, { status: "queued", goal, startedAt: new Date() });
  runAsync(newGoalId, goal);
  res.status(202).json({ goalId: newGoalId, status: "queued", retriedFrom: id });
});

export default router;
