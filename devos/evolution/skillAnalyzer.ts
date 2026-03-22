// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// ============================================================
// devos/evolution/skillAnalyzer.ts — Skill Performance Analyzer
// Reads SkillMemory stats and identifies skills needing improvement.
// ============================================================

import { SkillMemory, SkillMetric } from "../../skills/skillMemory";

// ── Interface ─────────────────────────────────────────────────

export interface SkillAnalysis {
  skillName:         string;
  successRate:       number;
  executionCount:    number;
  avgDurationMs:     number;
  needsImprovement:  boolean;
  improvementReason: string;
  priority:          "critical" | "high" | "medium" | "low";
}

// ── SkillAnalyzer ─────────────────────────────────────────────

export class SkillAnalyzer {

  async analyzeAll(): Promise<SkillAnalysis[]> {
    const allMetrics = SkillMemory.getAll();
    return allMetrics.map(m => this._analyze(m));
  }

  async analyzeOne(skillName: string): Promise<SkillAnalysis> {
    const metric = SkillMemory.get(skillName);
    if (!metric) {
      return {
        skillName,
        successRate:       0,
        executionCount:    0,
        avgDurationMs:     0,
        needsImprovement:  false,
        improvementReason: "No execution data available",
        priority:          "low",
      };
    }
    return this._analyze(metric);
  }

  // ── Private ──────────────────────────────────────────────────

  private _analyze(metric: SkillMetric): SkillAnalysis {
    const { name, successRate, totalRuns, avgDurationMs } = metric;

    const poorSuccess  = successRate < 0.7 && totalRuns >= 3;
    const slowExec     = avgDurationMs > 30_000 && totalRuns >= 5;
    const needsImprovement = poorSuccess || slowExec;

    let improvementReason = "";
    let priority: SkillAnalysis["priority"] = "low";

    if (poorSuccess) {
      if (successRate < 0.4) {
        priority = "critical";
        improvementReason = `Critical failure rate: ${(successRate * 100).toFixed(0)}% success across ${totalRuns} runs`;
      } else if (successRate < 0.6) {
        priority = "high";
        improvementReason = `Low success rate: ${(successRate * 100).toFixed(0)}% across ${totalRuns} runs`;
      } else {
        priority = "medium";
        improvementReason = `Below-threshold success rate: ${(successRate * 100).toFixed(0)}% across ${totalRuns} runs`;
      }
    } else if (slowExec) {
      priority = "medium";
      improvementReason = `Slow execution: avg ${(avgDurationMs / 1000).toFixed(1)}s across ${totalRuns} runs`;
    }

    return {
      skillName:         name,
      successRate,
      executionCount:    totalRuns,
      avgDurationMs,
      needsImprovement,
      improvementReason,
      priority,
    };
  }
}

// ── Singleton ─────────────────────────────────────────────────

export const skillAnalyzer = new SkillAnalyzer();
