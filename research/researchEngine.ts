// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// research/researchEngine.ts — Orchestrates the full research pipeline

import * as fs                  from "fs";
import * as path                from "path";
import { queryGenerator }       from "./queryGenerator";
import { webSearch }            from "../web/searchEngine";
import { fetchPage }            from "../web/pageFetcher";
import { relevanceScorer }      from "./relevanceScorer";
import { insightSynthesizer,
         SourceDoc }            from "./insightSynthesizer";
import { researchCache }        from "./researchCache";
import { eventBus }             from "../core/eventBus";
import { ParsedGoal }           from "../core/goalParser";

export interface ResearchReport {
  goal:       string;
  summary:    string;
  insights:   Array<{ point: string; source?: string }>;
  sources:    string[];
  rawReport:  string;
  durationMs: number;
}

const REPORT_DIR = path.join(process.cwd(), "workspace", "research");

export class ResearchEngine {

  async research(goal: string, parsedGoal?: ParsedGoal): Promise<ResearchReport> {
    const start     = Date.now();
    const cacheKey  = `report:${goal.toLowerCase().replace(/\s+/g, "-").slice(0, 60)}`;

    // ── Check full-report cache ───────────────────────────────
    const cached = researchCache.get(cacheKey);
    if (cached && cached.summary) {
      console.log(`[ResearchEngine] Cache hit for full report: "${goal}"`);
      return cached.results[0] as ResearchReport;
    }

    console.log(`[ResearchEngine] Starting research: "${goal}"`);

    // ── 1. Generate queries ───────────────────────────────────
    const queries = queryGenerator.generate(goal, parsedGoal);
    console.log(`[ResearchEngine] ${queries.length} queries generated`);

    // ── 2. Search (parallel) ──────────────────────────────────
    const searchPromises = queries.map(q => webSearch(q.query));
    const searchResults  = await Promise.all(searchPromises);

    // Flatten and deduplicate by URL
    const seen     = new Set<string>();
    const allResults = searchResults.flat().filter(r => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    console.log(`[ResearchEngine] ${allResults.length} unique results from ${queries.length} queries`);

    // ── 3. Score ──────────────────────────────────────────────
    const scored = relevanceScorer.score(allResults, goal, parsedGoal);
    const topResults = scored.filter(r => r.score > 0.1).slice(0, 8);

    console.log(`[ResearchEngine] Top ${topResults.length} relevant results selected`);

    // ── 4. Fetch pages (parallel) ─────────────────────────────
    const fetchPromises = topResults.map(r => fetchPage(r.url));
    const fetched       = await Promise.all(fetchPromises);

    const docs: SourceDoc[] = topResults.map((r, i) => ({
      scored:  r,
      fetched: fetched[i],
    }));

    const fetchedOk = docs.filter(d => d.fetched?.success).length;
    console.log(`[ResearchEngine] ${fetchedOk}/${docs.length} pages fetched successfully`);

    // ── 5. Synthesise insights ────────────────────────────────
    const synthesis = await insightSynthesizer.synthesize(goal, docs);

    const durationMs = Date.now() - start;

    const report: ResearchReport = {
      goal,
      summary:   synthesis.summary,
      insights:  synthesis.insights,
      sources:   synthesis.sources,
      rawReport: synthesis.rawReport,
      durationMs,
    };

    // ── 6. Save report to disk ────────────────────────────────
    await this.saveReport(goal, synthesis.rawReport);

    // ── 7. Cache the full report ──────────────────────────────
    researchCache.set(cacheKey, goal, [report], synthesis.summary, 12 * 60 * 60 * 1000);

    // ── 8. Emit event ─────────────────────────────────────────
    eventBus.emit("research_completed", {
      goal,
      insightCount: synthesis.insights.length,
      sourceCount:  synthesis.sources.length,
      durationMs,
    });

    console.log(
      `[ResearchEngine] ✅ Research complete — ` +
      `${synthesis.insights.length} insights, ` +
      `${synthesis.sources.length} sources, ` +
      `${(durationMs / 1000).toFixed(1)}s`
    );

    return report;
  }

  // ── Format insights as extraContext string ────────────────

  toExtraContext(report: ResearchReport): string {
    const lines = [
      `RESEARCH CONTEXT for: "${report.goal}"`,
      "",
      `Summary: ${report.summary}`,
      "",
      "Key Insights:",
    ];
    report.insights.forEach((ins, i) => {
      lines.push(`  ${i + 1}. ${ins.point}`);
    });
    if (report.sources.length > 0) {
      lines.push("", "Sources:");
      report.sources.slice(0, 5).forEach(s => lines.push(`  - ${s}`));
    }
    return lines.join("\n");
  }

  // ── Persist report to workspace/research/ ────────────────

  private async saveReport(goal: string, markdown: string): Promise<void> {
    try {
      if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
      const slug    = goal.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
      const ts      = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const outPath = path.join(REPORT_DIR, `${slug}-${ts}.md`);
      fs.writeFileSync(outPath, markdown, "utf-8");
      console.log(`[ResearchEngine] Report saved: ${outPath}`);
    } catch (err: any) {
      console.error(`[ResearchEngine] Failed to save report: ${err.message}`);
    }
  }
}

export const researchEngine = new ResearchEngine();
