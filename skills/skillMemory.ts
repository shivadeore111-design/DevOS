// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// ============================================================
// skills/skillMemory.ts — Skill usage metrics and intelligence
//
// Tracks per-skill:
//   - success rate
//   - common failure modes
//   - last failure reason
//   - usage count
//   - avg duration
//
// Planner uses this to prefer reliable skills and avoid
// known-broken ones.
// ============================================================

import fs   from "fs";
import path from "path";

const METRICS_FILE = path.join(process.cwd(), "workspace", "memory", "skillMetrics.json");

// ── Types ─────────────────────────────────────────────────────

export interface SkillMetric {
  name:            string;
  totalRuns:       number;
  successes:       number;
  failures:        number;
  successRate:     number;        // 0–1
  avgDurationMs:   number;
  lastRunAt:       string;
  lastFailureAt?:  string;
  lastFailure?:    string;        // error message
  failurePatterns: string[];      // top recurring failure messages
  tags:            string[];
}

// ── Storage ───────────────────────────────────────────────────

function load(): Record<string, SkillMetric> {
  try {
    if (fs.existsSync(METRICS_FILE)) {
      return JSON.parse(fs.readFileSync(METRICS_FILE, "utf-8"));
    }
  } catch { /* fallback */ }
  return {};
}

function save(store: Record<string, SkillMetric>): void {
  const dir = path.dirname(METRICS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = METRICS_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, METRICS_FILE);
}

// ── SkillMemory ───────────────────────────────────────────────

export class SkillMemory {

  /**
   * Record a skill execution result.
   * Call this from skillExecutor.ts or runner.ts after each skill run.
   */
  static record(
    name:       string,
    success:    boolean,
    durationMs: number,
    error?:     string,
    tags:       string[] = []
  ): SkillMetric {
    const store  = load();
    const now    = new Date().toISOString();

    const existing = store[name] ?? {
      name,
      totalRuns:       0,
      successes:       0,
      failures:        0,
      successRate:     0,
      avgDurationMs:   0,
      lastRunAt:       now,
      failurePatterns: [],
      tags,
    };

    existing.totalRuns    += 1;
    existing.lastRunAt     = now;

    if (success) {
      existing.successes += 1;
    } else {
      existing.failures     += 1;
      existing.lastFailureAt = now;
      existing.lastFailure   = error;

      // Track recurring failure patterns (keep top 5)
      if (error) {
        const sig = error.slice(0, 80);
        if (!existing.failurePatterns.includes(sig)) {
          existing.failurePatterns = [sig, ...existing.failurePatterns].slice(0, 5);
        }
      }
    }

    // Rolling avg duration
    existing.avgDurationMs =
      (existing.avgDurationMs * (existing.totalRuns - 1) + durationMs) / existing.totalRuns;

    existing.successRate = existing.successes / existing.totalRuns;
    existing.tags        = tags.length > 0 ? tags : existing.tags;

    store[name] = existing;
    save(store);

    return existing;
  }

  /**
   * Get metrics for a specific skill.
   */
  static get(name: string): SkillMetric | undefined {
    return load()[name];
  }

  /**
   * Get all skill metrics, sorted by success rate descending.
   */
  static getAll(): SkillMetric[] {
    return Object.values(load()).sort((a, b) => b.successRate - a.successRate);
  }

  /**
   * Recommend the best skill for a given task description.
   * Filters skills with >50% success rate, scores by match + reliability.
   */
  static recommend(taskDescription: string): SkillMetric[] {
    const lower = taskDescription.toLowerCase();
    return this.getAll()
      .filter(s => s.totalRuns >= 2 && s.successRate >= 0.5)
      .filter(s =>
        s.name.toLowerCase().includes(lower.split(" ")[0]) ||
        s.tags.some(t => lower.includes(t))
      )
      .slice(0, 3);
  }

  /**
   * Return skills that have recently been failing.
   * Useful for the doctor command and planner warnings.
   */
  static getUnreliable(threshold = 0.5): SkillMetric[] {
    return this.getAll().filter(s => s.totalRuns >= 3 && s.successRate < threshold);
  }

  /**
   * Format a summary report for the dashboard / CLI.
   */
  static report(): string {
    const all = this.getAll();
    if (all.length === 0) return "  No skill usage recorded yet.\n";

    const lines = ["  Skill Performance\n  " + "─".repeat(50)];

    for (const s of all) {
      const rate = (s.successRate * 100).toFixed(0).padStart(3);
      const runs = String(s.totalRuns).padStart(4);
      const bar  = "█".repeat(Math.round(s.successRate * 10)) + "░".repeat(10 - Math.round(s.successRate * 10));
      lines.push(
        `  ${s.name.padEnd(30)} ${bar} ${rate}% (${runs} runs)`
      );
      if (s.lastFailure) {
        lines.push(`    └─ Last failure: ${s.lastFailure.slice(0, 60)}`);
      }
    }

    return lines.join("\n") + "\n";
  }
}
