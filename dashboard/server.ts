// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// ============================================================
// dashboard/server.ts — DevOS Control Plane HTTP + WS Server
// REST API + WebSocket live event streaming
// Uses require() with any-casts so no @types packages needed.
// ============================================================

import http    from "http";
import fs      from "fs";
import path    from "path";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require("express") as any;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cors    = require("cors")    as any;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const WS      = require("ws")      as any;

import { eventBus, DevOSEvent }   from "./events";
import { taskStore }              from "../core/taskStore";
import { skillRegistry }          from "../skills/registry";
import { SkillMemory }            from "../skills/skillMemory";
import { vectorMemory }           from "../memory/vectorMemory";
import { MetricsDashboard }       from "./metrics";
import { checkOllamaHealth }      from "../llm/ollama";
import { Runner }                 from "../core/runner";
import { DevOSEngine }            from "../executor/engine";

// ── Inline fallback HTML ──────────────────────────────────────

function inlineFallback(): string {
  const uiFile = path.join(__dirname, "ui", "index.html");
  if (fs.existsSync(uiFile)) {
    return fs.readFileSync(uiFile, "utf-8");
  }
  return `<!DOCTYPE html><html><head><title>DevOS</title></head><body>
    <h2>DevOS Control Plane</h2>
    <p>UI not found at dashboard/ui/index.html — API is running on this port.</p>
    <p><a href="/api/health">Health</a> | <a href="/api/tasks">Tasks</a> | <a href="/api/skills">Skills</a></p>
  </body></html>`;
}

// ── DashboardServer ───────────────────────────────────────────

export class DashboardServer {
  private port:       number;
  private app:        any;
  private server:     http.Server | null = null;
  private wss:        any = null;
  private metrics     = new MetricsDashboard();
  private workspace   = path.join(process.cwd(), "workspace", "sandbox");

  constructor(port = 3333) {
    this.port = port;
    this.app  = express();
    this.app.use(cors());
    this.app.use(express.json());
    this._registerRoutes();
  }

  // ── REST Routes ─────────────────────────────────────────────

  private _registerRoutes(): void {
    const app = this.app;

    // GET /api/health
    app.get("/api/health", async (_req: any, res: any) => {
      try {
        const ollamaOk = await checkOllamaHealth();
        res.json({ status: "ok", version: "4.0.0", ollama: ollamaOk });
      } catch {
        res.json({ status: "ok", version: "4.0.0", ollama: false });
      }
    });

    // GET /api/tasks
    app.get("/api/tasks", (_req: any, res: any) => {
      try {
        const tasks = taskStore
          .getAll()
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 50);
        res.json(tasks);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // GET /api/skills
    app.get("/api/skills", (_req: any, res: any) => {
      try {
        const skillList  = skillRegistry.getAll();
        const allMetrics = SkillMemory.getAll();
        const metricsMap = new Map(allMetrics.map(m => [m.name, m]));

        const result = skillList.map(skill => ({
          name:         skill.name,
          description:  skill.description,
          category:     (skill as any).category ?? "general",
          metric:       metricsMap.get(skill.name) ?? null,
        }));

        res.json(result);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // GET /api/memory
    app.get("/api/memory", (_req: any, res: any) => {
      try {
        const all     = vectorMemory.exportAll();
        const recent  = all
          .slice()
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 20);
        res.json(recent);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // GET /api/metrics
    app.get("/api/metrics", (_req: any, res: any) => {
      try {
        res.json(this.metrics.getStats());
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // POST /api/goal
    app.post("/api/goal", async (req: any, res: any) => {
      const goal = (req.body?.goal ?? "").trim();
      if (!goal) {
        return res.status(400).json({ error: "goal is required" });
      }
      try {
        const engine = new DevOSEngine(this.workspace, false);
        const runner = new Runner({ agentId: "dashboard-agent", engine });

        // Fire-and-forget so HTTP returns immediately
        const taskPromise = runner.runOnce(goal);
        // Emit goal_received right away
        eventBus.emit({
          type:      "goal_received",
          payload:   { goal },
          timestamp: new Date().toISOString(),
        });

        // We can't await forever in an HTTP handler, so return taskId optimistically
        const pendingTask = taskStore
          .getAll()
          .filter(t => t.goal === goal)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

        const taskId = pendingTask?.id ?? `task_${Date.now()}`;
        res.json({ taskId, status: "queued" });

        // Continue running in background, update events
        taskPromise
          .then(task => {
            eventBus.emit({
              type:      task.status === "completed" ? "goal_completed" : "goal_failed",
              taskId:    task.id,
              payload:   { goal, status: task.status, result: task.result },
              timestamp: new Date().toISOString(),
            });
          })
          .catch(err => {
            eventBus.emit({
              type:      "goal_failed",
              payload:   { goal, error: err.message },
              timestamp: new Date().toISOString(),
            });
          });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // Serve the React SPA — any other route returns index.html
    app.get("*", (_req: any, res: any) => {
      const uiDist = path.join(__dirname, "ui", "dist", "index.html");
      if (fs.existsSync(uiDist)) {
        return res.sendFile(uiDist);
      }
      const uiDirect = path.join(__dirname, "ui", "index.html");
      if (fs.existsSync(uiDirect)) {
        return res.sendFile(uiDirect);
      }
      res.send(inlineFallback());
    });
  }

  // ── Start ────────────────────────────────────────────────────

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = http.createServer(this.app);

      // ── WebSocket Server ──────────────────────────────────────
      this.wss = new WS.Server({ server: this.server });

      this.wss.on("connection", (ws: any) => {
        console.log("[Dashboard] WebSocket client connected");

        // Replay last 20 events so the client has context immediately
        const history = eventBus.getHistory(20);
        ws.send(JSON.stringify({ type: "replay", events: history }));

        // Forward live events to this client
        const handler = (event: DevOSEvent) => {
          if (ws.readyState === 1 /* OPEN */) {
            ws.send(JSON.stringify(event));
          }
        };
        eventBus.subscribe(handler);

        ws.on("close", () => {
          eventBus.unsubscribe(handler);
          console.log("[Dashboard] WebSocket client disconnected");
        });

        ws.on("error", (err: any) => {
          console.error("[Dashboard] WS error:", err.message);
          eventBus.unsubscribe(handler);
        });
      });

      this.server.listen(this.port, () => {
        resolve();
      });
    });
  }

  stop(): void {
    this.wss?.close();
    this.server?.close();
  }
}

// ── Singleton ─────────────────────────────────────────────────

export const dashboardServer = new DashboardServer();
