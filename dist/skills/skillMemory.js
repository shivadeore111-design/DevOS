"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillMemory = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const METRICS_FILE = path_1.default.join(process.cwd(), "workspace", "memory", "skillMetrics.json");
function load() {
    try {
        if (fs_1.default.existsSync(METRICS_FILE)) {
            return JSON.parse(fs_1.default.readFileSync(METRICS_FILE, "utf-8"));
        }
    }
    catch {
        return {};
    }
    return {};
}
function save(store) {
    const dir = path_1.default.dirname(METRICS_FILE);
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
    const tmp = `${METRICS_FILE}.tmp`;
    fs_1.default.writeFileSync(tmp, JSON.stringify(store, null, 2));
    fs_1.default.renameSync(tmp, METRICS_FILE);
}
class SkillMemory {
    async record(record) {
        return SkillMemory.record(record.skillName, record.success, record.durationMs, record.error, record.tags ?? []);
    }
    async getStats(skillName) {
        return SkillMemory.get(skillName);
    }
    static record(name, success, durationMs, error, tags = []) {
        const store = load();
        const now = new Date().toISOString();
        const existing = store[name] ?? {
            name,
            totalRuns: 0,
            successes: 0,
            failures: 0,
            successRate: 0,
            avgDurationMs: 0,
            lastRunAt: now,
            failurePatterns: [],
            tags
        };
        existing.totalRuns += 1;
        existing.lastRunAt = now;
        if (success) {
            existing.successes += 1;
        }
        else {
            existing.failures += 1;
            existing.lastFailureAt = now;
            existing.lastFailure = error;
            if (error) {
                const signature = error.slice(0, 80);
                if (!existing.failurePatterns.includes(signature)) {
                    existing.failurePatterns = [signature, ...existing.failurePatterns].slice(0, 5);
                }
            }
        }
        existing.avgDurationMs =
            (existing.avgDurationMs * (existing.totalRuns - 1) + durationMs) / existing.totalRuns;
        existing.successRate = existing.successes / existing.totalRuns;
        existing.tags = tags.length > 0 ? tags : existing.tags;
        store[name] = existing;
        save(store);
        return existing;
    }
    static get(name) {
        return load()[name];
    }
    static getAll() {
        return Object.values(load()).sort((a, b) => b.successRate - a.successRate);
    }
    static recommend(taskDescription) {
        const lower = taskDescription.toLowerCase();
        return this.getAll()
            .filter((skill) => skill.totalRuns >= 2 && skill.successRate >= 0.5)
            .filter((skill) => skill.name.toLowerCase().includes(lower.split(" ")[0]) ||
            skill.tags.some((tag) => lower.includes(tag)))
            .slice(0, 3);
    }
    static getUnreliable(threshold = 0.5) {
        return this.getAll().filter((skill) => skill.totalRuns >= 3 && skill.successRate < threshold);
    }
    static report() {
        const all = this.getAll();
        if (all.length === 0) {
            return "  No skill usage recorded yet.\n";
        }
        const lines = ["  Skill Performance\n  " + "─".repeat(50)];
        for (const skill of all) {
            const rate = (skill.successRate * 100).toFixed(0).padStart(3);
            const runs = String(skill.totalRuns).padStart(4);
            const filled = Math.round(skill.successRate * 10);
            const bar = "█".repeat(filled) + "░".repeat(10 - filled);
            lines.push(`  ${skill.name.padEnd(30)} ${bar} ${rate}% (${runs} runs)`);
            if (skill.lastFailure) {
                lines.push(`    └─ Last failure: ${skill.lastFailure.slice(0, 60)}`);
            }
        }
        return `${lines.join("\n")}\n`;
    }
}
exports.SkillMemory = SkillMemory;
