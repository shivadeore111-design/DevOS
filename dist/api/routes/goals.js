"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// api/routes/goals.ts — Goals REST endpoints
// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require("express");
const runner_1 = require("../../core/runner");
const engine_1 = require("../../executor/engine");
const sessionManager_1 = require("../../core/sessionManager");
const emergencyStop_1 = require("../../control/emergencyStop");
const path = __importStar(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const router = express.Router();
// Queue of async goals
const goalQueue = new Map();
function makeGoalId() {
    return "goal_" + crypto_1.default.randomBytes(6).toString("hex");
}
function makeRunner(id) {
    const ws = path.join(process.cwd(), "workspace", "sandbox");
    const engine = new engine_1.DevOSEngine(ws, false);
    return new runner_1.Runner({ agentId: id, engine });
}
function runAsync(goalId, goal) {
    const entry = goalQueue.get(goalId);
    entry.status = "running";
    makeRunner("api-async-" + goalId)
        .runOnce(goal)
        .then(task => {
        entry.status = "completed";
        entry.result = { taskId: task.id, status: task.status, output: task.output };
        entry.completedAt = new Date();
    })
        .catch(err => {
        entry.status = "failed";
        entry.error = String(err?.message ?? err);
        entry.completedAt = new Date();
    });
}
// POST /api/goals
router.post("/api/goals", async (req, res) => {
    const { goal, async: isAsync } = req.body ?? {};
    if (!goal || typeof goal !== "string") {
        res.status(400).json({ error: "Missing required field: goal" });
        return;
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
        res.json({ goalId: task.id, status: task.status, goal, result: task.output ?? null });
    }
    catch (err) {
        res.status(500).json({ error: err?.message ?? String(err) });
    }
});
// GET /api/goals
router.get("/api/goals", (_req, res) => {
    const sessions = sessionManager_1.sessionManager.list()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 20)
        .map(s => ({ goalId: s.id, goal: s.goal, status: s.status, startedAt: s.createdAt }));
    const sessionIds = new Set(sessions.map((s) => s.goalId));
    const queuedGoals = Array.from(goalQueue.entries())
        .filter(([id]) => !sessionIds.has(id))
        .map(([id, entry]) => ({ goalId: id, goal: entry.goal, status: entry.status, startedAt: entry.startedAt }))
        .slice(0, 20);
    res.json([...sessions, ...queuedGoals].slice(0, 20));
});
// GET /api/goals/:id
router.get("/api/goals/:id", (req, res) => {
    const { id } = req.params;
    const queued = goalQueue.get(id);
    if (queued) {
        res.json({ goalId: id, goal: queued.goal, status: queued.status,
            startedAt: queued.startedAt, completedAt: queued.completedAt ?? null,
            result: queued.result ?? null, error: queued.error ?? null });
        return;
    }
    const session = sessionManager_1.sessionManager.get(id);
    if (!session) {
        res.status(404).json({ error: `Goal not found: ${id}` });
        return;
    }
    res.json({
        goalId: session.id,
        goal: session.goal,
        status: session.status,
        history: session.history ?? [],
        result: session.result ?? null,
    });
});
// DELETE /api/goals/:id
router.delete("/api/goals/:id", async (req, res) => {
    const { id } = req.params;
    try {
        await emergencyStop_1.emergencyStop.stop(id);
        const queued = goalQueue.get(id);
        if (queued) {
            queued.status = "failed";
            queued.error = "Cancelled by API";
            queued.completedAt = new Date();
        }
        res.json({ goalId: id, status: "cancelled" });
    }
    catch (err) {
        res.status(500).json({ error: err?.message ?? String(err) });
    }
});
// POST /api/goals/:id/retry
router.post("/api/goals/:id/retry", async (req, res) => {
    const { id } = req.params;
    const queued = goalQueue.get(id);
    const session = sessionManager_1.sessionManager.get(id);
    const goal = queued?.goal ?? session?.goal;
    if (!goal) {
        res.status(404).json({ error: `Goal not found: ${id}` });
        return;
    }
    const newGoalId = makeGoalId();
    goalQueue.set(newGoalId, { status: "queued", goal, startedAt: new Date() });
    runAsync(newGoalId, goal);
    res.status(202).json({ goalId: newGoalId, status: "queued", retriedFrom: id });
});
exports.default = router;
