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
exports.executionMemory = exports.ExecutionMemory = void 0;
// memory/executionMemory.ts — Persist and recall successful/failed execution patterns
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const MEMORY_FILE = path.join(process.cwd(), "memory", "execution-memory.json");
function makeId() {
    return `em_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
class ExecutionMemory {
    constructor() {
        this.entries = new Map();
        this.load();
    }
    // ── Store ─────────────────────────────────────────────────
    store(entry) {
        const id = makeId();
        const rec = {
            ...entry,
            id,
            timestamp: new Date(),
            useCount: 0,
            successRate: entry.outcome === "success" ? 1.0 : 0.0,
        };
        this.entries.set(id, rec);
        this.persist();
        console.log(`[ExecutionMemory] Stored ${entry.outcome} entry for "${entry.pattern.slice(0, 50)}"`);
    }
    // ── Lookup ────────────────────────────────────────────────
    lookup(parsedGoal) {
        const goalType = parsedGoal?.type ?? "";
        const domain = parsedGoal?.domain ?? "";
        const stack = parsedGoal?.stack ?? [];
        let best = null;
        let bestScore = 0;
        for (const entry of this.entries.values()) {
            let score = 0;
            if (entry.goalType === goalType)
                score += 3;
            if (entry.domain === domain)
                score += 2;
            const stackOverlap = stack.filter(s => entry.stack.includes(s)).length;
            score += stackOverlap;
            if (score > bestScore) {
                bestScore = score;
                best = entry;
            }
        }
        // Require at least goalType + domain match (score ≥ 5)
        return bestScore >= 5 ? best : null;
    }
    // ── Record use ────────────────────────────────────────────
    recordUse(id, success) {
        const entry = this.entries.get(id);
        if (!entry)
            return;
        entry.useCount++;
        // Rolling average
        entry.successRate = (entry.successRate * (entry.useCount - 1) + (success ? 1 : 0)) / entry.useCount;
        this.persist();
    }
    // ── Top patterns ─────────────────────────────────────────
    getTopPatterns(limit = 10) {
        return Array.from(this.entries.values())
            .sort((a, b) => (b.successRate * b.useCount) - (a.successRate * a.useCount))
            .slice(0, limit);
    }
    // ── Prune ─────────────────────────────────────────────────
    prune() {
        let pruned = 0;
        for (const [id, entry] of this.entries) {
            if (entry.successRate < 0.2 && entry.useCount > 5) {
                this.entries.delete(id);
                pruned++;
            }
        }
        if (pruned) {
            this.persist();
            console.log(`[ExecutionMemory] Pruned ${pruned} low-quality entries`);
        }
        return pruned;
    }
    getAll() {
        return Array.from(this.entries.values());
    }
    // ── Persistence ───────────────────────────────────────────
    persist() {
        try {
            const dir = path.dirname(MEMORY_FILE);
            if (!fs.existsSync(dir))
                fs.mkdirSync(dir, { recursive: true });
            const data = Array.from(this.entries.values());
            fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2), "utf8");
        }
        catch (err) {
            console.warn("[ExecutionMemory] Failed to persist:", err);
        }
    }
    load() {
        try {
            if (!fs.existsSync(MEMORY_FILE))
                return;
            const raw = fs.readFileSync(MEMORY_FILE, "utf8");
            const data = JSON.parse(raw);
            for (const item of data) {
                item.timestamp = new Date(item.timestamp);
                this.entries.set(item.id, item);
            }
            console.log(`[ExecutionMemory] Loaded ${this.entries.size} entries`);
        }
        catch {
            // corrupt or missing — start fresh
        }
    }
}
exports.ExecutionMemory = ExecutionMemory;
exports.executionMemory = new ExecutionMemory();
