"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.skillAnalyzer = exports.SkillAnalyzer = void 0;
// ============================================================
// devos/evolution/skillAnalyzer.ts — Skill Performance Analyzer
// Reads SkillMemory stats and identifies skills needing improvement.
// ============================================================
const skillMemory_1 = require("../../skills/skillMemory");
// ── SkillAnalyzer ─────────────────────────────────────────────
class SkillAnalyzer {
    async analyzeAll() {
        const allMetrics = skillMemory_1.SkillMemory.getAll();
        return allMetrics.map(m => this._analyze(m));
    }
    async analyzeOne(skillName) {
        const metric = skillMemory_1.SkillMemory.get(skillName);
        if (!metric) {
            return {
                skillName,
                successRate: 0,
                executionCount: 0,
                avgDurationMs: 0,
                needsImprovement: false,
                improvementReason: "No execution data available",
                priority: "low",
            };
        }
        return this._analyze(metric);
    }
    // ── Private ──────────────────────────────────────────────────
    _analyze(metric) {
        const { name, successRate, totalRuns, avgDurationMs } = metric;
        const poorSuccess = successRate < 0.7 && totalRuns >= 3;
        const slowExec = avgDurationMs > 30000 && totalRuns >= 5;
        const needsImprovement = poorSuccess || slowExec;
        let improvementReason = "";
        let priority = "low";
        if (poorSuccess) {
            if (successRate < 0.4) {
                priority = "critical";
                improvementReason = `Critical failure rate: ${(successRate * 100).toFixed(0)}% success across ${totalRuns} runs`;
            }
            else if (successRate < 0.6) {
                priority = "high";
                improvementReason = `Low success rate: ${(successRate * 100).toFixed(0)}% across ${totalRuns} runs`;
            }
            else {
                priority = "medium";
                improvementReason = `Below-threshold success rate: ${(successRate * 100).toFixed(0)}% across ${totalRuns} runs`;
            }
        }
        else if (slowExec) {
            priority = "medium";
            improvementReason = `Slow execution: avg ${(avgDurationMs / 1000).toFixed(1)}s across ${totalRuns} runs`;
        }
        return {
            skillName: name,
            successRate,
            executionCount: totalRuns,
            avgDurationMs,
            needsImprovement,
            improvementReason,
            priority,
        };
    }
}
exports.SkillAnalyzer = SkillAnalyzer;
// ── Singleton ─────────────────────────────────────────────────
exports.skillAnalyzer = new SkillAnalyzer();
