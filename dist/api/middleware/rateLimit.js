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
exports.rateLimiter = rateLimiter;
// api/middleware/rateLimit.ts — In-memory IP-based rate limiter (no external deps)
// Uses any-cast so no @types/express needed.
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function loadConfig() {
    try {
        const raw = fs.readFileSync(path.join(process.cwd(), "config", "api.json"), "utf-8");
        const cfg = JSON.parse(raw);
        return { windowMs: cfg.rateLimit?.windowMs ?? 60000, maxRequests: cfg.rateLimit?.maxRequests ?? 100 };
    }
    catch {
        return { windowMs: 60000, maxRequests: 100 };
    }
}
const ipMap = new Map();
// Auto-cleanup stale entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of ipMap.entries()) {
        if (now >= record.resetAt)
            ipMap.delete(ip);
    }
}, 5 * 60 * 1000);
function rateLimiter(req, res, next) {
    const { windowMs, maxRequests } = loadConfig();
    const ip = (req.ip ?? req.socket?.remoteAddress ?? "unknown");
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
