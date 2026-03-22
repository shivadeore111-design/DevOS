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
exports.agentMessenger = exports.AgentMessenger = void 0;
// agents/agentMessenger.ts — Inter-agent message bus with persistence
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const eventBus_1 = require("../core/eventBus");
class AgentMessenger {
    constructor() {
        this.messages = [];
        this.MAX_MESSAGES = 500;
        const ws = path.join(process.cwd(), 'workspace');
        this.filePath = path.join(ws, 'agent-messages.json');
        fs.mkdirSync(ws, { recursive: true });
        this.load();
    }
    // ── Persistence ───────────────────────────────────────────
    load() {
        try {
            if (fs.existsSync(this.filePath)) {
                const raw = fs.readFileSync(this.filePath, 'utf-8');
                this.messages = JSON.parse(raw);
            }
        }
        catch {
            this.messages = [];
        }
    }
    save() {
        // Keep only last MAX_MESSAGES
        if (this.messages.length > this.MAX_MESSAGES) {
            this.messages = this.messages.slice(-this.MAX_MESSAGES);
        }
        fs.writeFileSync(this.filePath, JSON.stringify(this.messages, null, 2));
    }
    // ── Public API ────────────────────────────────────────────
    send(from, to, content, type, taskId, goalId) {
        const msg = {
            id: crypto_1.default.randomBytes(6).toString('hex'),
            fromAgent: from,
            toAgent: to,
            content,
            type,
            taskId,
            goalId,
            timestamp: new Date(),
        };
        this.messages.push(msg);
        this.save();
        // Emit on event bus for SSE streaming
        eventBus_1.eventBus.emit('agent_message', msg);
        const toLabel = (to === 'all' || to === 'user') ? to.toUpperCase() : to.toUpperCase();
        console.log(`[AgentMessenger] ${from.toUpperCase()} → ${toLabel} [${type}]: ${content.slice(0, 80)}${content.length > 80 ? '…' : ''}`);
        return msg;
    }
    getThread(taskId) {
        return this.messages.filter(m => m.taskId === taskId || m.goalId === taskId);
    }
    getRecent(limit = 50) {
        return this.messages.slice(-limit);
    }
}
exports.AgentMessenger = AgentMessenger;
exports.agentMessenger = new AgentMessenger();
