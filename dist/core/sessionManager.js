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
exports.sessionManager = exports.SessionManager = void 0;
// core/sessionManager.ts — Persistent session lifecycle for agent runs
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const SESSIONS_FILE = path.join(process.cwd(), "workspace", "sessions.json");
function makeId() {
    return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
class SessionManager {
    constructor() {
        this.sessions = new Map();
        this.load();
    }
    // ── CRUD ─────────────────────────────────────────────────
    create(goal, workspacePath) {
        const now = new Date();
        const session = {
            id: makeId(),
            goal,
            workspacePath,
            history: [],
            memoryRefs: [],
            status: "active",
            createdAt: now,
            updatedAt: now,
        };
        this.sessions.set(session.id, session);
        this.persist();
        console.log(`[SessionManager] Session created: ${session.id}`);
        return session;
    }
    get(sessionId) {
        return this.sessions.get(sessionId) ?? null;
    }
    list() {
        return Array.from(this.sessions.values());
    }
    getActive() {
        return this.list().filter(s => s.status === "active");
    }
    // ── History ───────────────────────────────────────────────
    addHistory(sessionId, role, content) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        session.history.push({ role, content, timestamp: new Date() });
        session.updatedAt = new Date();
        this.persist();
    }
    // ── Status transitions ────────────────────────────────────
    pause(sessionId) {
        this.transition(sessionId, "paused");
    }
    resume(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return null;
        if (session.status === "paused") {
            session.status = "active";
            session.updatedAt = new Date();
            this.persist();
            console.log(`[SessionManager] Session resumed: ${sessionId}`);
        }
        return session;
    }
    complete(sessionId) {
        this.transition(sessionId, "completed");
        console.log(`[SessionManager] Session completed: ${sessionId}`);
    }
    fail(sessionId) {
        this.transition(sessionId, "failed");
        console.log(`[SessionManager] Session failed: ${sessionId}`);
    }
    // ── Persistence ───────────────────────────────────────────
    persist() {
        try {
            const dir = path.dirname(SESSIONS_FILE);
            if (!fs.existsSync(dir))
                fs.mkdirSync(dir, { recursive: true });
            const data = Array.from(this.sessions.values());
            fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2), "utf8");
        }
        catch (err) {
            console.warn("[SessionManager] Failed to persist sessions:", err);
        }
    }
    load() {
        try {
            if (!fs.existsSync(SESSIONS_FILE))
                return;
            const raw = fs.readFileSync(SESSIONS_FILE, "utf8");
            const data = JSON.parse(raw);
            for (const item of data) {
                // Revive Date fields
                item.createdAt = new Date(item.createdAt);
                item.updatedAt = new Date(item.updatedAt);
                if (Array.isArray(item.history)) {
                    item.history = item.history.map((h) => ({ ...h, timestamp: new Date(h.timestamp) }));
                }
                this.sessions.set(item.id, item);
            }
            console.log(`[SessionManager] Loaded ${this.sessions.size} session(s)`);
        }
        catch {
            // Sessions file missing or corrupt — start fresh
        }
    }
    // ── Internal ──────────────────────────────────────────────
    transition(sessionId, status) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        session.status = status;
        session.updatedAt = new Date();
        this.persist();
    }
}
exports.SessionManager = SessionManager;
exports.sessionManager = new SessionManager();
