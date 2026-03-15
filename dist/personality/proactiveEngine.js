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
exports.proactiveEngine = void 0;
// personality/proactiveEngine.ts — Background engine that surfaces proactive messages
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const eventBus_1 = require("../core/eventBus");
const PROACTIVE_FILE = path.join(process.cwd(), 'workspace', 'proactive-messages.json');
const GOALS_FILE = path.join(process.cwd(), 'workspace', 'goals.json');
const CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes
const STALE_GOAL_MS = 2 * 60 * 60 * 1000; // 2 hours
const IDLE_USER_MS = 24 * 60 * 60 * 1000; // 24 hours
function loadStore() {
    try {
        if (fs.existsSync(PROACTIVE_FILE)) {
            return JSON.parse(fs.readFileSync(PROACTIVE_FILE, 'utf-8'));
        }
    }
    catch { /* start fresh */ }
    return { messages: [], lastChecked: new Date(0).toISOString() };
}
function saveStore(store) {
    const dir = path.dirname(PROACTIVE_FILE);
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PROACTIVE_FILE, JSON.stringify(store, null, 2));
}
function loadGoals() {
    try {
        if (fs.existsSync(GOALS_FILE)) {
            const raw = JSON.parse(fs.readFileSync(GOALS_FILE, 'utf-8'));
            return Array.isArray(raw) ? raw : raw?.goals ?? [];
        }
    }
    catch { /* ignore */ }
    return [];
}
class ProactiveEngine {
    constructor() {
        this.timer = null;
    }
    start() {
        if (this.timer)
            return;
        this.timer = setInterval(() => this.checkForMessages(), CHECK_INTERVAL);
        console.log('[ProactiveEngine] 🔔 Started — checking every 30 minutes');
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
            console.log('[ProactiveEngine] Stopped');
        }
    }
    checkForMessages() {
        const store = loadStore();
        const now = Date.now();
        const newMessages = [];
        // --- Check 1: Stale active goals (> 2 hours with no update) ---
        const goals = loadGoals();
        for (const goal of goals) {
            if (goal.status !== 'active' && goal.status !== 'running')
                continue;
            const updatedAt = goal.updatedAt ?? goal.createdAt ?? '';
            if (!updatedAt)
                continue;
            const ageMs = now - new Date(updatedAt).getTime();
            if (ageMs < STALE_GOAL_MS)
                continue;
            // Don't re-surface the same goal if already notified recently
            const alreadyNotified = store.messages.some(m => m.type === 'stale_goal' && m.message.includes(goal.id) && !m.shown);
            if (alreadyNotified)
                continue;
            newMessages.push({
                id: `pm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                type: 'stale_goal',
                message: `Goal "${goal.title}" (${goal.id}) has been active for ${Math.round(ageMs / 3600000)}h with no updates. Should I retry or cancel it?`,
                createdAt: new Date().toISOString(),
                shown: false,
            });
        }
        // --- Check 2: No goals submitted in 24 hours ---
        const recentGoal = goals
            .map((g) => new Date(g.createdAt ?? 0).getTime())
            .sort((a, b) => b - a)[0] ?? 0;
        if (goals.length > 0 && now - recentGoal > IDLE_USER_MS) {
            const alreadyNotified = store.messages.some(m => m.type === 'idle_prompt' && !m.shown);
            if (!alreadyNotified) {
                newMessages.push({
                    id: `pm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    type: 'idle_prompt',
                    message: 'You haven\'t submitted a goal in 24 hours. Ready to build something new?',
                    createdAt: new Date().toISOString(),
                    shown: false,
                });
            }
        }
        if (newMessages.length > 0) {
            store.messages.push(...newMessages);
            store.lastChecked = new Date().toISOString();
            saveStore(store);
            for (const msg of newMessages) {
                eventBus_1.eventBus.emit('devos_proactive', msg);
                console.log(`[ProactiveEngine] 💡 ${msg.type}: ${msg.message.slice(0, 80)}`);
            }
        }
        else {
            store.lastChecked = new Date().toISOString();
            saveStore(store);
        }
    }
    markShown(id) {
        const store = loadStore();
        const msg = store.messages.find(m => m.id === id);
        if (msg) {
            msg.shown = true;
            saveStore(store);
        }
    }
    getUnshown() {
        return loadStore().messages.filter(m => !m.shown);
    }
    getAll() {
        return loadStore().messages;
    }
}
exports.proactiveEngine = new ProactiveEngine();
