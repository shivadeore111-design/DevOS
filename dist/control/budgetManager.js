"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.budgetManager = exports.BudgetManager = void 0;
// control/budgetManager.ts — Per-goal retry, runtime and token budget tracking
const policyEngine_1 = require("./policyEngine");
class BudgetManager {
    constructor() {
        this.budgets = new Map();
    }
    // ── Initialise budget for a new goal ───────────────────
    ensureBudget(goalId) {
        if (!this.budgets.has(goalId)) {
            this.budgets.set(goalId, {
                retryCount: 0,
                startTimeMs: Date.now(),
                tokenUsage: 0,
            });
        }
        return this.budgets.get(goalId);
    }
    // ── Retry gate ──────────────────────────────────────────
    canRetry(goalId) {
        const budget = this.ensureBudget(goalId);
        const policy = policyEngine_1.policyEngine.getPolicy();
        return budget.retryCount < policy.maxRetries;
    }
    recordRetry(goalId) {
        const budget = this.ensureBudget(goalId);
        budget.retryCount += 1;
    }
    // ── Continuation gate (runtime + memory) ───────────────
    canContinue(goalId) {
        const budget = this.ensureBudget(goalId);
        const policy = policyEngine_1.policyEngine.getPolicy();
        const runtimeMs = Date.now() - budget.startTimeMs;
        if (runtimeMs > policy.maxRuntimeMs) {
            return {
                allowed: false,
                reason: `Runtime limit exceeded: ${Math.round(runtimeMs / 1000)}s > ${policy.maxRuntimeMs / 1000}s`,
            };
        }
        // RSS memory check (best-effort — process.memoryUsage is current process)
        const memMb = process.memoryUsage().rss / 1024 / 1024;
        if (memMb > policy.maxMemoryMb) {
            return {
                allowed: false,
                reason: `Memory limit exceeded: ${memMb.toFixed(0)} MB > ${policy.maxMemoryMb} MB`,
            };
        }
        return { allowed: true };
    }
    // ── Token tracking ──────────────────────────────────────
    recordTokens(goalId, tokens) {
        const budget = this.ensureBudget(goalId);
        budget.tokenUsage += tokens;
    }
    // ── Summary ─────────────────────────────────────────────
    getSummary(goalId) {
        const budget = this.ensureBudget(goalId);
        const policy = policyEngine_1.policyEngine.getPolicy();
        return {
            goalId,
            retryCount: budget.retryCount,
            maxRetries: policy.maxRetries,
            runtimeMs: Date.now() - budget.startTimeMs,
            maxRuntimeMs: policy.maxRuntimeMs,
            tokenUsage: budget.tokenUsage,
            memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        };
    }
    // ── Cleanup ─────────────────────────────────────────────
    clear(goalId) {
        this.budgets.delete(goalId);
    }
}
exports.BudgetManager = BudgetManager;
exports.budgetManager = new BudgetManager();
