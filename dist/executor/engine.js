"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
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
exports.DevOSEngine = void 0;
// ============================================================
// engine.ts — DevOS Execution Engine
// Orchestrates action dispatch, decision layer, LLM tasks
// ============================================================
const decision_1 = require("../decision");
const fileActions_1 = require("./actions/fileActions");
const shellActions_1 = require("./actions/shellActions");
const webActions_1 = require("./actions/webActions");
const router_1 = require("../llm/router");
const openclaw_adapter_1 = require("../openclaw/openclaw-adapter");
const events_1 = require("../dashboard/events");
const controlKernel_1 = require("../control/controlKernel");
class DevOSEngine {
    constructor(workspace, dryRun = false) {
        this.workspace = workspace;
        this.dryRun = dryRun;
        this.decision = new decision_1.DecisionLayer(workspace);
        this.openclaw = new openclaw_adapter_1.OpenClawAdapter();
    }
    /**
     * Execute a single action — used by the GraphExecutor.
     * All action types are supported: file_write, shell_exec, web_fetch, llm_task, etc.
     */
    async executeOne(action, workspacePath, goalId) {
        const ws = workspacePath ?? this.workspace;
        if (this.dryRun) {
            console.log(`[Engine] DRY RUN — skipping: ${JSON.stringify(action)}`);
            return { success: true, output: { skipped: true } };
        }
        // ── Control Kernel: validate before execution ─────────
        const gid = goalId ?? "unknown";
        const validation = controlKernel_1.controlKernel.validate(action, gid);
        if (!validation.approved) {
            return { success: false, error: `[ControlKernel] Blocked: ${validation.reason}` };
        }
        const route = this.decision.decide(action, "low");
        if (route === "blocked") {
            return { success: false, error: `Blocked command: ${action.command ?? action.type}` };
        }
        if (route === "openclaw") {
            return this.openclaw.executeEscalation(action, ws);
        }
        switch (action.type) {
            case "file_write":
            case "file_append":
            case "file_read":
                return (0, fileActions_1.executeFileAction)(action, ws);
            case "shell_exec":
                return (0, shellActions_1.executeShellAction)(action, ws);
            case "web_fetch":
            case "web_search":
                return (0, webActions_1.executeWebAction)(action);
            case "llm_task": {
                const { content, provider, tokensEstimate } = await (0, router_1.llmCall)(action.query ?? action.description, action.systemPrompt);
                return { success: true, output: { content, provider, tokensEstimate } };
            }
            case "product_build": {
                const { productGenerator } = await Promise.resolve().then(() => __importStar(require("../devos/product/productGenerator")));
                const result = await productGenerator.generate(action.goal ?? action.description ?? "build product", action.blueprintId, ws);
                return {
                    success: result.status === "completed",
                    output: result,
                    error: result.status === "failed" ? `Product build failed: ${result.modulesFailed.join(", ")}` : undefined,
                };
            }
            default:
                return { success: false, error: `Unknown action type: ${action.type}` };
        }
    }
    // ── Legacy linear executor (kept for compatibility) ────────
    async execute(plan) {
        if (!plan?.actions?.length) {
            return { success: false, error: "Plan has no actions" };
        }
        console.log(`\n[Engine] Executing plan: "${plan.summary}" (${plan.actions.length} actions)`);
        const results = [];
        for (let i = 0; i < plan.actions.length; i++) {
            const action = plan.actions[i];
            console.log(`\n[Engine] Action ${i + 1}/${plan.actions.length}: ${action.type} — ${action.description ?? ""}`);
            if (this.dryRun) {
                console.log(`[Engine] DRY RUN — skipping: ${JSON.stringify(action)}`);
                results.push({ action, skipped: true });
                continue;
            }
            const route = this.decision.decide(action, plan.complexity);
            console.log(`[Engine] Decision: ${route}`);
            events_1.eventBus.emit({
                type: "step_started",
                payload: { step: i + 1, total: plan.actions.length, action, route },
                timestamp: new Date().toISOString(),
            });
            if (route === "blocked") {
                console.error(`[Engine] Action blocked: ${action.command ?? action.type}`);
                results.push({ action, blocked: true });
                events_1.eventBus.emit({
                    type: "step_failed",
                    payload: { step: i + 1, action, reason: "blocked" },
                    timestamp: new Date().toISOString(),
                });
                continue;
            }
            if (route === "openclaw") {
                const result = await this.openclaw.executeEscalation(action, this.workspace);
                results.push({ action, route: "openclaw", ...result });
                if (!result.success) {
                    return { success: false, error: result.error, output: results };
                }
                continue;
            }
            const result = await this.executeOne(action);
            results.push({ action, route: "executor", ...result });
            if (!result.success) {
                console.error(`[Engine] Action failed: ${result.error}`);
                events_1.eventBus.emit({
                    type: "step_failed",
                    payload: { step: i + 1, action, error: result.error },
                    timestamp: new Date().toISOString(),
                });
                return { success: false, error: result.error, output: results };
            }
            const emitType = action.type === "shell_exec" ? "command_executed" : "step_completed";
            events_1.eventBus.emit({
                type: emitType,
                payload: { step: i + 1, action, output: result.output },
                timestamp: new Date().toISOString(),
            });
        }
        console.log(`\n[Engine] ✅ All ${plan.actions.length} actions completed.`);
        return { success: true, output: results };
    }
}
exports.DevOSEngine = DevOSEngine;
