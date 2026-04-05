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
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerComputerUseRoutes = registerComputerUseRoutes;
function registerComputerUseRoutes(app) {
    // ── POST /api/automate ──────────────────────────────────────
    // Body: { task: string, visionModel?: 'local'|'claude'|'auto', requireApproval?: boolean }
    app.post('/api/automate', async (req, res) => {
        const { task, visionModel, requireApproval } = req.body;
        if (!task || typeof task !== 'string' || !task.trim()) {
            return res.status(400).json({ error: 'task is required' });
        }
        try {
            const { visionLoop } = await Promise.resolve().then(() => __importStar(require('../../integrations/computerUse/visionLoop')));
            // Run non-blocking — return accepted immediately, result via SSE
            res.json({ status: 'started', task });
            const result = await visionLoop.run(task.trim(), {
                visionModel: (visionModel ?? 'auto'),
                requireApproval: requireApproval !== false,
            });
            console.log(result.success
                ? `[AutomateAPI] ✅ ${task} — done in ${result.iterations} iteration(s)`
                : `[AutomateAPI] ❌ ${task} — failed: ${result.failureReason}`);
        }
        catch (err) {
            console.error(`[AutomateAPI] Error: ${err?.message}`);
        }
    });
    // ── POST /api/automate/stop ─────────────────────────────────
    app.post('/api/automate/stop', async (_req, res) => {
        try {
            const { visionLoop } = await Promise.resolve().then(() => __importStar(require('../../integrations/computerUse/visionLoop')));
            visionLoop.abort();
            res.json({ status: 'aborted' });
        }
        catch (err) {
            res.status(500).json({ error: err?.message ?? 'abort failed' });
        }
    });
    // ── GET /api/automate/log ───────────────────────────────────
    // Returns the full action log from screenAgent for the current session.
    app.get('/api/automate/log', async (_req, res) => {
        try {
            const { screenAgent } = await Promise.resolve().then(() => __importStar(require('../../integrations/computerUse/screenAgent')));
            res.json({ log: screenAgent.getLog() });
        }
        catch (err) {
            res.status(500).json({ error: err?.message ?? 'log unavailable' });
        }
    });
    // ── GET /api/automate/session ────────────────────────────────
    // Returns the live executor session (in-progress or null).
    // Useful for polling live progress from the dashboard.
    app.get('/api/automate/session', async (_req, res) => {
        try {
            const { executor } = await Promise.resolve().then(() => __importStar(require('../../core/executor')));
            const session = executor.currentSession;
            if (!session) {
                return res.json({ session: null, status: 'idle' });
            }
            // Attach live stats
            const completed = session.results.length;
            const successes = session.results.filter(r => r.status === 'success' || r.status === 'fallback' || r.status === 'retried').length;
            res.json({
                session,
                status: 'running',
                actionsCompleted: completed,
                successRate: completed ? successes / completed : 0,
                elapsedMs: Date.now() - new Date(session.startedAt).getTime(),
            });
        }
        catch (err) {
            res.status(500).json({ error: err?.message ?? 'session unavailable' });
        }
    });
}
