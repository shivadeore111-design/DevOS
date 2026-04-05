"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.growthEngine = exports.GrowthEngine = void 0;
// core/growthEngine.ts — Self-improvement through failure analysis.
//
// Appends every failure as a JSONL line to workspace/growth/failure-log.jsonl.
// On analyze(), clusters failures by (capability, error-class) context hash,
// surfaces opportunities with count >= 3, and writes a weekly markdown report.
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// ── Paths ──────────────────────────────────────────────────────
const GROWTH_DIR = path_1.default.join(process.cwd(), 'workspace', 'growth');
const FAILURE_LOG = path_1.default.join(GROWTH_DIR, 'failure-log.jsonl');
const OPPORTUNITIES_PATH = path_1.default.join(GROWTH_DIR, 'skill-opportunities.json');
const REPORT_PATH = path_1.default.join(GROWTH_DIR, 'weekly-report.md');
// ── GrowthEngine ───────────────────────────────────────────────
class GrowthEngine {
    constructor() {
        try {
            fs_1.default.mkdirSync(GROWTH_DIR, { recursive: true });
        }
        catch { }
    }
    // ── Record a failure ──────────────────────────────────────────
    logFailure(task, error, toolsAttempted) {
        const capability = toolsAttempted[toolsAttempted.length - 1] || 'unknown';
        const contextHash = this.hashContext(error, capability);
        const entry = {
            timestamp: Date.now(),
            task,
            error: error.slice(0, 200),
            capability,
            contextHash,
        };
        try {
            fs_1.default.appendFileSync(FAILURE_LOG, JSON.stringify(entry) + '\n', 'utf-8');
        }
        catch { }
        console.log(`[GrowthEngine] Failure logged: ${contextHash} — "${task.slice(0, 60)}"`);
    }
    // ── Record a success ──────────────────────────────────────────
    // Tracked for confidence scoring — future use
    logSuccess(_task, _tools) {
        // No-op for now; confidence scoring uses failure ratio
    }
    // ── Analyse failure log and surface opportunities ─────────────
    analyze() {
        if (!fs_1.default.existsSync(FAILURE_LOG))
            return [];
        let lines;
        try {
            lines = fs_1.default.readFileSync(FAILURE_LOG, 'utf-8').trim().split('\n').filter(Boolean);
        }
        catch {
            return [];
        }
        const totalFailures = lines.length;
        if (totalFailures === 0)
            return [];
        const map = new Map();
        for (const line of lines) {
            try {
                const f = JSON.parse(line);
                if (!map.has(f.contextHash)) {
                    map.set(f.contextHash, {
                        contextHash: f.contextHash,
                        count: 0,
                        suggestedSkill: this.inferSkill(f),
                        lastSeen: f.timestamp,
                        confidence: 0,
                    });
                }
                const entry = map.get(f.contextHash);
                entry.count++;
                entry.lastSeen = Math.max(entry.lastSeen, f.timestamp);
                entry.confidence = entry.count / totalFailures;
            }
            catch { }
        }
        const opportunities = Array.from(map.values())
            .filter(o => o.count >= 3 && o.confidence > 0.1)
            .sort((a, b) => b.count - a.count);
        try {
            fs_1.default.writeFileSync(OPPORTUNITIES_PATH, JSON.stringify(opportunities, null, 2), 'utf-8');
        }
        catch { }
        return opportunities;
    }
    // ── Weekly report ─────────────────────────────────────────────
    getWeeklyReport() {
        const opportunities = this.analyze();
        let failedCount = 0;
        try {
            if (fs_1.default.existsSync(FAILURE_LOG)) {
                failedCount = fs_1.default.readFileSync(FAILURE_LOG, 'utf-8')
                    .trim().split('\n').filter(Boolean).length;
            }
        }
        catch { }
        const report = {
            learned: 0,
            failed: failedCount,
            gaps: opportunities.map(o => o.contextHash),
            proposals: opportunities.map(o => o.suggestedSkill),
        };
        // Write markdown report
        try {
            const lines = [
                `# DevOS Weekly Growth Report`,
                ``,
                `**Failed tasks:** ${report.failed}`,
                `**Gaps detected:** ${report.gaps.length}`,
                ``,
                opportunities.length === 0
                    ? '_No recurring failure patterns detected._'
                    : opportunities
                        .map(o => `- \`${o.contextHash}\` → \`${o.suggestedSkill}\` ` +
                        `(${o.count} failures, confidence: ${(o.confidence * 100).toFixed(0)}%)`)
                        .join('\n'),
            ];
            fs_1.default.writeFileSync(REPORT_PATH, lines.join('\n'), 'utf-8');
        }
        catch { }
        return report;
    }
    // ── Context hash: (capability, error-class) pair ─────────────
    hashContext(error, capability) {
        const lower = error.toLowerCase();
        const errClass = lower.includes('timeout') ? 'timeout'
            : lower.includes('selector') ? 'selector'
                : lower.includes('403') || lower.includes('401') ? 'auth'
                    : lower.includes('rate') || lower.includes('429') ? 'ratelimit'
                        : lower.includes('not found') || lower.includes('enoent') ? 'notfound'
                            : lower.includes('parse') || lower.includes('json') ? 'parse'
                                : lower.includes('network') || lower.includes('fetch') ? 'network'
                                    : 'general';
        return `${capability}_${errClass}`;
    }
    // ── Infer a skill name from a failure ─────────────────────────
    inferSkill(f) {
        const lower = f.error.toLowerCase();
        if (lower.includes('selector'))
            return 'web.extractor.robust';
        if (lower.includes('timeout'))
            return 'retry.backoff';
        if (f.capability.includes('file'))
            return 'file.recovery';
        if (lower.includes('rate') || lower.includes('429'))
            return 'provider.rotation';
        if (lower.includes('403') || lower.includes('401'))
            return 'auth.refresh';
        if (lower.includes('parse') || lower.includes('json'))
            return 'output.parser';
        if (lower.includes('network') || lower.includes('fetch'))
            return 'network.resilience';
        return 'general.improvement';
    }
}
exports.GrowthEngine = GrowthEngine;
// ── Singleton ─────────────────────────────────────────────────
exports.growthEngine = new GrowthEngine();
