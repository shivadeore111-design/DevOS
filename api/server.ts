// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// api/server.ts — DevOS REST API server
// Uses require() with any-cast so no @types/express needed.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require("express") as any;

import * as fs    from "fs";
import * as path  from "path";
import { apiKeyAuth }       from "./middleware/auth";
import { rateLimiter }      from "./middleware/rateLimit";
import { permissionCheck }  from "./middleware/permissions";
import goalsRouter          from "./routes/goals";
import goalsV2Router        from "./routes/goals_v2";
import agentsRouter         from "./routes/agents";
import pilotsRouter         from "./routes/pilots";
import knowledgeRouter      from "./routes/knowledge";
import memoryRouter         from "./routes/memory";
import systemRouter         from "./routes/system";
import streamRouter         from "./routes/stream";
import deployRouter         from "./routes/deploy";
import missionsRouter       from "./routes/missions";
import { dialogueEngine }     from "../personality/dialogueEngine";
import { conversationMemory }  from "../personality/conversationMemory";
import { proactiveEngine }     from "../personality/proactiveEngine";
import { morningBriefing }     from "../personal/morningBriefing";
import { lifeTimeline }        from "../personal/lifeTimeline";
import { backgroundAgents }    from "../personal/backgroundAgents";
import { telegramBot }         from "../integrations/telegram/telegramBot";
import { telegramNotifier }    from "../integrations/telegram/telegramNotifier";

export function createApiServer(): any {
  const app = express();

  // 1. JSON body parsing
  app.use(express.json());

  // 2. CORS
  app.use((req: any, res: any, next: any) => {
    res.setHeader("Access-Control-Allow-Origin",  "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") { res.sendStatus(200); return; }
    next();
  });

  // 3. Rate limiter
  app.use(rateLimiter);

  // 4. Auth (skip only /api/system/health — public health check)
  app.use((req: any, res: any, next: any) => {
    if (req.path === "/api/system/health") return next();
    return apiKeyAuth(req, res, next);
  });

  // 5. Permission check (role-based)
  app.use(permissionCheck);

  // Swagger docs
  app.get("/api/docs", (_req: any, res: any) => {
    res.json(generateSwaggerSpec());
  });

  // 6. Routes — goalsV2 must come before goalsRouter to prevent /api/goals/:id catching /api/goals/v2
  app.use(goalsV2Router);
  app.use(goalsRouter);
  app.use(agentsRouter);
  app.use(pilotsRouter);
  app.use(knowledgeRouter);
  app.use(memoryRouter);
  app.use(systemRouter);
  app.use(streamRouter);
  app.use(deployRouter);
  app.use(missionsRouter);

  // ── Personality / Chat routes ──────────────────────────────────────────────

  // POST /api/chat — SSE streaming chat response
  app.post("/api/chat", async (req: any, res: any) => {
    const message = req.body?.message as string | undefined;
    if (!message?.trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    res.setHeader("Content-Type",  "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection",    "keep-alive");
    res.flushHeaders?.();

    try {
      for await (const chunk of dialogueEngine.chat(message)) {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }
    } catch (err: any) {
      res.write(`data: ${JSON.stringify({ error: err?.message ?? "stream error" })}\n\n`);
    } finally {
      res.write("data: [DONE]\n\n");
      res.end();
    }
  });

  // GET /api/chat/history — last 50 conversation messages
  app.get("/api/chat/history", (_req: any, res: any) => {
    const messages = conversationMemory.getRecentMessages(50);
    res.json(messages);
  });

  // GET /api/chat/proactive — unshown proactive messages
  app.get("/api/chat/proactive", (req: any, res: any) => {
    const id = req.query?.markShown as string | undefined;
    if (id) proactiveEngine.markShown(id);
    res.json(proactiveEngine.getUnshown());
  });

  // ── Personal Mode routes ───────────────────────────────────────────────────

  // GET /api/personal/briefing — LLM-generated morning briefing
  app.get("/api/personal/briefing", async (_req: any, res: any) => {
    const briefing = await morningBriefing.generate();
    res.json({ briefing });
  });

  // GET /api/personal/timeline — all life-timeline entries
  app.get("/api/personal/timeline", (_req: any, res: any) => {
    res.json(lifeTimeline.getTimeline());
  });

  // GET /api/personal/agents — list background agents + status
  app.get("/api/personal/agents", (_req: any, res: any) => {
    res.json(backgroundAgents.listAgents());
  });

  // POST /api/personal/agents/:name/enable
  app.post("/api/personal/agents/:name/enable", async (req: any, res: any) => {
    try {
      await backgroundAgents.enableAgent(req.params.name);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // POST /api/personal/agents/:name/disable
  app.post("/api/personal/agents/:name/disable", async (req: any, res: any) => {
    try {
      await backgroundAgents.disableAgent(req.params.name);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  return app;
}

function generateSwaggerSpec() {
  return {
    openapi: "3.0.0",
    info: {
      title:       "DevOS API",
      version:     "1.0.0",
      description: "DevOS autonomous AI operating system REST API",
    },
    paths: {
      "/api/goals":                { post: { summary: "Submit a goal (async or sync)" },
                                     get:  { summary: "List recent goals (last 20)" } },
      "/api/goals/v2":             { post: { summary: "Create + plan + execute a structured goal" },
                                     get:  { summary: "List all Goal Engine goals" } },
      "/api/goals/v2/{id}":        { get:  { summary: "Full goal status: goal + projects + tasks" } },
      "/api/goals/v2/{id}/pause":  { post: { summary: "Pause goal execution" } },
      "/api/goals/v2/{id}/resume": { post: { summary: "Resume paused goal" } },
      "/api/goals/v2/{id}/replan": { post: { summary: "Replan a failed goal" } },
      "/api/agents":               { get:  { summary: "List all agents with status" } },
      "/api/agents/messages":      { get:  { summary: "Recent agent messages (last 50)" } },
      "/api/agents/messages/{id}": { get:  { summary: "Message thread for task/goal id" } },
      "/api/agents/{role}":        { get:  { summary: "Agent detail + recent messages" } },
      "/api/agents/coordinate":    { post: { summary: "Start coordination loop for a goal" } },
      "/api/goals/{id}":           { get:    { summary: "Get goal detail" },
                                     delete: { summary: "Cancel a running goal" } },
      "/api/goals/{id}/retry":     { post: { summary: "Retry a failed goal" } },
      "/api/pilots":               { get: { summary: "List all pilots" } },
      "/api/pilots/{id}":          { get: { summary: "Get pilot detail + last 5 runs" },
                                     put: { summary: "Update pilot manifest" } },
      "/api/pilots/{id}/run":      { post: { summary: "Trigger pilot immediately" } },
      "/api/pilots/{id}/enable":   { post: { summary: "Enable pilot" } },
      "/api/pilots/{id}/disable":  { post: { summary: "Disable pilot" } },
      "/api/pilots/{id}/history":  { get:  { summary: "Get full pilot run history" } },
      "/api/knowledge":            { get: { summary: "List all knowledge entries" } },
      "/api/knowledge/ingest":     { post: { summary: "Ingest file, URL, or text" } },
      "/api/knowledge/query":      { post: { summary: "Query knowledge base" } },
      "/api/knowledge/{id}":       { get:    { summary: "Get knowledge entry" },
                                     delete: { summary: "Delete knowledge entry" } },
      "/api/memory":               { get: { summary: "List execution memory entries" } },
      "/api/memory/stats":         { get: { summary: "Memory statistics" } },
      "/api/memory/prune":         { delete: { summary: "Prune low-quality entries" } },
      "/api/memory/{goalType}":    { get: { summary: "Memory for specific goal type" } },
      "/api/system/health":        { get:  { summary: "Health check (no auth required)" } },
      "/api/system/status":        { get:  { summary: "Full system status" } },
      "/api/system/stop":          { post: { summary: "Emergency stop all goals" } },
      "/api/system/sessions":      { get:  { summary: "Recent agent sessions" } },
      "/api/system/skills":        { get:  { summary: "All indexed skills" } },
      "/api/system/blueprints":    { get:  { summary: "All product blueprints" } },
      "/api/system/audit":         { get:  { summary: "Audit log (admin only)" } },
      "/api/stream":               { get:  { summary: "SSE all DevOS events" } },
      "/api/stream/goals/{id}":    { get:  { summary: "SSE stream for one goal" } },
      "/api/deploy/vercel/projects":                         { get:  { summary: "List all Vercel projects" } },
      "/api/deploy/vercel/deployments/{name}":               { get:  { summary: "List deployments for a Vercel project" } },
      "/api/deploy/vercel/{name}":                           { post: { summary: "Deploy a directory to Vercel" } },
      "/api/deploy/railway/projects":                        { get:  { summary: "List all Railway projects" } },
      "/api/deploy/railway/{projectId}/deploy/{serviceId}":  { post: { summary: "Trigger Railway service deploy" } },
      "/api/missions":                  { post: { summary: "Start an autonomous mission" }, get: { summary: "List all missions" } },
      "/api/missions/{id}":             { get:  { summary: "Mission detail + task queue" } },
      "/api/missions/{id}/todo":        { get:  { summary: "Mission TODO markdown" } },
      "/api/missions/{id}/pause":       { post: { summary: "Pause a running mission" } },
      "/api/missions/{id}/resume":      { post: { summary: "Resume a paused mission" } },
      "/api/missions/{id}/cancel":      { post: { summary: "Cancel a mission" } },
      "/api/coordination/approve":      { post: { summary: "Approve a human-in-the-loop task" } },
      "/api/coordination/reject":       { post: { summary: "Reject a human-in-the-loop task" } },
      "/api/chat":                              { post: { summary: "SSE streaming chat with DevOS personality" } },
      "/api/chat/history":                      { get:  { summary: "Last 50 conversation messages" } },
      "/api/chat/proactive":                    { get:  { summary: "Unshown proactive messages (pass ?markShown=id to ack)" } },
      "/api/personal/briefing":                 { get:  { summary: "LLM-generated morning briefing" } },
      "/api/personal/timeline":                 { get:  { summary: "Full life-timeline entries" } },
      "/api/personal/agents":                   { get:  { summary: "List background agents with status + schedule" } },
      "/api/personal/agents/:name/enable":      { post: { summary: "Enable a background agent" } },
      "/api/personal/agents/:name/disable":     { post: { summary: "Disable a background agent" } },
    },
  };
}

export function startApiServer(portArg?: number): any {
  const cfgPath   = path.join(process.cwd(), "config", "api.json");
  const apiConfig = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
  const host      = (apiConfig.host as string) || "127.0.0.1";
  const port      = (portArg ?? apiConfig.port ?? 4200) as number;

  const app = createApiServer();
  app.listen(port, host, () => {
    console.log(`[API] 🚀 DevOS API running at http://${host}:${port}`);
    console.log(`[API] 🔒 Bound to ${host} — localhost only`);
    console.log(`[API] 📖 Docs at http://${host}:${port}/api/docs`);
    proactiveEngine.start();
    telegramBot.start().catch((e: any) => console.error('[Telegram] Start failed:', e?.message ?? String(e)));
    telegramNotifier.start();
  });
  return app;
}
