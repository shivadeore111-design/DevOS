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
import pilotsRouter         from "./routes/pilots";
import knowledgeRouter      from "./routes/knowledge";
import memoryRouter         from "./routes/memory";
import systemRouter         from "./routes/system";
import streamRouter         from "./routes/stream";

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

  // 6. Routes
  app.use(goalsRouter);
  app.use(pilotsRouter);
  app.use(knowledgeRouter);
  app.use(memoryRouter);
  app.use(systemRouter);
  app.use(streamRouter);

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
  });
  return app;
}
