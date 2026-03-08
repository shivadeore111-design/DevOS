// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// research/queryGenerator.ts — Generates search queries from goal

import { ParsedGoal } from "../core/goalParser";

export interface GeneratedQuery {
  query:    string;
  priority: number;  // 1 = highest
  strategy: string;
}

export class QueryGenerator {

  generate(goal: string, parsedGoal?: ParsedGoal): GeneratedQuery[] {
    const type   = parsedGoal?.type   ?? "research";
    const domain = parsedGoal?.domain ?? "general";
    const stack  = parsedGoal?.stack  ?? [];

    const queries: GeneratedQuery[] = [];

    // ── Strategy 1: direct goal query ───────────────────────
    queries.push({
      query:    this.clean(goal),
      priority: 1,
      strategy: "direct",
    });

    // ── Strategy 2: type-specific queries ───────────────────
    if (type === "research") {
      queries.push({
        query:    `${this.clean(goal)} overview guide`,
        priority: 2,
        strategy: "overview",
      });
      queries.push({
        query:    `${this.clean(goal)} best practices`,
        priority: 3,
        strategy: "best-practices",
      });
    }

    if (type === "build") {
      const stackHint = stack.slice(0, 2).join(" ");
      queries.push({
        query:    `how to build ${this.clean(goal)} ${stackHint}`.trim(),
        priority: 2,
        strategy: "how-to-build",
      });
      queries.push({
        query:    `${stackHint} ${this.clean(goal)} tutorial example`.trim(),
        priority: 3,
        strategy: "tutorial",
      });
    }

    if (type === "debug") {
      queries.push({
        query:    `${this.clean(goal)} error fix solution`,
        priority: 2,
        strategy: "error-fix",
      });
      queries.push({
        query:    `${stack.slice(0, 1).join(" ")} ${this.clean(goal)} stackoverflow`.trim(),
        priority: 3,
        strategy: "community",
      });
    }

    if (type === "deploy") {
      queries.push({
        query:    `${this.clean(goal)} deployment guide production`,
        priority: 2,
        strategy: "deployment",
      });
    }

    // ── Strategy 3: domain-enriched ─────────────────────────
    if (domain && domain !== "general") {
      queries.push({
        query:    `${domain} ${this.clean(goal)}`,
        priority: 4,
        strategy: "domain-enriched",
      });
    }

    // ── Strategy 4: stack-enriched ───────────────────────────
    if (stack.length > 0) {
      const topStack = stack.slice(0, 2).join(" + ");
      queries.push({
        query:    `${topStack} ${this.clean(goal)}`,
        priority: 5,
        strategy: "stack-enriched",
      });
    }

    // Deduplicate and cap at 5
    const seen  = new Set<string>();
    const final: GeneratedQuery[] = [];

    for (const q of queries.sort((a, b) => a.priority - b.priority)) {
      const norm = q.query.toLowerCase().replace(/\s+/g, " ").trim();
      if (!seen.has(norm)) {
        seen.add(norm);
        final.push(q);
      }
      if (final.length >= 5) break;
    }

    console.log(`[QueryGenerator] Generated ${final.length} queries for: "${goal}"`);
    return final;
  }

  private clean(text: string): string {
    return text
      .replace(/["""'']/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
  }
}

export const queryGenerator = new QueryGenerator();
