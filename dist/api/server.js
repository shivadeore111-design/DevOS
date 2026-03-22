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
exports.createApiServer = createApiServer;
exports.startApiServer = startApiServer;
// api/server.ts — DevOS REST API server
// Uses require() with any-cast so no @types/express needed.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require("express");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const auth_1 = require("./middleware/auth");
const rateLimit_1 = require("./middleware/rateLimit");
const permissions_1 = require("./middleware/permissions");
const goals_1 = __importDefault(require("./routes/goals"));
const goals_v2_1 = __importDefault(require("./routes/goals_v2"));
const agents_1 = __importDefault(require("./routes/agents"));
const pilots_1 = __importDefault(require("./routes/pilots"));
const knowledge_1 = __importDefault(require("./routes/knowledge"));
const memory_1 = __importDefault(require("./routes/memory"));
const system_1 = __importDefault(require("./routes/system"));
const stream_1 = __importDefault(require("./routes/stream"));
const deploy_1 = __importDefault(require("./routes/deploy"));
const missions_1 = __importDefault(require("./routes/missions"));
const dialogueEngine_1 = require("../personality/dialogueEngine");
const conversationMemory_1 = require("../personality/conversationMemory");
const proactiveEngine_1 = require("../personality/proactiveEngine");
const morningBriefing_1 = require("../personal/morningBriefing");
const lifeTimeline_1 = require("../personal/lifeTimeline");
const backgroundAgents_1 = require("../personal/backgroundAgents");
const telegramBot_1 = require("../integrations/telegram/telegramBot");
const telegramNotifier_1 = require("../integrations/telegram/telegramNotifier");
const sandboxManager_1 = require("../sandbox/sandboxManager");
function createApiServer() {
    const app = express();
    // 1. JSON body parsing
    app.use(express.json());
    // 2. CORS
    app.use((req, res, next) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        if (req.method === "OPTIONS") {
            res.sendStatus(200);
            return;
        }
        next();
    });
    // 3. Rate limiter
    app.use(rateLimit_1.rateLimiter);
    // 4. Auth (skip only /api/system/health — public health check)
    app.use((req, res, next) => {
        if (req.path === "/api/system/health")
            return next();
        return (0, auth_1.apiKeyAuth)(req, res, next);
    });
    // 5. Permission check (role-based)
    app.use(permissions_1.permissionCheck);
    // Swagger docs
    app.get("/api/docs", (_req, res) => {
        res.json(generateSwaggerSpec());
    });
    // 6. Routes — goalsV2 must come before goalsRouter to prevent /api/goals/:id catching /api/goals/v2
    app.use(goals_v2_1.default);
    app.use(goals_1.default);
    app.use(agents_1.default);
    app.use(pilots_1.default);
    app.use(knowledge_1.default);
    app.use(memory_1.default);
    app.use(system_1.default);
    app.use(stream_1.default);
    app.use(deploy_1.default);
    app.use(missions_1.default);
    // ── Personality / Chat routes ──────────────────────────────────────────────
    // POST /api/chat — SSE streaming chat response
    app.post("/api/chat", async (req, res) => {
        const message = req.body?.message;
        if (!message?.trim()) {
            return res.status(400).json({ error: "message is required" });
        }
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders?.();
        try {
            for await (const chunk of dialogueEngine_1.dialogueEngine.chat(message)) {
                res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
            }
        }
        catch (err) {
            res.write(`data: ${JSON.stringify({ error: err?.message ?? "stream error" })}\n\n`);
        }
        finally {
            res.write("data: [DONE]\n\n");
            res.end();
        }
    });
    // GET /api/chat/history — last 50 conversation messages
    app.get("/api/chat/history", (_req, res) => {
        const messages = conversationMemory_1.conversationMemory.getRecentMessages(50);
        res.json(messages);
    });
    // GET /api/chat/proactive — unshown proactive messages
    app.get("/api/chat/proactive", (req, res) => {
        const id = req.query?.markShown;
        if (id)
            proactiveEngine_1.proactiveEngine.markShown(id);
        res.json(proactiveEngine_1.proactiveEngine.getUnshown());
    });
    // ── Personal Mode routes ───────────────────────────────────────────────────
    // GET /api/personal/briefing — LLM-generated morning briefing
    app.get("/api/personal/briefing", async (_req, res) => {
        const briefing = await morningBriefing_1.morningBriefing.generate();
        res.json({ briefing });
    });
    // GET /api/personal/timeline — all life-timeline entries
    app.get("/api/personal/timeline", (_req, res) => {
        res.json(lifeTimeline_1.lifeTimeline.getTimeline());
    });
    // GET /api/personal/agents — list background agents + status
    app.get("/api/personal/agents", (_req, res) => {
        res.json(backgroundAgents_1.backgroundAgents.listAgents());
    });
    // POST /api/personal/agents/:name/enable
    app.post("/api/personal/agents/:name/enable", async (req, res) => {
        try {
            await backgroundAgents_1.backgroundAgents.enableAgent(req.params.name);
            res.json({ success: true });
        }
        catch (e) {
            res.status(400).json({ error: e.message });
        }
    });
    // POST /api/personal/agents/:name/disable
    app.post("/api/personal/agents/:name/disable", async (req, res) => {
        try {
            await backgroundAgents_1.backgroundAgents.disableAgent(req.params.name);
            res.json({ success: true });
        }
        catch (e) {
            res.status(400).json({ error: e.message });
        }
    });
    // ── Sandbox routes ────────────────────────────────────────────────────────
    // GET /api/sandbox/status — list all active sandboxes
    app.get("/api/sandbox/status", (_req, res) => {
        const sandboxes = sandboxManager_1.sandboxManager.listActiveSandboxes();
        res.json({
            enabled: process.env.DEVOS_SANDBOX === 'true',
            count: sandboxes.length,
            sandboxes: sandboxes.map(s => ({
                taskId: s.taskId,
                containerId: s.containerId.slice(0, 12),
                status: s.status,
                createdAt: s.createdAt,
                uptimeSec: Math.floor((Date.now() - s.createdAt) / 1000),
            })),
        });
    });
    // GET /api/sandbox/:taskId/status — status for a specific sandbox
    app.get("/api/sandbox/:taskId/status", (req, res) => {
        const sandbox = sandboxManager_1.sandboxManager.getSandbox(req.params.taskId);
        if (!sandbox)
            return res.status(404).json({ error: `No sandbox for task ${req.params.taskId}` });
        res.json({
            taskId: sandbox.taskId,
            containerId: sandbox.containerId.slice(0, 12),
            status: sandbox.status,
            createdAt: sandbox.createdAt,
            uptimeSec: Math.floor((Date.now() - sandbox.createdAt) / 1000),
        });
    });
    // POST /api/sandbox/clean — destroy all active sandboxes
    app.post("/api/sandbox/clean", async (_req, res) => {
        try {
            const before = sandboxManager_1.sandboxManager.listActiveSandboxes().length;
            await sandboxManager_1.sandboxManager.cleanupAll();
            res.json({ destroyed: before, message: `Cleaned up ${before} sandbox(es)` });
        }
        catch (e) {
            res.status(500).json({ error: e?.message ?? String(e) });
        }
    });
    return app;
}
function generateSwaggerSpec() {
    return {
        openapi: "3.0.0",
        info: {
            title: "DevOS API",
            version: "1.0.0",
            description: "DevOS autonomous AI operating system REST API",
        },
        paths: {
            "/api/goals": { post: { summary: "Submit a goal (async or sync)" },
                get: { summary: "List recent goals (last 20)" } },
            "/api/goals/v2": { post: { summary: "Create + plan + execute a structured goal" },
                get: { summary: "List all Goal Engine goals" } },
            "/api/goals/v2/{id}": { get: { summary: "Full goal status: goal + projects + tasks" } },
            "/api/goals/v2/{id}/pause": { post: { summary: "Pause goal execution" } },
            "/api/goals/v2/{id}/resume": { post: { summary: "Resume paused goal" } },
            "/api/goals/v2/{id}/replan": { post: { summary: "Replan a failed goal" } },
            "/api/agents": { get: { summary: "List all agents with status" } },
            "/api/agents/messages": { get: { summary: "Recent agent messages (last 50)" } },
            "/api/agents/messages/{id}": { get: { summary: "Message thread for task/goal id" } },
            "/api/agents/{role}": { get: { summary: "Agent detail + recent messages" } },
            "/api/agents/coordinate": { post: { summary: "Start coordination loop for a goal" } },
            "/api/goals/{id}": { get: { summary: "Get goal detail" },
                delete: { summary: "Cancel a running goal" } },
            "/api/goals/{id}/retry": { post: { summary: "Retry a failed goal" } },
            "/api/pilots": { get: { summary: "List all pilots" } },
            "/api/pilots/{id}": { get: { summary: "Get pilot detail + last 5 runs" },
                put: { summary: "Update pilot manifest" } },
            "/api/pilots/{id}/run": { post: { summary: "Trigger pilot immediately" } },
            "/api/pilots/{id}/enable": { post: { summary: "Enable pilot" } },
            "/api/pilots/{id}/disable": { post: { summary: "Disable pilot" } },
            "/api/pilots/{id}/history": { get: { summary: "Get full pilot run history" } },
            "/api/knowledge": { get: { summary: "List all knowledge entries" } },
            "/api/knowledge/ingest": { post: { summary: "Ingest file, URL, or text" } },
            "/api/knowledge/query": { post: { summary: "Query knowledge base" } },
            "/api/knowledge/{id}": { get: { summary: "Get knowledge entry" },
                delete: { summary: "Delete knowledge entry" } },
            "/api/memory": { get: { summary: "List execution memory entries" } },
            "/api/memory/stats": { get: { summary: "Memory statistics" } },
            "/api/memory/prune": { delete: { summary: "Prune low-quality entries" } },
            "/api/memory/{goalType}": { get: { summary: "Memory for specific goal type" } },
            "/api/system/health": { get: { summary: "Health check (no auth required)" } },
            "/api/system/status": { get: { summary: "Full system status" } },
            "/api/system/stop": { post: { summary: "Emergency stop all goals" } },
            "/api/system/sessions": { get: { summary: "Recent agent sessions" } },
            "/api/system/skills": { get: { summary: "All indexed skills" } },
            "/api/system/blueprints": { get: { summary: "All product blueprints" } },
            "/api/system/audit": { get: { summary: "Audit log (admin only)" } },
            "/api/stream": { get: { summary: "SSE all DevOS events" } },
            "/api/stream/goals/{id}": { get: { summary: "SSE stream for one goal" } },
            "/api/deploy/vercel/projects": { get: { summary: "List all Vercel projects" } },
            "/api/deploy/vercel/deployments/{name}": { get: { summary: "List deployments for a Vercel project" } },
            "/api/deploy/vercel/{name}": { post: { summary: "Deploy a directory to Vercel" } },
            "/api/deploy/railway/projects": { get: { summary: "List all Railway projects" } },
            "/api/deploy/railway/{projectId}/deploy/{serviceId}": { post: { summary: "Trigger Railway service deploy" } },
            "/api/missions": { post: { summary: "Start an autonomous mission" }, get: { summary: "List all missions" } },
            "/api/missions/{id}": { get: { summary: "Mission detail + task queue" } },
            "/api/missions/{id}/todo": { get: { summary: "Mission TODO markdown" } },
            "/api/missions/{id}/pause": { post: { summary: "Pause a running mission" } },
            "/api/missions/{id}/resume": { post: { summary: "Resume a paused mission" } },
            "/api/missions/{id}/cancel": { post: { summary: "Cancel a mission" } },
            "/api/coordination/approve": { post: { summary: "Approve a human-in-the-loop task" } },
            "/api/coordination/reject": { post: { summary: "Reject a human-in-the-loop task" } },
            "/api/chat": { post: { summary: "SSE streaming chat with DevOS personality" } },
            "/api/chat/history": { get: { summary: "Last 50 conversation messages" } },
            "/api/chat/proactive": { get: { summary: "Unshown proactive messages (pass ?markShown=id to ack)" } },
            "/api/personal/briefing": { get: { summary: "LLM-generated morning briefing" } },
            "/api/personal/timeline": { get: { summary: "Full life-timeline entries" } },
            "/api/personal/agents": { get: { summary: "List background agents with status + schedule" } },
            "/api/personal/agents/:name/enable": { post: { summary: "Enable a background agent" } },
            "/api/personal/agents/:name/disable": { post: { summary: "Disable a background agent" } },
        },
    };
}
function startApiServer(portArg) {
    const cfgPath = path.join(process.cwd(), "config", "api.json");
    const apiConfig = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
    const host = apiConfig.host || "127.0.0.1";
    const port = (portArg ?? apiConfig.port ?? 4200);
    const app = createApiServer();
    app.listen(port, host, () => {
        console.log(`[API] 🚀 DevOS API running at http://${host}:${port}`);
        console.log(`[API] 🔒 Bound to ${host} — localhost only`);
        console.log(`[API] 📖 Docs at http://${host}:${port}/api/docs`);
        proactiveEngine_1.proactiveEngine.start();
        telegramBot_1.telegramBot.start().catch((e) => console.error('[Telegram] Start failed:', e?.message ?? String(e)));
        telegramNotifier_1.telegramNotifier.start();
    });
    return app;
}
