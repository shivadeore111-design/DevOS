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
import { apiKeyAuth }              from "./middleware/auth";
import { rateLimiter }             from "./middleware/rateLimit";
import { permissionCheck }         from "./middleware/permissions";
import { securityHeaders }         from "./middleware/securityHeaders";
import { requestLimits }           from "./middleware/requestLimits";
import { pathTraversalProtection } from "./middleware/pathTraversal";
import { ssrfProtection }          from "./middleware/ssrfProtection";
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
import { morningBriefingV2 }   from "../personal/morningBriefingV2";
import { lifeTimeline }        from "../personal/lifeTimeline";
import { backgroundAgents }    from "../personal/backgroundAgents";
import { dawnReport }          from "../personal/dawnReport";
import { lifeCanvas }          from "../personal/lifeCanvas";
import { alwaysOn }            from "../personal/alwaysOn";
import { devosBot }            from "../integrations/telegram/devosBot";
import { botNotifier }         from "../integrations/telegram/botNotifier";
// Legacy aliases — kept so any remaining references still compile
const telegramBot      = devosBot;
const telegramNotifier = botNotifier;
import { sandboxManager }         from "../sandbox/sandboxManager";
import { detectAndSelectModels }  from "../core/autoModelSelector";
import { devosAuth }              from "../auth/devosAuth";
import { billingEngine }          from "../billing/billingEngine";
import { enforceAccessGuard, getUsageSummary } from "../billing/accessGuard";

export function createApiServer(): any {
  const app = express();

  // 1. JSON body parsing
  app.use(express.json());

  // 2. Security headers (Layer 10) — applied first so every response is hardened
  app.use(securityHeaders);

  // 3. CORS
  app.use((req: any, res: any, next: any) => {
    res.setHeader("Access-Control-Allow-Origin",  "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") { res.sendStatus(200); return; }
    next();
  });

  // 4. Rate limiter (Layer 2)
  app.use(rateLimiter);

  // 5. Request size limiting (Layer 9) — before auth to avoid expensive auth on oversized payloads
  app.use(requestLimits);

  // 6. Path traversal prevention (Layer 8)
  app.use(pathTraversalProtection);

  // 7. Auth (skip only /api/system/health — public health check) (Layer 3)
  app.use((req: any, res: any, next: any) => {
    if (req.path === "/api/system/health") return next();
    return apiKeyAuth(req, res, next);
  });

  // 8. Permission check — role-based (Layer 1)
  app.use(permissionCheck);

  // 9. SSRF protection on routes that accept user-supplied URLs (Layer 7)
  app.use('/api/web',    ssrfProtection);
  app.use('/api/skills', ssrfProtection);

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

  // ── MCP (Model Context Protocol) ──────────────────────────────────────────

  // GET /api/mcp/tools — list all tools from connected MCP servers
  app.get('/api/mcp/tools', (_req: any, res: any) => {
    const { mcpClient: mcp } = require('../integrations/mcp/mcpClient')
    res.json(mcp.getTools())
  })

  // POST /api/mcp/call — call a tool on a connected MCP server
  app.post('/api/mcp/call', async (req: any, res: any) => {
    const { server, tool, args } = req.body ?? {}
    if (!server || !tool) {
      return res.status(400).json({ error: 'server and tool are required' })
    }
    const { mcpClient: mcp } = require('../integrations/mcp/mcpClient')
    try {
      const result = await mcp.callTool(server, tool, args ?? {})
      res.json({ result })
    } catch (err: any) {
      res.status(500).json({ error: err?.message })
    }
  })

  // ── Skills (SKILL.md pluggable skills) ────────────────────────────────────

  // GET /api/skills — list all SKILL.md skills with enabled status and tags
  app.get('/api/skills', (_req: any, res: any) => {
    const { skillLoader: loader } = require('../skills/skillLoader')
    res.json((loader.getAll() as any[]).map((s: any) => ({
      name:        s.meta.name,
      description: s.meta.description,
      enabled:     s.enabled,
      tags:        s.meta.tags ?? [],
      version:     s.meta.version,
      author:      s.meta.author,
    })))
  })

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

  // GET /api/personal/briefing — LLM-generated morning briefing (v2 uses persistent memory)
  app.get("/api/personal/briefing", async (_req: any, res: any) => {
    const briefing = await morningBriefingV2.generate();
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

  // GET /api/personal/dawn — daily morning briefing (cached per day)
  app.get("/api/personal/dawn", async (req: any, res: any) => {
    const force = req.query?.force === "true";
    const briefing = await dawnReport.generate(force);
    res.json({ briefing, generatedAt: new Date().toISOString() });
  });

  // GET /api/personal/canvas — all life canvas entries
  app.get("/api/personal/canvas", (_req: any, res: any) => {
    res.json(lifeCanvas.getAll());
  });

  // GET /api/personal/canvas/:goalId — canvas entries for a specific goal
  app.get("/api/personal/canvas/:goalId", (req: any, res: any) => {
    res.json(lifeCanvas.getCanvas(req.params.goalId));
  });

  // POST /api/personal/canvas — add a canvas entry
  app.post("/api/personal/canvas", (req: any, res: any) => {
    const { goalId, type, title, content, tags } = req.body || {};
    if (!type || !title || !content) {
      return res.status(400).json({ error: "type, title, content are required" });
    }
    const entry = lifeCanvas.addEntry({ goalId, type, title, content, tags });
    res.status(201).json(entry);
  });

  // GET /api/personal/always-on — status of permanent background pilots
  app.get("/api/personal/always-on", (_req: any, res: any) => {
    res.json(alwaysOn.summary());
  });

  // POST /api/personal/always-on/:name/enable
  app.post("/api/personal/always-on/:name/enable", (req: any, res: any) => {
    alwaysOn.enableAgent(req.params.name);
    res.json({ success: true });
  });

  // POST /api/personal/always-on/:name/disable
  app.post("/api/personal/always-on/:name/disable", (req: any, res: any) => {
    alwaysOn.disableAgent(req.params.name);
    res.json({ success: true });
  });

  // ── Sandbox routes ────────────────────────────────────────────────────────

  // GET /api/sandbox/status — list all active sandboxes
  
app.get("/api/models", async (_req: any, res: any) => {
  const http = require("http");
  const models = await new Promise<any[]>((resolve) => {
    const r = http.request({ hostname: "localhost", port: 11434, path: "/api/tags", method: "GET" }, (resp: any) => {
      let data = "";
      resp.on("data", (c: any) => data += c);
      resp.on("end", () => { try { resolve(JSON.parse(data).models || []); } catch { resolve([]); } });
    });
    r.on("error", () => resolve([]));
    r.setTimeout(5000, () => { r.destroy(); resolve([]); });
    r.end();
  });
  const { loadModelSelection } = require("../core/autoModelSelector");
  res.json({ models, selection: loadModelSelection() });
});
app.get("/api/sandbox/status", (_req: any, res: any) => {
    const sandboxes = sandboxManager.listActiveSandboxes()
    res.json({
      enabled:  process.env.DEVOS_SANDBOX === 'true',
      count:    sandboxes.length,
      sandboxes: sandboxes.map(s => ({
        taskId:      s.taskId,
        containerId: s.containerId.slice(0, 12),
        status:      s.status,
        createdAt:   s.createdAt,
        uptimeSec:   Math.floor((Date.now() - s.createdAt) / 1000),
      })),
    })
  })

  // GET /api/sandbox/:taskId/status — status for a specific sandbox
  app.get("/api/sandbox/:taskId/status", (req: any, res: any) => {
    const sandbox = sandboxManager.getSandbox(req.params.taskId)
    if (!sandbox) return res.status(404).json({ error: `No sandbox for task ${req.params.taskId}` })
    res.json({
      taskId:      sandbox.taskId,
      containerId: sandbox.containerId.slice(0, 12),
      status:      sandbox.status,
      createdAt:   sandbox.createdAt,
      uptimeSec:   Math.floor((Date.now() - sandbox.createdAt) / 1000),
    })
  })

  // POST /api/sandbox/clean — destroy all active sandboxes
  app.post("/api/sandbox/clean", async (_req: any, res: any) => {
    try {
      const before = sandboxManager.listActiveSandboxes().length
      await sandboxManager.cleanupAll()
      res.json({ destroyed: before, message: `Cleaned up ${before} sandbox(es)` })
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? String(e) })
    }
  })

  // ── Auth routes (/api/auth/*) — no apiKeyAuth, own JWT auth ──────────────

  // POST /api/auth/register
  app.post("/api/auth/register", async (req: any, res: any) => {
    const { email, password } = req.body ?? {}
    if (!email || !password) return res.status(400).json({ error: "email and password are required" })
    try {
      const result = await devosAuth.register(email, password)
      res.status(201).json(result)
    } catch (e: any) {
      res.status(400).json({ error: e?.message ?? "Registration failed" })
    }
  })

  // POST /api/auth/login
  app.post("/api/auth/login", async (req: any, res: any) => {
    const { email, password } = req.body ?? {}
    if (!email || !password) return res.status(400).json({ error: "email and password are required" })
    try {
      const result = await devosAuth.login(email, password)
      res.json(result)
    } catch (e: any) {
      res.status(401).json({ error: e?.message ?? "Login failed" })
    }
  })

  // POST /api/auth/logout
  app.post("/api/auth/logout", (req: any, res: any) => {
    const header = (req.headers["authorization"] as string) ?? ""
    const token  = header.startsWith("Bearer ") ? header.slice(7) : (req.body?.token as string) ?? ""
    if (token) devosAuth.logout(token)
    res.json({ success: true })
  })

  // GET /api/auth/me — return current user from JWT
  app.get("/api/auth/me", devosAuth.requireAuth(), (req: any, res: any) => {
    res.json({ user: req.devosUser })
  })

  // ── Billing routes (/api/billing/*) ──────────────────────────────────────

  // GET /api/billing/plans — public plan list
  app.get("/api/billing/plans", (_req: any, res: any) => {
    res.json(billingEngine.getPlans())
  })

  // GET /api/billing/usage — usage summary for authenticated user
  app.get("/api/billing/usage", devosAuth.requireAuth(), getUsageSummary)

  // POST /api/billing/subscribe { priceId } — create Stripe checkout session
  app.post("/api/billing/subscribe", devosAuth.requireAuth(), async (req: any, res: any) => {
    const { priceId, successUrl, cancelUrl } = req.body ?? {}
    if (!priceId) return res.status(400).json({ error: "priceId is required" })
    try {
      const user   = req.devosUser
      const result = await billingEngine.createCheckoutSession(user.id, priceId, successUrl, cancelUrl)
      res.json(result)
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "Failed to create checkout session" })
    }
  })

  // POST /api/billing/portal — create Stripe customer portal session
  app.post("/api/billing/portal", devosAuth.requireAuth(), async (req: any, res: any) => {
    try {
      const result = await billingEngine.createPortalSession(req.devosUser.id, req.body?.returnUrl)
      res.json(result)
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "Failed to create portal session" })
    }
  })

  // POST /api/billing/webhook — Stripe webhook (raw body required)
  // Must be registered BEFORE express.json() body parser modifies the body.
  // We handle raw parsing inline here.
  app.post("/api/billing/webhook",
    express.raw({ type: "application/json" }),
    async (req: any, res: any) => {
      const sig = (req.headers["stripe-signature"] as string) ?? ""
      try {
        const result = await billingEngine.handleWebhook(req.body as Buffer, sig)
        res.json(result)
      } catch (e: any) {
        res.status(400).json({ error: e?.message ?? "Webhook error" })
      }
    }
  )

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
    detectAndSelectModels().catch((e: any) => console.error('[AutoModelSelector] Failed:', e?.message ?? String(e)));
    proactiveEngine.start();
    telegramBot.start().catch((e: any) => console.error('[Telegram] Start failed:', e?.message ?? String(e)));
    telegramNotifier.start();
  });
  return app;
}

