"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboard = exports.MetricsDashboard = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const METRICS_FILE = path_1.default.join(process.cwd(), "workspace", "logs", "metrics.json");
class MetricsDashboard {
    readStore() {
        try {
            if (!fs_1.default.existsSync(METRICS_FILE)) {
                return {};
            }
            const raw = fs_1.default.readFileSync(METRICS_FILE, "utf-8");
            const parsed = JSON.parse(raw);
            return parsed ?? {};
        }
        catch {
            return {};
        }
    }
    getStats() {
        const store = this.readStore();
        const tasks = Array.isArray(store.tasks) ? store.tasks : [];
        const errors = Array.isArray(store.errors) ? store.errors : [];
        const totalTasks = tasks.length;
        const successCount = tasks.filter((t) => t.status === "completed" || t.status === "success").length;
        const failureCount = tasks.filter((t) => t.status === "failed" || t.status === "failure").length;
        const successRate = totalTasks === 0 ? "0.0%" : `${((successCount / totalTasks) * 100).toFixed(1)}%`;
        const durationValues = tasks
            .map((t) => (typeof t.durationMs === "number" ? t.durationMs : 0))
            .filter((d) => Number.isFinite(d) && d >= 0);
        const avgDurationMs = durationValues.length === 0
            ? 0
            : Math.round(durationValues.reduce((sum, d) => sum + d, 0) / durationValues.length);
        const skillCounts = new Map();
        for (const task of tasks) {
            const candidates = [];
            if (typeof task.skill === "string")
                candidates.push(task.skill);
            if (typeof task.skillName === "string")
                candidates.push(task.skillName);
            if (typeof task.skillUsed === "string")
                candidates.push(task.skillUsed);
            if (Array.isArray(task.skills))
                candidates.push(...task.skills.filter((s) => typeof s === "string"));
            if (Array.isArray(task.usedSkills)) {
                candidates.push(...task.usedSkills.filter((s) => typeof s === "string"));
            }
            for (const name of candidates.map((s) => s.trim()).filter(Boolean)) {
                skillCounts.set(name, (skillCounts.get(name) ?? 0) + 1);
            }
        }
        const topSkills = [...skillCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));
        const errorCounts = new Map();
        for (const err of errors) {
            const message = (err.message ?? "Unknown error").trim() || "Unknown error";
            errorCounts.set(message, (errorCounts.get(message) ?? 0) + 1);
        }
        const commonErrors = [...errorCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([message, count]) => ({ message, count }));
        const taskTimestamps = tasks
            .map((t) => t.timestamp)
            .filter((t) => typeof t === "string" && t.length > 0)
            .sort((a, b) => b.localeCompare(a));
        const lastUpdated = store.updatedAt ?? taskTimestamps[0] ?? new Date(0).toISOString();
        return {
            totalTasks,
            successCount,
            failureCount,
            successRate,
            avgDurationMs,
            topSkills,
            commonErrors,
            lastUpdated,
        };
    }
    display() {
        const stats = this.getStats();
        const width = 38;
        const hr = `╠${"═".repeat(width)}╣`;
        const top = `╔${"═".repeat(width)}╗`;
        const bottom = `╚${"═".repeat(width)}╝`;
        const line = (text = "") => {
            const clipped = text.length > width ? text.slice(0, width - 1) + "…" : text;
            return `║${clipped.padEnd(width)}║`;
        };
        console.log(top);
        console.log(line("         DevOS Dashboard"));
        console.log(hr);
        console.log(line(` Tasks:     ${stats.totalTasks} total`));
        console.log(line(` Success:   ${stats.successCount} (${stats.successRate})`));
        console.log(line(` Failed:    ${stats.failureCount}`));
        console.log(line(` Avg Time:  ${stats.avgDurationMs}ms`));
        console.log(hr);
        console.log(line(" Top Skills:"));
        if (stats.topSkills.length === 0) {
            console.log(line("   (none)"));
        }
        else {
            stats.topSkills.slice(0, 2).forEach((skill, index) => {
                console.log(line(`   ${index + 1}. ${skill.name} (${skill.count})`));
            });
        }
        console.log(hr);
        console.log(line(" Common Errors:"));
        if (stats.commonErrors.length === 0) {
            console.log(line("   (none)"));
        }
        else {
            stats.commonErrors.slice(0, 2).forEach((err, index) => {
                console.log(line(`   ${index + 1}. ${err.message} (${err.count}x)`));
            });
        }
        console.log(hr);
        const updated = stats.lastUpdated === new Date(0).toISOString()
            ? "never"
            : new Date(stats.lastUpdated).toLocaleString();
        console.log(line(` Last Updated: ${updated}`));
        console.log(bottom);
    }
}
exports.MetricsDashboard = MetricsDashboard;
exports.dashboard = new MetricsDashboard();
