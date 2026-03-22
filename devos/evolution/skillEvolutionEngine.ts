// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// ============================================================
// devos/evolution/skillEvolutionEngine.ts — Master Evolution Loop
// Analyzes → Generates → Benchmarks → Deploys improved skills.
// ============================================================

import fs   from "fs";
import path from "path";

import { skillAnalyzer }             from "./skillAnalyzer";
import { skillGenerator }            from "./skillGenerator";
import { skillBenchmark, BenchmarkResult } from "./skillBenchmark";
import { eventBus }                  from "../../dashboard/events";
import { CapabilityGraph }           from "../../core/capabilityGraph";

const SKILLS_ROOT = path.join(process.cwd(), "skills");

// ── Interface ─────────────────────────────────────────────────

export interface EvolutionResult {
  skillsAnalyzed:  number;
  skillsImproved:  number;
  skillsDeployed:  number;
  skillsDiscarded: number;
  results:         BenchmarkResult[];
  runAt:           string;
}

// ── SkillEvolutionEngine ──────────────────────────────────────

export class SkillEvolutionEngine {
  private ollamaUrl:       string;
  private intervalHandle:  ReturnType<typeof setInterval> | null = null;

  constructor(ollamaBaseUrl = "http://localhost:11434") {
    this.ollamaUrl = ollamaBaseUrl;
  }

  /**
   * Full evolution loop: analyze → generate → benchmark → deploy.
   */
  async run(): Promise<EvolutionResult> {
    const runAt = new Date().toISOString();
    console.log("[SkillEvolutionEngine] Starting evolution run...");

    eventBus.emit({
      type:      "evolution_started",
      payload:   { runAt },
      timestamp: runAt,
    });

    const benchmarkResults: BenchmarkResult[] = [];
    let skillsImproved  = 0;
    let skillsDeployed  = 0;
    let skillsDiscarded = 0;

    // ── Step 1: Analyze all skills ─────────────────────────────
    const analyses = await skillAnalyzer.analyzeAll();
    const needsWork = analyses.filter(
      a => a.needsImprovement && (a.priority === "critical" || a.priority === "high")
    );

    console.log(
      `[SkillEvolutionEngine] ${analyses.length} skills analyzed. ` +
      `${needsWork.length} need improvement (critical/high).`
    );

    // ── Step 2: For each weak skill — improve + benchmark ──────
    for (const analysis of needsWork) {
      const { skillName, improvementReason } = analysis;

      // Find the skill file on disk
      const skillFile = this._findSkillFile(skillName);
      if (!skillFile) {
        console.warn(`[SkillEvolutionEngine] Cannot find file for skill: ${skillName} — skipping.`);
        continue;
      }

      let currentCode: string;
      try {
        currentCode = fs.readFileSync(skillFile, "utf-8");
      } catch (err: any) {
        console.warn(`[SkillEvolutionEngine] Cannot read ${skillFile}: ${err.message}`);
        continue;
      }

      skillsImproved++;

      let generated;
      try {
        generated = await skillGenerator.improve(skillName, improvementReason, currentCode);
      } catch (err: any) {
        console.warn(`[SkillEvolutionEngine] Generation failed for ${skillName}: ${err.message}`);
        continue;
      }

      let benchResult: BenchmarkResult;
      try {
        benchResult = await skillBenchmark.compare(skillName, currentCode, generated.code);
      } catch (err: any) {
        console.warn(`[SkillEvolutionEngine] Benchmark failed for ${skillName}: ${err.message}`);
        continue;
      }

      skillBenchmark.saveResult(benchResult);
      benchmarkResults.push(benchResult);

      if (benchResult.recommendation === "deploy") {
        // Write improved code to disk
        try {
          fs.writeFileSync(skillFile, generated.code, "utf-8");
          skillsDeployed++;
          console.log(`[SkillEvolutionEngine] ✅ Deployed improved ${skillName}`);

          eventBus.emit({
            type:    "skill_evolved",
            payload: {
              skillName,
              oldSuccessRate: benchResult.oldSuccessRate,
              newSuccessRate: benchResult.newSuccessRate,
              improvement:    benchResult.improvement,
            },
            timestamp: new Date().toISOString(),
          });
        } catch (err: any) {
          console.error(`[SkillEvolutionEngine] Failed to write ${skillFile}: ${err.message}`);
        }
      } else if (benchResult.recommendation === "discard") {
        skillsDiscarded++;
        console.log(`[SkillEvolutionEngine] ⛔ Discarded new version of ${skillName} (no improvement)`);
      } else {
        console.log(`[SkillEvolutionEngine] 👀 Flagged ${skillName} for review`);
      }
    }

    // ── Step 3: Check CapabilityGraph for missing capabilities ─
    const allCapabilities = CapabilityGraph.getAll();
    const missing = allCapabilities.filter(c => !c.available);

    console.log(`[SkillEvolutionEngine] ${missing.length} missing capabilities found.`);

    for (const cap of missing.slice(0, 3)) {  // limit to 3 per run to avoid overload
      try {
        const newSkill = await skillGenerator.createNew(cap.name);

        eventBus.emit({
          type:    "skill_created",
          payload: { skillName: newSkill.skillName, capability: cap.name },
          timestamp: new Date().toISOString(),
        });

        console.log(`[SkillEvolutionEngine] 🆕 Created skill for capability: ${cap.name}`);
      } catch (err: any) {
        console.warn(`[SkillEvolutionEngine] Failed to create skill for ${cap.name}: ${err.message}`);
      }
    }

    const result: EvolutionResult = {
      skillsAnalyzed:  analyses.length,
      skillsImproved,
      skillsDeployed,
      skillsDiscarded,
      results:         benchmarkResults,
      runAt,
    };

    eventBus.emit({
      type:    "evolution_complete",
      payload: result,
      timestamp: new Date().toISOString(),
    });

    console.log(
      `[SkillEvolutionEngine] Run complete — ` +
      `analyzed: ${result.skillsAnalyzed}, ` +
      `improved: ${result.skillsImproved}, ` +
      `deployed: ${result.skillsDeployed}, ` +
      `discarded: ${result.skillsDiscarded}`
    );

    return result;
  }

  /**
   * Runs the evolution loop on a recurring interval.
   * @param intervalMs default 30 minutes
   */
  schedule(intervalMs = 30 * 60 * 1000): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
    }
    console.log(
      `[SkillEvolutionEngine] Scheduled to run every ${intervalMs / 60_000} minutes.`
    );
    this.intervalHandle = setInterval(() => {
      this.run().catch(err =>
        console.error(`[SkillEvolutionEngine] Scheduled run failed: ${err.message}`)
      );
    }, intervalMs);
  }

  // ── Private ──────────────────────────────────────────────────

  /**
   * Walk the skills/ tree to find <skillName>.ts
   */
  private _findSkillFile(skillName: string): string | null {
    return this._searchDir(SKILLS_ROOT, skillName);
  }

  private _searchDir(dir: string, skillName: string): string | null {
    if (!fs.existsSync(dir)) return null;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = this._searchDir(fullPath, skillName);
        if (found) return found;
      } else if (
        entry.isFile() &&
        entry.name.endsWith(".ts") &&
        entry.name.replace(".ts", "") === skillName
      ) {
        return fullPath;
      }
    }
    return null;
  }
}

// ── Singleton ─────────────────────────────────────────────────

export const skillEvolutionEngine = new SkillEvolutionEngine();
