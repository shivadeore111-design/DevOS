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
exports.humanInTheLoop = void 0;
// coordination/humanInTheLoop.ts — User approval gate for dangerous actions
const readline = __importStar(require("readline"));
const eventBus_1 = require("../core/eventBus");
const APPROVAL_TIMEOUT_MS = 60000;
class HumanInTheLoop {
    constructor() {
        this.pendingApprovals = new Map();
    }
    async requestApproval(actionDescription, reason, taskId) {
        // Check Telegram first — if enabled, route approval through the bot
        try {
            const fs = require('fs');
            const path = require('path');
            const configPath = path.join(process.cwd(), 'config/integrations.json');
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                if (config.telegram?.enabled && config.telegram?.requireApprovalForDangerous) {
                    const { telegramApproval } = await Promise.resolve().then(() => __importStar(require('../integrations/telegram/telegramApproval')));
                    return telegramApproval.requestViaBot(actionDescription, taskId);
                }
            }
        }
        catch { /* fall through to CLI/SSE path */ }
        // CLI mode: prompt interactively
        if (process.env.DEVOS_MODE !== 'api') {
            return new Promise(resolve => {
                const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
                rl.question(`\n🔔 DevOS wants to: ${actionDescription}\nReason: ${reason}\nApprove? (y/N): `, (answer) => {
                    rl.close();
                    const a = answer.trim().toLowerCase();
                    const approved = a === 'y' || a === 'yes';
                    console.log(`[HumanInTheLoop] ${approved ? '✅ Approved' : '❌ Rejected'}: ${taskId}`);
                    resolve(approved);
                });
            });
        }
        // API mode: emit SSE event and wait for approve/reject
        return new Promise(resolve => {
            this.pendingApprovals.set(taskId, { resolve });
            eventBus_1.eventBus.emit('approval_required', { actionDescription, reason, taskId });
            console.log(`[HumanInTheLoop] ⏳ Waiting for approval on task ${taskId}`);
            // Auto-reject after timeout
            setTimeout(() => {
                if (this.pendingApprovals.has(taskId)) {
                    console.warn(`[HumanInTheLoop] ⏱️  Approval timeout for task ${taskId} — auto-rejected`);
                    this.pendingApprovals.delete(taskId);
                    resolve(false);
                }
            }, APPROVAL_TIMEOUT_MS);
        });
    }
    approve(taskId) {
        const pending = this.pendingApprovals.get(taskId);
        if (!pending) {
            console.warn(`[HumanInTheLoop] No pending approval for task ${taskId}`);
            return;
        }
        this.pendingApprovals.delete(taskId);
        console.log(`[HumanInTheLoop] ✅ Approved: ${taskId}`);
        pending.resolve(true);
    }
    reject(taskId, reason) {
        const pending = this.pendingApprovals.get(taskId);
        if (!pending) {
            console.warn(`[HumanInTheLoop] No pending approval for task ${taskId}`);
            return;
        }
        this.pendingApprovals.delete(taskId);
        console.log(`[HumanInTheLoop] ❌ Rejected: ${taskId}${reason ? ` — ${reason}` : ''}`);
        pending.resolve(false);
    }
}
exports.humanInTheLoop = new HumanInTheLoop();
