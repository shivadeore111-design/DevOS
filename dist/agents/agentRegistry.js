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
exports.agentRegistry = exports.AgentRegistry = void 0;
// agents/agentRegistry.ts — Persistent registry of all agents
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const agentDefinitions_1 = require("./agentDefinitions");
class AgentRegistry {
    constructor() {
        this.agents = new Map();
        const ws = path.join(process.cwd(), 'workspace');
        this.filePath = path.join(ws, 'agents.json');
        fs.mkdirSync(ws, { recursive: true });
        this.load();
    }
    // ── Persistence ───────────────────────────────────────────
    load() {
        try {
            if (fs.existsSync(this.filePath)) {
                const raw = fs.readFileSync(this.filePath, 'utf-8');
                const arr = JSON.parse(raw);
                for (const a of arr)
                    this.agents.set(a.role, a);
            }
        }
        catch { /* start fresh */ }
        // Seed built-in agents if not yet persisted
        for (const def of agentDefinitions_1.BUILT_IN_AGENTS) {
            if (!this.agents.has(def.role)) {
                const agent = {
                    ...def,
                    id: crypto_1.default.randomBytes(6).toString('hex'),
                    status: 'idle',
                    completedTasks: 0,
                    failedTasks: 0,
                    createdAt: new Date(),
                };
                this.agents.set(agent.role, agent);
            }
        }
        this.save();
    }
    save() {
        const arr = Array.from(this.agents.values());
        fs.writeFileSync(this.filePath, JSON.stringify(arr, null, 2));
    }
    // ── Public API ────────────────────────────────────────────
    get(role) {
        return this.agents.get(role) ?? null;
    }
    list() {
        return Array.from(this.agents.values());
    }
    updateStatus(role, status, taskId) {
        const agent = this.agents.get(role);
        if (!agent)
            return;
        agent.status = status;
        agent.lastActiveAt = new Date();
        if (taskId !== undefined)
            agent.currentTaskId = taskId;
        if (status === 'idle')
            delete agent.currentTaskId;
        this.agents.set(role, agent);
        this.save();
    }
    recordCompletion(role, success) {
        const agent = this.agents.get(role);
        if (!agent)
            return;
        if (success)
            agent.completedTasks++;
        else
            agent.failedTasks++;
        this.agents.set(role, agent);
        this.save();
    }
}
exports.AgentRegistry = AgentRegistry;
exports.agentRegistry = new AgentRegistry();
