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
exports.evolutionAnalyzer = void 0;
// core/evolutionAnalyzer.ts — Self-evolution: tracks execution reports,
// computes per-skill stats, and decides which skills need attention.
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// ── File paths ────────────────────────────────────────────────
const REPORTS_FILE = path.join(process.cwd(), 'workspace', 'evolution-reports.json');
const STATS_FILE = path.join(process.cwd(), 'workspace', 'evolution-stats.json');
const HISTORY_FILE = path.join(process.cwd(), 'workspace', 'evolution-history.json');
// ── Helpers ───────────────────────────────────────────────────
function readJSON(file, fallback) {
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        return JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
    catch {
        return fallback;
    }
}
function writeJSON(file, data) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}
// ── EvolutionAnalyzer ─────────────────────────────────────────
class EvolutionAnalyzer {
    /** Store a completed execution report, then re-analyse. */
    collect(report) {
        const reports = readJSON(REPORTS_FILE, []);
        reports.push(report);
        writeJSON(REPORTS_FILE, reports.slice(-200));
        this.analyze();
    }
    /** Extract per-skill stats from all stored reports. */
    analyze() {
        const reports = readJSON(REPORTS_FILE, []);
        const skillMap = {};
        for (const report of reports) {
            for (const step of report.steps) {
                if (!skillMap[step.skill]) {
                    skillMap[step.skill] = { runs: 0, successes: 0, times: [], errors: [] };
                }
                skillMap[step.skill].runs++;
                if (step.success)
                    skillMap[step.skill].successes++;
                skillMap[step.skill].times.push(step.duration);
                if (step.error)
                    skillMap[step.skill].errors.push(step.error);
            }
        }
        const stats = Object.entries(skillMap).map(([skill, data]) => {
            const successRate = data.successes / data.runs;
            const avgTime = data.times.reduce((a, b) => a + b, 0) / data.times.length;
            // Count common errors
            const errorCount = {};
            data.errors.forEach(e => { errorCount[e] = (errorCount[e] || 0) + 1; });
            const commonErrors = Object.entries(errorCount)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([e]) => e);
            // Decision engine — rules based
            let decision = 'GOOD';
            if (data.runs < 3)
                decision = 'GOOD'; // not enough data
            else if (successRate < 0.3)
                decision = 'REPLACE';
            else if (successRate < 0.6)
                decision = 'IMPROVE';
            else if (avgTime > 30000)
                decision = 'OPTIMIZE';
            else if (data.runs === 0)
                decision = 'REMOVE';
            return {
                skill,
                totalRuns: data.runs,
                successRate,
                avgTime,
                commonErrors,
                decision,
                lastUpdated: Date.now(),
            };
        });
        writeJSON(STATS_FILE, stats);
        return stats;
    }
    /** Get current stats (from file cache). */
    getStats() {
        return readJSON(STATS_FILE, []);
    }
    /** Get skills that need attention (not GOOD). */
    getDecisions() {
        return this.getStats().filter(s => s.decision !== 'GOOD');
    }
    /** Log an evolution event (what changed and measured impact). */
    recordEvolution(entry) {
        const history = readJSON(HISTORY_FILE, []);
        history.push({ ...entry, timestamp: Date.now() });
        writeJSON(HISTORY_FILE, history.slice(-100));
    }
    /** Get full evolution history. */
    getHistory() {
        return readJSON(HISTORY_FILE, []);
    }
    /** Summary string for devos doctor. */
    getSummary() {
        const stats = this.getStats();
        const decisions = this.getDecisions();
        const reports = readJSON(REPORTS_FILE, []);
        const avgSuccess = stats.length
            ? stats.reduce((a, s) => a + s.successRate, 0) / stats.length
            : 0;
        return `${reports.length} executions tracked · ${stats.length} skills · ${decisions.length} need attention · avg success ${Math.round(avgSuccess * 100)}%`;
    }
}
exports.evolutionAnalyzer = new EvolutionAnalyzer();
