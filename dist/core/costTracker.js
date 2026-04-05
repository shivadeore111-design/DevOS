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
exports.costTracker = void 0;
// core/costTracker.ts — Token usage and cost tracking for every LLM call.
// Hooked into callLLM in agentLoop.ts.
// Background (system) costs are tracked separately from user budget.
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const eventBus_1 = require("./eventBus");
// ── Pricing (per million tokens) ─────────────────────────────
const PRICING = {
    'groq': { input: 0, output: 0 },
    'gemini': { input: 0, output: 0 },
    'cerebras': { input: 0, output: 0 },
    'openrouter': { input: 0.14, output: 0.28 },
    'ollama': { input: 0, output: 0 },
    'nvidia': { input: 0, output: 0 },
    'cloudflare': { input: 0, output: 0 },
    'github': { input: 0, output: 0 },
};
// ── Paths ─────────────────────────────────────────────────────
const COST_DIR = path_1.default.join(process.cwd(), 'workspace', 'cost');
// ── CostTracker ───────────────────────────────────────────────
class CostTracker {
    constructor() {
        this.todayRecords = [];
        this.lastDate = '';
        this.budgetEnforced = false;
        try {
            fs_1.default.mkdirSync(COST_DIR, { recursive: true });
        }
        catch { }
        this.refreshDay();
    }
    // ── Day management ─────────────────────────────────────────
    dateKey() {
        return new Date().toISOString().slice(0, 10);
    }
    logPath() {
        return path_1.default.join(COST_DIR, `${this.dateKey()}.jsonl`);
    }
    refreshDay() {
        const today = this.dateKey();
        if (today === this.lastDate)
            return;
        this.lastDate = today;
        this.budgetEnforced = false;
        const p = this.logPath();
        if (!fs_1.default.existsSync(p)) {
            this.todayRecords = [];
            return;
        }
        try {
            this.todayRecords = fs_1.default.readFileSync(p, 'utf-8')
                .trim().split('\n').filter(Boolean)
                .map(l => { try {
                return JSON.parse(l);
            }
            catch {
                return null;
            } })
                .filter((r) => r !== null);
        }
        catch {
            this.todayRecords = [];
        }
    }
    // ── Main tracking call ─────────────────────────────────────
    trackUsage(provider, model, inputTokens, outputTokens, traceId, isSystem = false) {
        this.refreshDay();
        const pricing = PRICING[provider] ?? { input: 0, output: 0 };
        const costUSD = (inputTokens * pricing.input + outputTokens * pricing.output) / 1000000;
        const record = {
            ts: Date.now(),
            provider,
            model,
            inputTokens,
            outputTokens,
            costUSD,
            traceId,
            isSystem,
        };
        this.todayRecords.push(record);
        try {
            fs_1.default.appendFileSync(this.logPath(), JSON.stringify(record) + '\n');
        }
        catch (e) {
            console.error('[CostTracker] Write failed:', e.message);
        }
        // Budget enforcement — only for user calls, only trigger once per day
        if (!isSystem && !this.budgetEnforced) {
            const userTotal = this.getDailyUserCost();
            const budget = this.getDailyBudget();
            if (userTotal >= budget) {
                this.budgetEnforced = true;
                this.enforceBudgetCap(userTotal, budget);
            }
        }
        // Emit event for dashboard
        try {
            eventBus_1.eventBus.emit('cost_update', this.getDailySummary());
        }
        catch { }
    }
    // ── Accessors ──────────────────────────────────────────────
    getDailyBudget() {
        try {
            const cfgPath = path_1.default.join(process.cwd(), 'config', 'devos.config.json');
            const raw = JSON.parse(fs_1.default.readFileSync(cfgPath, 'utf-8'));
            return typeof raw.dailyBudgetUSD === 'number' ? raw.dailyBudgetUSD : 5.00;
        }
        catch {
            return 5.00;
        }
    }
    getDailyUserCost() {
        this.refreshDay();
        return this.todayRecords
            .filter(r => !r.isSystem)
            .reduce((s, r) => s + r.costUSD, 0);
    }
    getDailySystemCost() {
        this.refreshDay();
        return this.todayRecords
            .filter(r => r.isSystem)
            .reduce((s, r) => s + r.costUSD, 0);
    }
    getDailySummary() {
        this.refreshDay();
        const byProvider = {};
        let totalUSD = 0, systemUSD = 0, userUSD = 0;
        for (const r of this.todayRecords) {
            byProvider[r.provider] = (byProvider[r.provider] ?? 0) + r.costUSD;
            totalUSD += r.costUSD;
            if (r.isSystem)
                systemUSD += r.costUSD;
            else
                userUSD += r.costUSD;
        }
        return {
            date: this.dateKey(),
            totalUSD,
            systemUSD,
            userUSD,
            byProvider,
        };
    }
    getTraceTotal(traceId) {
        this.refreshDay();
        return this.todayRecords
            .filter(r => r.traceId === traceId)
            .reduce((s, r) => s + r.costUSD, 0);
    }
    formatUserCost() {
        const usd = this.getDailyUserCost();
        return `$${usd.toFixed(2)} today`;
    }
    // ── Budget enforcement ─────────────────────────────────────
    enforceBudgetCap(userTotal, budget) {
        console.warn(`[CostTracker] Daily budget cap $${budget} reached ($${userTotal.toFixed(4)} used) — switching to Ollama`);
        // Switch routing to Ollama-only
        try {
            const configPath = path_1.default.join(process.cwd(), 'config', 'devos.config.json');
            const raw = JSON.parse(fs_1.default.readFileSync(configPath, 'utf-8'));
            raw.routing = { ...raw.routing, mode: 'manual' };
            raw.model = { ...raw.model, active: 'ollama' };
            fs_1.default.writeFileSync(configPath, JSON.stringify(raw, null, 2));
        }
        catch (e) {
            console.error('[CostTracker] Failed to switch to Ollama:', e.message);
        }
        // Desktop notification — fire-and-forget
        Promise.resolve().then(() => __importStar(require('./toolRegistry'))).then(({ executeTool }) => {
            executeTool('notify', {
                message: `DevOS daily budget cap ($${budget}) reached. Switched to Ollama to prevent overspending.`,
            }).catch(() => { });
        }).catch(() => { });
    }
}
// ── Singleton ──────────────────────────────────────────────────
exports.costTracker = new CostTracker();
