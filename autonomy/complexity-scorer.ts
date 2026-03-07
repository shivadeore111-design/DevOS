// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import path from "path";
import { Action, Plan } from "./decision";

// ─────────────────────────────────────────────────────────────────────────────
// Thresholds (Configurable)
// ─────────────────────────────────────────────────────────────────────────────

const SANDBOX = "C:\\DevOS\\workspace\\sandbox";

const LOW_TO_MEDIUM_THRESHOLD = 15;
const EXECUTOR_THRESHOLD = 30;
const OPENCLAW_THRESHOLD = 60;
const ABSOLUTE_BLOCK_THRESHOLD = 100;

const ACTION_COUNT_ESCALATION_LIMIT = 5;
const ACTION_COUNT_ESCALATION_SCORE = 25;

const MEDIUM_RISK_DENSITY_LIMIT = 3;
const HIGH_RISK_DENSITY_LIMIT = 2;
const DENSITY_ESCALATION_SCORE = 20;

const RULE_MAX_ACCUMULATION = 3; // prevent infinite stacking

// ─────────────────────────────────────────────────────────────────────────────
// Hard Block Patterns (Absolute)
// ─────────────────────────────────────────────────────────────────────────────

const HARD_BLOCK_PATTERNS: { pattern: RegExp | string; label: string }[] = [
  { pattern: "rm -rf", label: "destructive rm -rf" },
  { pattern: "rmdir /s", label: "destructive rmdir /s" },
  { pattern: "del /f", label: "force delete del /f" },
  { pattern: "format c:", label: "disk format" },
  { pattern: "shutdown", label: "system shutdown" },
  { pattern: "reboot", label: "system reboot" },
  { pattern: /reg\s+(add|delete)/i, label: "registry edit" },
  { pattern: /HKEY_/i, label: "registry access" },
  { pattern: "DROP TABLE", label: "SQL drop table" },
  { pattern: "DELETE FROM", label: "SQL delete" },
  { pattern: "> /dev/sda", label: "raw disk write" },
  { pattern: "mkfs", label: "filesystem format" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ComplexityLevel = "low" | "medium" | "high" | "blocked";
export type Recommendation = "executor" | "openclaw" | "block";

export interface ScoreBreakdown {
  rule: string;
  weight: number;
  source: "action" | "plan" | "density" | "count";
}

export interface ComplexityReport {
  totalScore: number;
  level: ComplexityLevel;
  recommendation: Recommendation;
  actionCount: number;
  escalatedByCount: boolean;
  escalatedByDensity: boolean;
  hardBlocked: boolean;
  hardBlockReason?: string;
  dominantFactors: string[];
  breakdown: ScoreBreakdown[];
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────

function matchesHardBlock(value: string): string | null {
  for (const { pattern, label } of HARD_BLOCK_PATTERNS) {
    if (typeof pattern === "string") {
      if (value.toLowerCase().includes(pattern.toLowerCase())) return label;
    } else {
      if (pattern.test(value)) return label;
    }
  }
  return null;
}

function normalizeRisk(risk?: string) {
  return (risk || "").toLowerCase();
}

function isPathOutsideSandbox(p: string): boolean {
  const resolved = path.resolve(SANDBOX, p);
  return !resolved.startsWith(SANDBOX);
}

// ─────────────────────────────────────────────────────────────────────────────
// ComplexityScorer
// ─────────────────────────────────────────────────────────────────────────────

export class ComplexityScorer {

  score(plan: Plan): ComplexityReport {

    // ── Empty plan hard block ──────────────────────────────────────────────
    if (!plan.actions || plan.actions.length === 0) {
      return this.hardBlock(plan, "empty plan");
    }

    let totalScore = 0;
    const breakdown: ScoreBreakdown[] = [];

    // ── 1. Hard override gates (scan command + path + content) ────────────
    for (const action of plan.actions) {
      const scanTarget =
        (action.command || "") +
        " " +
        (action.path || "") +
        " " +
        (action.content || "");

      const reason = matchesHardBlock(scanTarget);
      if (reason) {
        return this.hardBlock(plan, reason);
      }
    }

    // ── 2. Per-action scoring (with caps) ──────────────────────────────────
    const ruleHits: Record<string, number> = {};

    for (const action of plan.actions) {
      const risk = normalizeRisk(action.risk);

      const actionRules = [
        { name: "system_task type", weight: 25, match: action.type === "system_task" },
        { name: "high risk flag", weight: 20, match: risk === "high" },
        { name: "medium risk flag", weight: 8, match: risk === "medium" },
        { name: "git operation", weight: 15, match: !!action.command?.match(/^git /) },
        { name: "path outside sandbox", weight: 25, match: !!action.path && isPathOutsideSandbox(action.path) },
        { name: "chained command", weight: 10, match: !!action.command?.includes("&&") },
        { name: "network command", weight: 12, match: !!action.command?.match(/\b(curl|wget|fetch|axios|http)\b/i) },
        { name: "package install", weight: 5, match: !!action.command?.match(/^(npm install|pip install|yarn add)/) },
      ];

      for (const rule of actionRules) {
        if (!rule.match) continue;

        ruleHits[rule.name] = (ruleHits[rule.name] || 0) + 1;
        if (ruleHits[rule.name] > RULE_MAX_ACCUMULATION) continue;

        totalScore += rule.weight;
        breakdown.push({
          rule: `[action:${action.type}] ${rule.name}`,
          weight: rule.weight,
          source: "action",
        });
      }
    }

    // ── 3. Plan-level scoring ──────────────────────────────────────────────
    const planRules = [
      { name: "LLM self-assessed high complexity", weight: 15, match: plan.complexity === "high" },
      { name: "LLM self-assessed medium complexity", weight: 5, match: plan.complexity === "medium" },
      { name: "LLM delegated to openclaw", weight: 20, match: plan.delegateTo === "openclaw" },
      { name: "mixed action types (3+)", weight: 8, match: new Set(plan.actions.map(a => a.type)).size >= 3 },
    ];

    for (const rule of planRules) {
      if (!rule.match) continue;
      totalScore += rule.weight;
      breakdown.push({
        rule: `[plan] ${rule.name}`,
        weight: rule.weight,
        source: "plan",
      });
    }

    // ── 4. Action count escalation ─────────────────────────────────────────
    const escalatedByCount = plan.actions.length > ACTION_COUNT_ESCALATION_LIMIT;

    if (escalatedByCount) {
      totalScore += ACTION_COUNT_ESCALATION_SCORE;
      breakdown.push({
        rule: `[plan] action count ${plan.actions.length} exceeds ${ACTION_COUNT_ESCALATION_LIMIT}`,
        weight: ACTION_COUNT_ESCALATION_SCORE,
        source: "count",
      });
    }

    // ── 5. Risk density escalation (no double amplification explosion) ─────
    const mediumCount = plan.actions.filter(a => normalizeRisk(a.risk) === "medium").length;
    const highCount   = plan.actions.filter(a => normalizeRisk(a.risk) === "high").length;

    const escalatedByDensity =
      mediumCount >= MEDIUM_RISK_DENSITY_LIMIT ||
      highCount   >= HIGH_RISK_DENSITY_LIMIT;

    if (escalatedByDensity) {
      totalScore += DENSITY_ESCALATION_SCORE;
      breakdown.push({
        rule: `[plan] risk density (medium:${mediumCount} high:${highCount})`,
        weight: DENSITY_ESCALATION_SCORE,
        source: "density",
      });
    }

    // ── 6. Absolute safety cap ─────────────────────────────────────────────
    if (totalScore >= ABSOLUTE_BLOCK_THRESHOLD) {
      return this.hardBlock(plan, "absolute block threshold exceeded");
    }

    // ── 7. Final classification ─────────────────────────────────────────────
    let level: ComplexityLevel;
    let recommendation: Recommendation;

    if (totalScore >= OPENCLAW_THRESHOLD || escalatedByCount || escalatedByDensity) {
      level = "high";
      recommendation = "openclaw";
    } else if (totalScore >= EXECUTOR_THRESHOLD) {
      level = "medium";
      recommendation = "openclaw";
    } else if (totalScore >= LOW_TO_MEDIUM_THRESHOLD) {
      level = "medium";
      recommendation = "executor";
    } else {
      level = "low";
      recommendation = "executor";
    }

    // ── 8. Dominant factors ────────────────────────────────────────────────
    const dominantFactors = [...breakdown]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map(b => b.rule);

    const summary = [
      `Score: ${totalScore}`,
      escalatedByCount ? `count-escalated (${plan.actions.length})` : null,
      escalatedByDensity ? `density-escalated` : null,
      `level: ${level}`,
      `→ ${recommendation}`,
    ].filter(Boolean).join(" | ");

    return {
      totalScore,
      level,
      recommendation,
      actionCount: plan.actions.length,
      escalatedByCount,
      escalatedByDensity,
      hardBlocked: false,
      dominantFactors,
      breakdown,
      summary,
    };
  }

  private hardBlock(plan: Plan, reason: string): ComplexityReport {
    return {
      totalScore: 999,
      level: "blocked",
      recommendation: "block",
      actionCount: plan.actions.length,
      escalatedByCount: false,
      escalatedByDensity: false,
      hardBlocked: true,
      hardBlockReason: reason,
      dominantFactors: [`hard block: ${reason}`],
      breakdown: [{ rule: `HARD BLOCK: ${reason}`, weight: 999, source: "action" }],
      summary: `HARD BLOCKED — ${reason}`,
    };
  }

  printReport(report: ComplexityReport) {
    const emoji =
      report.hardBlocked ? "🚫" :
      report.recommendation === "block" ? "⛔" :
      report.recommendation === "openclaw" ? "🦾" : "⚙";

    console.log(`\n📊 Complexity Report`);
    console.log(`   Score    : ${report.totalScore}${report.hardBlocked ? " (HARD BLOCK)" : ""}`);
    console.log(`   Level    : ${report.level}`);
    console.log(`   Actions  : ${report.actionCount}${report.escalatedByCount ? " ⚠ count-escalated" : ""}`);
    if (report.escalatedByDensity) {
      console.log(`   Density  : ⚠ risk density escalation`);
    }
    console.log(`   Decision : ${emoji} ${report.recommendation.toUpperCase()}`);

    if (report.dominantFactors.length) {
      console.log(`   Dominant :`);
      for (const f of report.dominantFactors) {
        console.log(`     → ${f}`);
      }
    }

    console.log(`   Summary  : ${report.summary}\n`);
  }
}