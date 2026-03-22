// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// api/middleware/auth.ts — API key authentication middleware
// Uses require() with any-cast so no @types/express needed.

import * as fs   from "fs";
import * as path from "path";
import { auditLogger } from "../../security/auditLogger";

interface ApiConfig { apiKey: string; }

function loadApiKey(): string {
  if (process.env.DEVOS_API_KEY) return process.env.DEVOS_API_KEY;
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "config", "api.json"), "utf-8");
    return (JSON.parse(raw) as ApiConfig).apiKey ?? "";
  } catch { return ""; }
}

export function apiKeyAuth(req: any, res: any, next: any): void {
  const configuredKey = loadApiKey();
  const ip            = (req.ip ?? req.socket?.remoteAddress ?? "unknown") as string;

  console.log(`[API] Auth: ${req.method} ${req.path} — ${ip}`);

  // Dev mode: empty key skips auth — log as passthrough
  if (configuredKey === "") {
    auditLogger.log({
      timestamp: new Date().toISOString(),
      type:      "api_request",
      actor:     "dev-mode",
      action:    `${req.method} ${req.path}`,
      ip,
      success:   true,
    });
    next();
    return;
  }

  const authHeader = (req.headers["authorization"] ?? "") as string;
  const token      = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token || token !== configuredKey) {
    auditLogger.log({
      timestamp: new Date().toISOString(),
      type:      "auth_failed",
      actor:     "unknown",
      action:    `${req.method} ${req.path}`,
      detail:    token ? "Invalid token" : "Missing token",
      ip,
      success:   false,
    });
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  auditLogger.log({
    timestamp: new Date().toISOString(),
    type:      "api_request",
    actor:     "bearer",
    action:    `${req.method} ${req.path}`,
    ip,
    success:   true,
  });
  next();
}
