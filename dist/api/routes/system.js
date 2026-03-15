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
// api/routes/system.ts — System health and status endpoints
// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require("express");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const http_1 = __importDefault(require("http"));
const emergencyStop_1 = require("../../control/emergencyStop");
const sessionManager_1 = require("../../core/sessionManager");
const executionMemory_1 = require("../../memory/executionMemory");
const knowledgeStore_1 = require("../../knowledge/knowledgeStore");
const pilotRegistry_1 = require("../../devos/pilots/pilotRegistry");
const skillIndex_1 = require("../../skills/skillIndex");
const blueprintRegistry_1 = require("../../devos/product/blueprintRegistry");
const auditLogger_1 = require("../../security/auditLogger");
const router = express.Router();
const START_TIME = Date.now();
function readVersion() {
    try {
        const raw = fs.readFileSync(path.join(process.cwd(), "package.json"), "utf-8");
        return JSON.parse(raw).version ?? "unknown";
    }
    catch {
        return "unknown";
    }
}
function checkOllama() {
    return new Promise(resolve => {
        const req = http_1.default.get("http://localhost:11434/api/tags", res => {
            resolve(res.statusCode === 200);
        });
        req.on("error", () => resolve(false));
        req.setTimeout(2000, () => { req.destroy(); resolve(false); });
    });
}
// GET /api/system/health
router.get("/api/system/health", async (_req, res) => {
    const ollamaConnected = await checkOllama();
    res.json({ status: "ok", uptime: Math.floor((Date.now() - START_TIME) / 1000),
        version: readVersion(), ollamaConnected });
});
// GET /api/system/status
router.get("/api/system/status", async (_req, res) => {
    const ollamaConnected = await checkOllama();
    const activeSessions = sessionManager_1.sessionManager.getActive();
    res.json({
        status: "ok", version: readVersion(),
        uptime: Math.floor((Date.now() - START_TIME) / 1000),
        ollamaConnected,
        activeGoals: activeSessions.length,
        activeGoalIds: activeSessions.map(s => ({ id: s.id, goal: s.goal })),
        pilotsScheduled: pilotRegistry_1.pilotRegistry.listEnabled().length,
        totalPilots: pilotRegistry_1.pilotRegistry.list().length,
        memoryEntries: executionMemory_1.executionMemory.getAll().length,
        knowledgeEntries: knowledgeStore_1.knowledgeStore.list().length,
    });
});
// POST /api/system/stop
router.post("/api/system/stop", async (_req, res) => {
    await emergencyStop_1.emergencyStop.stopAll();
    res.json({ status: "stopped", message: "Emergency stop triggered for all active goals" });
});
// GET /api/system/sessions
router.get("/api/system/sessions", (_req, res) => {
    const sessions = sessionManager_1.sessionManager.list()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 50);
    res.json(sessions);
});
// GET /api/system/skills
router.get("/api/system/skills", (_req, res) => {
    res.json(skillIndex_1.skillIndex.getAll());
});
// GET /api/system/blueprints
router.get("/api/system/blueprints", (_req, res) => {
    res.json(blueprintRegistry_1.blueprintRegistry.list());
});
// GET /api/system/audit — last 50 audit entries (admin only)
// Supports ?type=<entryType> query param for filtering
router.get("/api/system/audit", (req, res) => {
    // Admin-only guard
    if (req.role && req.role !== "admin") {
        res.status(403).json({ error: "Audit log requires admin role" });
        return;
    }
    const typeFilter = req.query?.type;
    const entries = typeFilter
        ? auditLogger_1.auditLogger.getByType(typeFilter)
        : auditLogger_1.auditLogger.getRecent(50);
    res.json(entries);
});
exports.default = router;
