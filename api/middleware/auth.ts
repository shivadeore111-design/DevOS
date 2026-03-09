// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// api/middleware/auth.ts — API key authentication middleware
// Uses require() with any-cast so no @types/express needed.

import * as fs   from "fs";
import * as path from "path";

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
  const ip            = req.ip ?? req.socket?.remoteAddress ?? "unknown";

  console.log(`[API] Auth: ${req.method} ${req.path} — ${ip}`);

  // Dev mode: empty key skips auth
  if (configuredKey === "") { next(); return; }

  const authHeader = (req.headers["authorization"] ?? "") as string;
  const token      = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token || token !== configuredKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
