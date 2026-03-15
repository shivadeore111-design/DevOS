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
exports.dashboardServer = exports.DashboardServer = void 0;
// ============================================================
// dashboard/server.ts — DevOS Control Plane HTTP + WS Server
// REST API + WebSocket live event streaming
// Uses require() with any-casts so no @types packages needed.
// ============================================================
const http_1 = __importDefault(require("http"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require("express");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cors = require("cors");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const WS = require("ws");
const eventBus_1 = require("../core/eventBus");
const events_1 = require("./events");
const taskStore_1 = require("../core/taskStore");
const registry_1 = require("../skills/registry");
const skillMemory_1 = require("../skills/skillMemory");
const vectorMemory_1 = require("../memory/vectorMemory");
const metrics_1 = require("./metrics");
const ollama_1 = require("../llm/ollama");
const runner_1 = require("../core/runner");
const engine_1 = require("../executor/engine");
// ── Inline fallback HTML ──────────────────────────────────────
function inlineFallback() {
    const uiFile = path_1.default.join(__dirname, "ui", "index.html");
    if (fs_1.default.existsSync(uiFile)) {
        return fs_1.default.readFileSync(uiFile, "utf-8");
    }
    return `<!DOCTYPE html><html><head><title>DevOS</title></head><body>
    <h2>DevOS Control Plane</h2>
    <p>UI not found at dashboard/ui/index.html — API is running on this port.</p>
    <p><a href="/api/health">Health</a> | <a href="/api/tasks">Tasks</a> | <a href="/api/skills">Skills</a></p>
  </body></html>`;
}
// ── DashboardServer ───────────────────────────────────────────
class DashboardServer {
    constructor(port = 3333) {
        this.server = null;
        this.wss = null;
        this.metrics = new metrics_1.MetricsDashboard();
        this.workspace = path_1.default.join(process.cwd(), "workspace", "sandbox");
        this.port = port;
        this.app = express();
        this.app.use(cors());
        this.app.use(express.json());
        this._registerRoutes();
    }
    // ── REST Routes ─────────────────────────────────────────────
    _registerRoutes() {
        const app = this.app;
        // GET /api/health
        app.get("/api/health", async (_req, res) => {
            try {
                const ollamaOk = await (0, ollama_1.checkOllamaHealth)();
                res.json({ status: "ok", version: "4.0.0", ollama: ollamaOk });
            }
            catch {
                res.json({ status: "ok", version: "4.0.0", ollama: false });
            }
        });
        // GET /api/tasks
        app.get("/api/tasks", (_req, res) => {
            try {
                const tasks = taskStore_1.taskStore
                    .getAll()
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                    .slice(0, 50);
                res.json(tasks);
            }
            catch (err) {
                res.status(500).json({ error: err.message });
            }
        });
        // GET /api/skills
        app.get("/api/skills", (_req, res) => {
            try {
                const names = registry_1.skillRegistry.list();
                const allMetrics = skillMemory_1.SkillMemory.getAll();
                const metricsMap = new Map(allMetrics.map(m => [m.name, m]));
                const result = names.map(name => {
                    const skill = registry_1.skillRegistry.get(name);
                    const metric = metricsMap.get(name);
                    return {
                        name: skill.name,
                        category: skill.category ?? "general",
                        description: skill.description,
                        successRate: metric ? metric.successRate : 0,
                        executionCount: metric ? metric.totalRuns : 0,
                        avgDuration: metric ? metric.avgDurationMs : 0,
                    };
                });
                res.json(result);
            }
            catch (err) {
                res.status(500).json({ error: err.message });
            }
        });
        // GET /api/memory
        app.get("/api/memory", (_req, res) => {
            try {
                const all = vectorMemory_1.vectorMemory.exportAll();
                const recent = all
                    .slice()
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                    .slice(0, 20);
                res.json(recent);
            }
            catch (err) {
                res.status(500).json({ error: err.message });
            }
        });
        // GET /api/metrics
        app.get("/api/metrics", (_req, res) => {
            try {
                res.json(this.metrics.getStats());
            }
            catch (err) {
                res.status(500).json({ error: err.message });
            }
        });
        // POST /api/goal
        app.post("/api/goal", async (req, res) => {
            const goal = (req.body?.goal ?? "").trim();
            if (!goal) {
                return res.status(400).json({ error: "goal is required" });
            }
            try {
                const engine = new engine_1.DevOSEngine(this.workspace, false);
                const runner = new runner_1.Runner({ agentId: "dashboard-agent", engine });
                // Fire-and-forget so HTTP returns immediately
                const taskPromise = runner.runOnce(goal);
                // Emit goal_received right away
                events_1.eventBus.emit({
                    type: "goal_received",
                    payload: { goal },
                    timestamp: new Date().toISOString(),
                });
                // We can't await forever in an HTTP handler, so return taskId optimistically
                const pendingTask = taskStore_1.taskStore
                    .getAll()
                    .filter(t => t.goal === goal)
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
                const taskId = pendingTask?.id ?? `task_${Date.now()}`;
                res.json({ taskId, status: "queued" });
                // Continue running in background, update events
                taskPromise
                    .then(task => {
                    events_1.eventBus.emit({
                        type: task.status === "completed" ? "goal_completed" : "goal_failed",
                        taskId: task.id,
                        payload: { goal, status: task.status, result: task.result },
                        timestamp: new Date().toISOString(),
                    });
                })
                    .catch(err => {
                    events_1.eventBus.emit({
                        type: "goal_failed",
                        payload: { goal, error: err.message },
                        timestamp: new Date().toISOString(),
                    });
                });
            }
            catch (err) {
                res.status(500).json({ error: err.message });
            }
        });
        // POST /api/evolve
        app.post("/api/evolve", async (_req, res) => {
            try {
                const { skillEvolutionEngine } = await Promise.resolve().then(() => __importStar(require("../devos/evolution/skillEvolutionEngine")));
                const result = await skillEvolutionEngine.run();
                res.json(result);
            }
            catch (err) {
                res.status(500).json({ error: err.message });
            }
        });
        // GET /api/benchmarks
        app.get("/api/benchmarks", (_req, res) => {
            try {
                const file = path_1.default.join(process.cwd(), "workspace", "benchmark-results.json");
                if (fs_1.default.existsSync(file)) {
                    res.json(JSON.parse(fs_1.default.readFileSync(file, "utf-8")));
                }
                else {
                    res.json([]);
                }
            }
            catch (err) {
                res.status(500).json({ error: err.message });
            }
        });
        // GET /api/projects
        app.get("/api/projects", async (_req, res) => {
            try {
                const { ProjectStore } = await Promise.resolve().then(() => __importStar(require("../devos/company/projectContext")));
                const store = new ProjectStore();
                res.json(store.list());
            }
            catch (err) {
                res.status(500).json({ error: err.message });
            }
        });
        // POST /api/company
        app.post("/api/company", async (req, res) => {
            try {
                const { goal } = req.body;
                if (!goal)
                    return res.status(400).json({ error: "goal is required" });
                const { companyManager } = await Promise.resolve().then(() => __importStar(require("../devos/company/companyManager")));
                const projectId = await companyManager.run(goal);
                res.json({ projectId });
            }
            catch (err) {
                res.status(500).json({ error: err.message });
            }
        });
        // GET /api/graph/:goalId — return task graph snapshot for a goal
        app.get("/api/graph/:goalId", async (req, res) => {
            try {
                const { stateSnapshot } = await Promise.resolve().then(() => __importStar(require("../devos/runtime/stateSnapshot")));
                const snap = await stateSnapshot.load(req.params.goalId);
                if (!snap) {
                    return res.status(404).json({ error: `No snapshot found for goal: ${req.params.goalId}` });
                }
                res.json(snap);
            }
            catch (err) {
                res.status(500).json({ error: err.message });
            }
        });
        // GET /api/graphs — list all snapshot goalIds
        app.get("/api/graphs", async (_req, res) => {
            try {
                const { stateSnapshot } = await Promise.resolve().then(() => __importStar(require("../devos/runtime/stateSnapshot")));
                res.json({ goalIds: stateSnapshot.list() });
            }
            catch (err) {
                res.status(500).json({ error: err.message });
            }
        });
        // ── SSE event stream ─────────────────────────────────────
        app.get("/api/stream", (req, res) => {
            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Connection", "keep-alive");
            res.setHeader("Access-Control-Allow-Origin", "*");
            // Send an initial heartbeat so the browser knows the stream is live
            res.write(`: heartbeat\n\n`);
            const handler = (data) => {
                res.write(`data: ${JSON.stringify(data)}\n\n`);
            };
            const SSE_EVENTS = [
                "goal_started", "goal_completed", "goal_failed",
                "action_executed", "plan_generated", "session_created",
                "product_module_completed", "emergency_stop",
            ];
            SSE_EVENTS.forEach(e => eventBus_1.eventBus.on(e, handler));
            req.on("close", () => SSE_EVENTS.forEach(e => eventBus_1.eventBus.off(e, handler)));
        });
        // ── Pilots API ───────────────────────────────────────────
        app.get("/api/pilots", async (_req, res) => {
            try {
                const { pilotRegistry } = await Promise.resolve().then(() => __importStar(require("../devos/pilots/pilotRegistry")));
                res.json(pilotRegistry.list());
            }
            catch (err) {
                res.status(500).json({ error: err.message });
            }
        });
        app.post("/api/pilots/:id/run", async (req, res) => {
            try {
                const { pilotScheduler } = await Promise.resolve().then(() => __importStar(require("../devos/pilots/pilotScheduler")));
                const run = await pilotScheduler.runNow(req.params.id);
                res.json(run);
            }
            catch (err) {
                res.status(500).json({ error: err.message });
            }
        });
        // Serve the React SPA — any other route returns index.html
        app.get("*", (_req, res) => {
            const uiDist = path_1.default.join(__dirname, "ui", "dist", "index.html");
            if (fs_1.default.existsSync(uiDist)) {
                return res.sendFile(uiDist);
            }
            const uiDirect = path_1.default.join(__dirname, "ui", "index.html");
            if (fs_1.default.existsSync(uiDirect)) {
                return res.sendFile(uiDirect);
            }
            res.send(inlineFallback());
        });
    }
    // ── Start ────────────────────────────────────────────────────
    async start() {
        // Clear tasks older than 1 hour from taskStore to prevent stale event replay
        const removed = taskStore_1.taskStore.clearStale();
        if (removed > 0) {
            console.log(`[Dashboard] Cleared ${removed} stale task(s) on startup.`);
        }
        return new Promise((resolve) => {
            this.server = http_1.default.createServer(this.app);
            // ── WebSocket Server ──────────────────────────────────────
            this.wss = new WS.Server({ server: this.server });
            this.wss.on("connection", (ws) => {
                console.log("[Dashboard] WebSocket client connected");
                // Replay last 20 events so the client has context immediately
                const history = events_1.eventBus.getHistory(20);
                ws.send(JSON.stringify({ type: "replay", events: history }));
                // Forward live events to this client
                const handler = (event) => {
                    if (ws.readyState === 1 /* OPEN */) {
                        ws.send(JSON.stringify(event));
                    }
                };
                events_1.eventBus.subscribe(handler);
                ws.on("close", () => {
                    events_1.eventBus.unsubscribe(handler);
                    console.log("[Dashboard] WebSocket client disconnected");
                });
                ws.on("error", (err) => {
                    console.error("[Dashboard] WS error:", err.message);
                    events_1.eventBus.unsubscribe(handler);
                });
            });
            this.server.listen(this.port, () => {
                resolve();
            });
        });
    }
    stop() {
        this.wss?.close();
        this.server?.close();
    }
}
exports.DashboardServer = DashboardServer;
// ── Singleton ─────────────────────────────────────────────────
exports.dashboardServer = new DashboardServer();
