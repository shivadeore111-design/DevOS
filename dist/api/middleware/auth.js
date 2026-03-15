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
exports.apiKeyAuth = apiKeyAuth;
// api/middleware/auth.ts — API key authentication middleware
// Uses require() with any-cast so no @types/express needed.
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const auditLogger_1 = require("../../security/auditLogger");
function loadApiKey() {
    if (process.env.DEVOS_API_KEY)
        return process.env.DEVOS_API_KEY;
    try {
        const raw = fs.readFileSync(path.join(process.cwd(), "config", "api.json"), "utf-8");
        return JSON.parse(raw).apiKey ?? "";
    }
    catch {
        return "";
    }
}
function apiKeyAuth(req, res, next) {
    const configuredKey = loadApiKey();
    const ip = (req.ip ?? req.socket?.remoteAddress ?? "unknown");
    console.log(`[API] Auth: ${req.method} ${req.path} — ${ip}`);
    // Dev mode: empty key skips auth — log as passthrough
    if (configuredKey === "") {
        auditLogger_1.auditLogger.log({
            timestamp: new Date().toISOString(),
            type: "api_request",
            actor: "dev-mode",
            action: `${req.method} ${req.path}`,
            ip,
            success: true,
        });
        next();
        return;
    }
    const authHeader = (req.headers["authorization"] ?? "");
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token || token !== configuredKey) {
        auditLogger_1.auditLogger.log({
            timestamp: new Date().toISOString(),
            type: "auth_failed",
            actor: "unknown",
            action: `${req.method} ${req.path}`,
            detail: token ? "Invalid token" : "Missing token",
            ip,
            success: false,
        });
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    auditLogger_1.auditLogger.log({
        timestamp: new Date().toISOString(),
        type: "api_request",
        actor: "bearer",
        action: `${req.method} ${req.path}`,
        ip,
        success: true,
    });
    next();
}
