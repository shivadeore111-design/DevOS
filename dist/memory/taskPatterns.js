"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskPatternMemory = void 0;
// ============================================================
// memory/taskPatterns.ts — Learn and reuse successful task plans
//
// When a plan succeeds, store it.
// Next time a similar goal appears, retrieve the pattern
// and use it as a planning hint — 10x faster planning.
//
// Example:
//   "create SaaS MVP" → saves steps: plan, scaffold, deps, routes, UI, test
//   Next run → planner gets those steps as a template
// ============================================================
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const vectorMemory_1 = require("./vectorMemory");
const PATTERNS_FILE = path_1.default.join(process.cwd(), "workspace", "memory", "taskPatterns.json");
// ── Storage ───────────────────────────────────────────────────
function load() {
    try {
        if (fs_1.default.existsSync(PATTERNS_FILE)) {
            return JSON.parse(fs_1.default.readFileSync(PATTERNS_FILE, "utf-8"));
        }
    }
    catch { /* fallback */ }
    return [];
}
function save(patterns) {
    const dir = path_1.default.dirname(PATTERNS_FILE);
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
    const tmp = PATTERNS_FILE + ".tmp";
    fs_1.default.writeFileSync(tmp, JSON.stringify(patterns, null, 2));
    fs_1.default.renameSync(tmp, PATTERNS_FILE);
}
function cosineSim(a, b) {
    if (a.length !== b.length || a.length === 0)
        return 0;
    let dot = 0, nA = 0, nB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        nA += a[i] * a[i];
        nB += b[i] * b[i];
    }
    const d = Math.sqrt(nA) * Math.sqrt(nB);
    return d === 0 ? 0 : dot / d;
}
// ── TaskPatternMemory ─────────────────────────────────────────
class TaskPatternMemory {
    /**
     * Save a successful plan as a reusable pattern.
     * Called from runner.ts when a task completes successfully.
     */
    static async save(goal, plan, tags = []) {
        const patterns = load();
        const embedding = await (0, vectorMemory_1.embed)(goal);
        // Check for near-duplicate (>0.92 similarity)
        for (const p of patterns) {
            if (cosineSim(embedding, p.embedding) > 0.92) {
                p.usageCount += 1;
                p.successCount += 1;
                p.lastUsedAt = new Date().toISOString();
                // Update the plan to the latest successful version
                p.plan = plan;
                save(patterns);
                console.log(`[TaskPatterns] Updated existing pattern for: "${goal.slice(0, 60)}"`);
                return;
            }
        }
        // New pattern
        const pattern = {
            id: `pat_${Date.now()}`,
            goalTemplate: goal,
            embedding,
            plan,
            usageCount: 1,
            successCount: 1,
            createdAt: new Date().toISOString(),
            lastUsedAt: new Date().toISOString(),
            tags,
        };
        patterns.push(pattern);
        save(patterns);
        console.log(`[TaskPatterns] Saved new pattern: "${goal.slice(0, 60)}"`);
    }
    /**
     * Find the best matching pattern for a goal.
     * Returns the pattern and similarity score, or null if no good match.
     */
    static async findBestMatch(goal, minSimilarity = 0.70) {
        const patterns = load();
        if (patterns.length === 0)
            return null;
        const embedding = await (0, vectorMemory_1.embed)(goal);
        if (embedding.every(v => v === 0))
            return null;
        let best = null;
        for (const p of patterns) {
            const sim = cosineSim(embedding, p.embedding);
            if (sim >= minSimilarity && (!best || sim > best.similarity)) {
                best = { pattern: p, similarity: sim };
            }
        }
        return best;
    }
    /**
     * Get a planning hint string for injection into the planner prompt.
     * Returns empty string if no matching pattern.
     */
    static async getPlanningHint(goal) {
        const match = await this.findBestMatch(goal);
        if (!match)
            return "";
        const { pattern, similarity } = match;
        const pct = (similarity * 100).toFixed(0);
        const steps = Array.isArray(pattern.plan?.actions)
            ? pattern.plan.actions.map((a, i) => `  ${i + 1}. ${a.type}: ${a.description ?? a.command ?? a.path ?? ""}`).join("\n")
            : JSON.stringify(pattern.plan).slice(0, 400);
        return [
            `── Similar Past Plan (${pct}% match) ──────────────────`,
            `Goal: ${pattern.goalTemplate.slice(0, 80)}`,
            `Steps used (${pattern.successCount} successful runs):`,
            steps,
            `────────────────────────────────────────────────────────`,
            `Use this as a TEMPLATE. Adapt to the current goal.`,
        ].join("\n");
    }
    /**
     * Mark a pattern as used (even if current run hasn't completed yet).
     */
    static recordUsage(patternId) {
        const patterns = load();
        const p = patterns.find(x => x.id === patternId);
        if (p) {
            p.usageCount += 1;
            p.lastUsedAt = new Date().toISOString();
            save(patterns);
        }
    }
    /**
     * Get all patterns sorted by usage frequency.
     */
    static getAll() {
        return load().sort((a, b) => b.usageCount - a.usageCount);
    }
    /**
     * Format a summary for the dashboard.
     */
    static report() {
        const all = load();
        if (all.length === 0)
            return "  No task patterns learned yet.\n";
        const lines = ["  Task Patterns\n  " + "─".repeat(50)];
        for (const p of all.slice(0, 10)) {
            lines.push(`  ${p.goalTemplate.slice(0, 45).padEnd(45)} used: ${p.usageCount}x  ` +
                `success: ${p.successCount}x  steps: ${p.plan?.actions?.length ?? "?"}`);
        }
        return lines.join("\n") + "\n";
    }
}
exports.TaskPatternMemory = TaskPatternMemory;
