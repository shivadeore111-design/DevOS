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
exports.commandGate = void 0;
// coordination/commandGate.ts — Approval gate for potentially dangerous operations.
//
// Any subsystem that is about to take an irreversible or high-impact action
// (e.g. computer control, file deletion, external API calls with side effects)
// must call commandGate.requestApproval() first.
//
// In interactive mode (DEVOS_AUTO_APPROVE not set) approval is requested via
// stdout/stdin prompt.  In headless/CI mode (DEVOS_AUTO_APPROVE=true) all
// requests are approved automatically and logged.
const readline = __importStar(require("readline"));
// ── CommandGate ───────────────────────────────────────────────
class CommandGate {
    constructor() {
        this.log = [];
    }
    /**
     * Request approval before executing a potentially dangerous operation.
     *
     * - DEVOS_AUTO_APPROVE=true  → always approves (CI/headless mode)
     * - DEVOS_HEADLESS=true      → always approves with a warning log
     * - Interactive               → prompts on stdout/stdin (y/N)
     *
     * @param action  Short human-readable description of what will happen.
     * @param reason  Context: why this action is being requested.
     * @param taskId  Optional task identifier for audit trail.
     */
    async requestApproval(action, reason, taskId) {
        const request = {
            action,
            reason,
            taskId,
            timestamp: new Date().toISOString(),
        };
        this.log.push(request);
        // Auto-approve in CI / headless environments
        if (process.env.DEVOS_AUTO_APPROVE === 'true' ||
            process.env.DEVOS_HEADLESS === 'true' ||
            process.env.CI === 'true') {
            console.log(`[CommandGate] ✅ Auto-approved: ${action}`);
            return true;
        }
        // Interactive prompt
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            });
            console.log('\n┌─────────────────────────────────────────────────┐');
            console.log('│  ⚠️  DevOS CommandGate — Approval Required        │');
            console.log('└─────────────────────────────────────────────────┘');
            console.log(`  Action : ${action}`);
            console.log(`  Reason : ${reason}`);
            if (taskId)
                console.log(`  Task   : ${taskId}`);
            console.log();
            rl.question('  Approve? [y/N] ', (answer) => {
                rl.close();
                const approved = answer.trim().toLowerCase() === 'y';
                console.log(approved ? '  ✅ Approved\n' : '  ❌ Rejected\n');
                resolve(approved);
            });
            // Timeout: auto-reject after 30 s if no input
            setTimeout(() => {
                rl.close();
                console.log('  ⏱  Timed out — rejected\n');
                resolve(false);
            }, 30000);
        });
    }
    /** Return the full audit log of all approval requests. */
    getLog() {
        return this.log;
    }
}
exports.commandGate = new CommandGate();
