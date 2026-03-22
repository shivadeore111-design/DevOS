// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// ============================================================
// memory/taskPatterns.ts — Learn and reuse successful task plans
//
// When a plan succeeds, store it.
// Next time a similar goal appears, retrieve the pattern
// and use it as a planning hint — 10x faster planning.
//
// Example:
//   "create SaaS MVP" → saves steps: plan, scaffold, deps, routes, UI, test
//   Next run → planner gets those steps as a template
// ============================================================

import fs   from "fs";
import path from "path";
import { embed } from "./vectorMemory";

const PATTERNS_FILE = path.join(process.cwd(), "workspace", "memory", "taskPatterns.json");

// ── Types ─────────────────────────────────────────────────────

export interface TaskPattern {
  id:           string;
  goalTemplate: string;        // canonical form of the goal
  embedding:    number[];      // for similarity search
  plan:         any;           // the successful plan object
  usageCount:   number;
  successCount: number;
  createdAt:    string;
  lastUsedAt:   string;
  tags:         string[];
}

// ── Storage ───────────────────────────────────────────────────

function load(): TaskPattern[] {
  try {
    if (fs.existsSync(PATTERNS_FILE)) {
      return JSON.parse(fs.readFileSync(PATTERNS_FILE, "utf-8"));
    }
  } catch { /* fallback */ }
  return [];
}

function save(patterns: TaskPattern[]): void {
  const dir = path.dirname(PATTERNS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = PATTERNS_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(patterns, null, 2));
  fs.renameSync(tmp, PATTERNS_FILE);
}

function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, nA = 0, nB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    nA  += a[i] * a[i];
    nB  += b[i] * b[i];
  }
  const d = Math.sqrt(nA) * Math.sqrt(nB);
  return d === 0 ? 0 : dot / d;
}

// ── TaskPatternMemory ─────────────────────────────────────────

export class TaskPatternMemory {

  /**
   * Save a successful plan as a reusable pattern.
   * Called from runner.ts when a task completes successfully.
   */
  static async save(
    goal:  string,
    plan:  any,
    tags:  string[] = []
  ): Promise<void> {
    const patterns  = load();
    const embedding = await embed(goal);

    // Check for near-duplicate (>0.92 similarity)
    for (const p of patterns) {
      if (cosineSim(embedding, p.embedding) > 0.92) {
        p.usageCount   += 1;
        p.successCount += 1;
        p.lastUsedAt    = new Date().toISOString();
        // Update the plan to the latest successful version
        p.plan          = plan;
        save(patterns);
        console.log(`[TaskPatterns] Updated existing pattern for: "${goal.slice(0, 60)}"`);
        return;
      }
    }

    // New pattern
    const pattern: TaskPattern = {
      id:           `pat_${Date.now()}`,
      goalTemplate: goal,
      embedding,
      plan,
      usageCount:    1,
      successCount:  1,
      createdAt:     new Date().toISOString(),
      lastUsedAt:    new Date().toISOString(),
      tags,
    };

    patterns.push(pattern);
    save(patterns);
    console.log(`[TaskPatterns] Saved new pattern: "${goal.slice(0, 60)}"`);
  }

  /**
   * Find the best matching pattern for a goal.
   * Returns the pattern and similarity score, or null if no good match.
   */
  static async findBestMatch(
    goal:         string,
    minSimilarity = 0.70
  ): Promise<{ pattern: TaskPattern; similarity: number } | null> {
    const patterns = load();
    if (patterns.length === 0) return null;

    const embedding = await embed(goal);
    if (embedding.every(v => v === 0)) return null;

    let best: { pattern: TaskPattern; similarity: number } | null = null;

    for (const p of patterns) {
      const sim = cosineSim(embedding, p.embedding);
      if (sim >= minSimilarity && (!best || sim > best.similarity)) {
        best = { pattern: p, similarity: sim };
      }
    }

    return best;
  }

  /**
   * Get a planning hint string for injection into the planner prompt.
   * Returns empty string if no matching pattern.
   */
  static async getPlanningHint(goal: string): Promise<string> {
    const match = await this.findBestMatch(goal);
    if (!match) return "";

    const { pattern, similarity } = match;
    const pct = (similarity * 100).toFixed(0);

    const steps = Array.isArray(pattern.plan?.actions)
      ? pattern.plan.actions.map((a: any, i: number) =>
          `  ${i + 1}. ${a.type}: ${a.description ?? a.command ?? a.path ?? ""}`
        ).join("\n")
      : JSON.stringify(pattern.plan).slice(0, 400);

    return [
      `── Similar Past Plan (${pct}% match) ──────────────────`,
      `Goal: ${pattern.goalTemplate.slice(0, 80)}`,
      `Steps used (${pattern.successCount} successful runs):`,
      steps,
      `────────────────────────────────────────────────────────`,
      `Use this as a TEMPLATE. Adapt to the current goal.`,
    ].join("\n");
  }

  /**
   * Mark a pattern as used (even if current run hasn't completed yet).
   */
  static recordUsage(patternId: string): void {
    const patterns = load();
    const p = patterns.find(x => x.id === patternId);
    if (p) {
      p.usageCount  += 1;
      p.lastUsedAt   = new Date().toISOString();
      save(patterns);
    }
  }

  /**
   * Get all patterns sorted by usage frequency.
   */
  static getAll(): TaskPattern[] {
    return load().sort((a, b) => b.usageCount - a.usageCount);
  }

  /**
   * Format a summary for the dashboard.
   */
  static report(): string {
    const all = load();
    if (all.length === 0) return "  No task patterns learned yet.\n";

    const lines = ["  Task Patterns\n  " + "─".repeat(50)];
    for (const p of all.slice(0, 10)) {
      lines.push(
        `  ${p.goalTemplate.slice(0, 45).padEnd(45)} used: ${p.usageCount}x  ` +
        `success: ${p.successCount}x  steps: ${p.plan?.actions?.length ?? "?"}`
      );
    }
    return lines.join("\n") + "\n";
  }
}
