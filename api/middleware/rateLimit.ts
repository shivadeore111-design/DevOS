// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// api/middleware/rateLimit.ts — In-memory IP-based rate limiter (no external deps)
// Uses any-cast so no @types/express needed.

import * as fs   from "fs";
import * as path from "path";

interface RateLimitRecord { count: number; resetAt: number; }
interface RateLimitConfig { windowMs: number; maxRequests: number; }

function loadConfig(): RateLimitConfig {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "config", "api.json"), "utf-8");
    const cfg = JSON.parse(raw);
    return { windowMs: cfg.rateLimit?.windowMs ?? 60000, maxRequests: cfg.rateLimit?.maxRequests ?? 100 };
  } catch { return { windowMs: 60000, maxRequests: 100 }; }
}

const ipMap = new Map<string, RateLimitRecord>();

// Auto-cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipMap.entries()) {
    if (now >= record.resetAt) ipMap.delete(ip);
  }
}, 5 * 60 * 1000);

export function rateLimiter(req: any, res: any, next: any): void {
  const { windowMs, maxRequests } = loadConfig();
  const ip  = (req.ip ?? req.socket?.remoteAddress ?? "unknown") as string;
  const now = Date.now();

  const record = ipMap.get(ip);

  if (!record || now >= record.resetAt) {
    ipMap.set(ip, { count: 1, resetAt: now + windowMs });
    next();
    return;
  }

  record.count += 1;
  if (record.count > maxRequests) {
    res.status(429).json({ error: "Too many requests", retryAfter: record.resetAt - now });
    return;
  }
  next();
}
