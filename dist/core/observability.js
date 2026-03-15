"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Observability = void 0;
// ============================================================
// core/observability.ts — Metrics collection + dashboard
//
// Tracks:
//   task_time, agent_score, token_usage, success_rate, skill_usage
//
// Usage:
//   ts-node index.ts dashboard
// ============================================================
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const METRICS_FILE = path_1.default.join(process.cwd(), "workspace", "logs", "metrics.json");
// ── Storage ───────────────────────────────────────────────────
function load() {
    try {
        if (fs_1.default.existsSync(METRICS_FILE)) {
            return JSON.parse(fs_1.default.readFileSync(METRICS_FILE, "utf-8"));
        }
    }
    catch { /* fallback */ }
    return { tasks: [], agents: [], errors: [] };
}
function save(store) {
    const dir = path_1.default.dirname(METRICS_FILE);
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
    const tmp = METRICS_FILE + ".tmp";
    fs_1.default.writeFileSync(tmp, JSON.stringify(store, null, 2));
    fs_1.default.renameSync(tmp, METRICS_FILE);
}
// ── Observability ─────────────────────────────────────────────
class Observability {
    /** Record a completed/failed task. */
    static recordTask(metric) {
        const store = load();
        store.tasks.push(metric);
        // Keep last 500 tasks
        if (store.tasks.length > 500)
            store.tasks = store.tasks.slice(-500);
        save(store);
    }
    /** Record an agent quality score (from reviewer). */
    static recordAgentScore(metric) {
        const store = load();
        store.agents.push(metric);
        if (store.agents.length > 1000)
            store.agents = store.agents.slice(-1000);
        save(store);
    }
    /** Record an error event. */
    static recordError(message, stage) {
        const store = load();
        store.errors.push({ message, stage, timestamp: new Date().toISOString() });
        if (store.errors.length > 200)
            store.errors = store.errors.slice(-200);
        save(store);
    }
    // ── Dashboard ───────────────────────────────────────────────
    /** Print a full dashboard to stdout. */
    static printDashboard() {
        const store = load();
        const tasks = store.tasks;
        const agents = store.agents;
        const errors = store.errors;
        console.log("\n╔══════════════════════════════════════════════════╗");
        console.log("║              DevOS Dashboard                     ║");
        console.log("╚══════════════════════════════════════════════════╝\n");
        // ── Task Overview ──────────────────────────────────────────
        if (tasks.length === 0) {
            console.log("  No tasks recorded yet.\n");
        }
        else {
            const total = tasks.length;
            const completed = tasks.filter(t => t.status === "completed").length;
            const failed = tasks.filter(t => t.status === "failed").length;
            const escalated = tasks.filter(t => t.status === "escalated").length;
            const avgTime = tasks.reduce((s, t) => s + t.durationMs, 0) / total;
            const rate = ((completed / total) * 100).toFixed(1);
            console.log("  Task Summary");
            console.log("  " + "─".repeat(48));
            console.log(`  Total tasks:    ${total}`);
            console.log(`  Success rate:   ${rate}%  (${completed} ok / ${failed} failed / ${escalated} escalated)`);
            console.log(`  Avg duration:   ${(avgTime / 1000).toFixed(1)}s`);
            console.log("");
            // Recent 5 tasks
            console.log("  Recent Tasks");
            console.log("  " + "─".repeat(48));
            const recent = [...tasks].reverse().slice(0, 5);
            for (const t of recent) {
                const icon = t.status === "completed" ? "✅" : t.status === "failed" ? "❌" : "⚠️";
                const dur = (t.durationMs / 1000).toFixed(1) + "s";
                console.log(`  ${icon} ${t.goal.slice(0, 40).padEnd(40)} ${dur.padStart(6)}`);
            }
            console.log("");
        }
        // ── Agent Scores ───────────────────────────────────────────
        if (agents.length > 0) {
            console.log("  Agent Performance");
            console.log("  " + "─".repeat(48));
            // Group by role
            const byRole = {};
            for (const a of agents) {
                const key = a.role ?? a.agentId;
                byRole[key] = byRole[key] ?? [];
                byRole[key].push(a.score);
            }
            for (const [role, scores] of Object.entries(byRole)) {
                const avg = scores.reduce((s, x) => s + x, 0) / scores.length;
                const bar = "█".repeat(Math.round(avg)) + "░".repeat(10 - Math.round(avg));
                console.log(`  ${role.padEnd(14)} ${bar} ${avg.toFixed(1)}/10  (${scores.length} runs)`);
            }
            console.log("");
        }
        // ── Top Failures ───────────────────────────────────────────
        if (errors.length > 0) {
            console.log("  Top Failures");
            console.log("  " + "─".repeat(48));
            // Count by message prefix
            const counts = {};
            for (const e of errors) {
                const key = e.message.slice(0, 60);
                counts[key] = (counts[key] ?? 0) + 1;
            }
            const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
            for (const [msg, count] of sorted) {
                console.log(`  ×${count}  ${msg}`);
            }
            console.log("");
        }
        // ── Footer ─────────────────────────────────────────────────
        const now = new Date().toLocaleString();
        console.log(`  Generated: ${now}`);
        console.log("════════════════════════════════════════════════════\n");
    }
    /** Return a compact one-line summary string (for daemon logs). */
    static summary() {
        const store = load();
        const tasks = store.tasks;
        const total = tasks.length;
        if (total === 0)
            return "No tasks recorded.";
        const ok = tasks.filter(t => t.status === "completed").length;
        const rate = ((ok / total) * 100).toFixed(0);
        const lastTask = tasks[tasks.length - 1];
        return `Tasks: ${total} | Success: ${rate}% | Last: "${lastTask.goal.slice(0, 40)}"`;
    }
}
exports.Observability = Observability;
