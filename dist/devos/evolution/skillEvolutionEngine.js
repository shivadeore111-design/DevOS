"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.skillEvolutionEngine = exports.SkillEvolutionEngine = void 0;
// ============================================================
// devos/evolution/skillEvolutionEngine.ts — Master Evolution Loop
// Analyzes → Generates → Benchmarks → Deploys improved skills.
// ============================================================
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const skillAnalyzer_1 = require("./skillAnalyzer");
const skillGenerator_1 = require("./skillGenerator");
const skillBenchmark_1 = require("./skillBenchmark");
const events_1 = require("../../dashboard/events");
const capabilityGraph_1 = require("../../core/capabilityGraph");
const SKILLS_ROOT = path_1.default.join(process.cwd(), "skills");
// ── SkillEvolutionEngine ──────────────────────────────────────
class SkillEvolutionEngine {
    constructor(ollamaBaseUrl = "http://localhost:11434") {
        this.intervalHandle = null;
        this.ollamaUrl = ollamaBaseUrl;
    }
    /**
     * Full evolution loop: analyze → generate → benchmark → deploy.
     */
    async run() {
        const runAt = new Date().toISOString();
        console.log("[SkillEvolutionEngine] Starting evolution run...");
        events_1.eventBus.emit({
            type: "evolution_started",
            payload: { runAt },
            timestamp: runAt,
        });
        const benchmarkResults = [];
        let skillsImproved = 0;
        let skillsDeployed = 0;
        let skillsDiscarded = 0;
        // ── Step 1: Analyze all skills ─────────────────────────────
        const analyses = await skillAnalyzer_1.skillAnalyzer.analyzeAll();
        const needsWork = analyses.filter(a => a.needsImprovement && (a.priority === "critical" || a.priority === "high"));
        console.log(`[SkillEvolutionEngine] ${analyses.length} skills analyzed. ` +
            `${needsWork.length} need improvement (critical/high).`);
        // ── Step 2: For each weak skill — improve + benchmark ──────
        for (const analysis of needsWork) {
            const { skillName, improvementReason } = analysis;
            // Find the skill file on disk
            const skillFile = this._findSkillFile(skillName);
            if (!skillFile) {
                console.warn(`[SkillEvolutionEngine] Cannot find file for skill: ${skillName} — skipping.`);
                continue;
            }
            let currentCode;
            try {
                currentCode = fs_1.default.readFileSync(skillFile, "utf-8");
            }
            catch (err) {
                console.warn(`[SkillEvolutionEngine] Cannot read ${skillFile}: ${err.message}`);
                continue;
            }
            skillsImproved++;
            let generated;
            try {
                generated = await skillGenerator_1.skillGenerator.improve(skillName, improvementReason, currentCode);
            }
            catch (err) {
                console.warn(`[SkillEvolutionEngine] Generation failed for ${skillName}: ${err.message}`);
                continue;
            }
            let benchResult;
            try {
                benchResult = await skillBenchmark_1.skillBenchmark.compare(skillName, currentCode, generated.code);
            }
            catch (err) {
                console.warn(`[SkillEvolutionEngine] Benchmark failed for ${skillName}: ${err.message}`);
                continue;
            }
            skillBenchmark_1.skillBenchmark.saveResult(benchResult);
            benchmarkResults.push(benchResult);
            if (benchResult.recommendation === "deploy") {
                // Write improved code to disk
                try {
                    fs_1.default.writeFileSync(skillFile, generated.code, "utf-8");
                    skillsDeployed++;
                    console.log(`[SkillEvolutionEngine] ✅ Deployed improved ${skillName}`);
                    events_1.eventBus.emit({
                        type: "skill_evolved",
                        payload: {
                            skillName,
                            oldSuccessRate: benchResult.oldSuccessRate,
                            newSuccessRate: benchResult.newSuccessRate,
                            improvement: benchResult.improvement,
                        },
                        timestamp: new Date().toISOString(),
                    });
                }
                catch (err) {
                    console.error(`[SkillEvolutionEngine] Failed to write ${skillFile}: ${err.message}`);
                }
            }
            else if (benchResult.recommendation === "discard") {
                skillsDiscarded++;
                console.log(`[SkillEvolutionEngine] ⛔ Discarded new version of ${skillName} (no improvement)`);
            }
            else {
                console.log(`[SkillEvolutionEngine] 👀 Flagged ${skillName} for review`);
            }
        }
        // ── Step 3: Check CapabilityGraph for missing capabilities ─
        const allCapabilities = capabilityGraph_1.CapabilityGraph.getAll();
        const missing = allCapabilities.filter(c => !c.available);
        console.log(`[SkillEvolutionEngine] ${missing.length} missing capabilities found.`);
        for (const cap of missing.slice(0, 3)) { // limit to 3 per run to avoid overload
            try {
                const newSkill = await skillGenerator_1.skillGenerator.createNew(cap.name);
                events_1.eventBus.emit({
                    type: "skill_created",
                    payload: { skillName: newSkill.skillName, capability: cap.name },
                    timestamp: new Date().toISOString(),
                });
                console.log(`[SkillEvolutionEngine] 🆕 Created skill for capability: ${cap.name}`);
            }
            catch (err) {
                console.warn(`[SkillEvolutionEngine] Failed to create skill for ${cap.name}: ${err.message}`);
            }
        }
        const result = {
            skillsAnalyzed: analyses.length,
            skillsImproved,
            skillsDeployed,
            skillsDiscarded,
            results: benchmarkResults,
            runAt,
        };
        events_1.eventBus.emit({
            type: "evolution_complete",
            payload: result,
            timestamp: new Date().toISOString(),
        });
        console.log(`[SkillEvolutionEngine] Run complete — ` +
            `analyzed: ${result.skillsAnalyzed}, ` +
            `improved: ${result.skillsImproved}, ` +
            `deployed: ${result.skillsDeployed}, ` +
            `discarded: ${result.skillsDiscarded}`);
        return result;
    }
    /**
     * Runs the evolution loop on a recurring interval.
     * @param intervalMs default 30 minutes
     */
    schedule(intervalMs = 30 * 60 * 1000) {
        if (this.intervalHandle) {
            clearInterval(this.intervalHandle);
        }
        console.log(`[SkillEvolutionEngine] Scheduled to run every ${intervalMs / 60000} minutes.`);
        this.intervalHandle = setInterval(() => {
            this.run().catch(err => console.error(`[SkillEvolutionEngine] Scheduled run failed: ${err.message}`));
        }, intervalMs);
    }
    // ── Private ──────────────────────────────────────────────────
    /**
     * Walk the skills/ tree to find <skillName>.ts
     */
    _findSkillFile(skillName) {
        return this._searchDir(SKILLS_ROOT, skillName);
    }
    _searchDir(dir, skillName) {
        if (!fs_1.default.existsSync(dir))
            return null;
        for (const entry of fs_1.default.readdirSync(dir, { withFileTypes: true })) {
            const fullPath = path_1.default.join(dir, entry.name);
            if (entry.isDirectory()) {
                const found = this._searchDir(fullPath, skillName);
                if (found)
                    return found;
            }
            else if (entry.isFile() &&
                entry.name.endsWith(".ts") &&
                entry.name.replace(".ts", "") === skillName) {
                return fullPath;
            }
        }
        return null;
    }
}
exports.SkillEvolutionEngine = SkillEvolutionEngine;
// ── Singleton ─────────────────────────────────────────────────
exports.skillEvolutionEngine = new SkillEvolutionEngine();
