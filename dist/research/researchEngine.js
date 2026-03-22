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
exports.researchEngine = exports.ResearchEngine = void 0;
// research/researchEngine.ts — Orchestrates the full research pipeline
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const queryGenerator_1 = require("./queryGenerator");
const searchRouter_1 = require("../web/searchRouter");
const pageFetcher_1 = require("../web/pageFetcher");
const relevanceScorer_1 = require("./relevanceScorer");
const insightSynthesizer_1 = require("./insightSynthesizer");
const researchCache_1 = require("./researchCache");
const eventBus_1 = require("../core/eventBus");
const REPORT_DIR = path.join(process.cwd(), "workspace", "research");
class ResearchEngine {
    async research(goal, parsedGoal) {
        const start = Date.now();
        const cacheKey = `report:${goal.toLowerCase().replace(/\s+/g, "-").slice(0, 60)}`;
        // ── Check full-report cache ───────────────────────────────
        const cached = researchCache_1.researchCache.get(cacheKey);
        if (cached && cached.summary) {
            console.log(`[ResearchEngine] Cache hit for full report: "${goal}"`);
            return cached.results[0];
        }
        console.log(`[ResearchEngine] Starting research: "${goal}"`);
        // ── 1. Generate queries ───────────────────────────────────
        const queries = queryGenerator_1.queryGenerator.generate(goal, parsedGoal);
        console.log(`[ResearchEngine] ${queries.length} queries generated`);
        // ── 2. Search (parallel via SearchRouter) ─────────────────
        const routerPromises = queries.map(q => searchRouter_1.searchRouter.search(q.query));
        const routerResults = await Promise.all(routerPromises);
        // Log which engine/method each query used
        let anySynthetic = false;
        routerResults.forEach((r, i) => {
            console.log(`[ResearchEngine] Query "${queries[i].query}" → ${r.engine} (${r.method}, ${r.results.length} results)`);
            if (r.method === "llm")
                anySynthetic = true;
        });
        // Flatten and deduplicate by URL
        const seen = new Set();
        const allResults = routerResults.flatMap(r => r.results).filter(r => {
            if (seen.has(r.url))
                return false;
            seen.add(r.url);
            return true;
        });
        console.log(`[ResearchEngine] ${allResults.length} unique results from ${queries.length} queries`);
        // ── 3. Score ──────────────────────────────────────────────
        const scored = relevanceScorer_1.relevanceScorer.score(allResults, goal, parsedGoal);
        const topResults = scored.filter(r => r.score > 0.1).slice(0, 8);
        console.log(`[ResearchEngine] Top ${topResults.length} relevant results selected`);
        // ── 4. Fetch pages (parallel) ─────────────────────────────
        const fetchPromises = topResults.map(r => (0, pageFetcher_1.fetchPage)(r.url));
        const fetched = await Promise.all(fetchPromises);
        const docs = topResults.map((r, i) => ({
            scored: r,
            fetched: fetched[i],
        }));
        const fetchedOk = docs.filter(d => d.fetched?.success).length;
        console.log(`[ResearchEngine] ${fetchedOk}/${docs.length} pages fetched successfully`);
        // ── 5. Synthesise insights ────────────────────────────────
        const synthesis = await insightSynthesizer_1.insightSynthesizer.synthesize(goal, docs);
        const durationMs = Date.now() - start;
        const syntheticNote = anySynthetic
            ? "\n\n> ⚠️ **Note:** Some or all sources for this report were generated by an LLM fallback " +
                "(no live web results were available). Treat citations as illustrative, not verified.\n"
            : "";
        const report = {
            goal,
            summary: synthesis.summary,
            insights: synthesis.insights,
            sources: synthesis.sources,
            rawReport: synthesis.rawReport + syntheticNote,
            durationMs,
            synthetic: anySynthetic || undefined,
        };
        // ── 6. Save report to disk ────────────────────────────────
        await this.saveReport(goal, synthesis.rawReport);
        // ── 7. Cache the full report ──────────────────────────────
        researchCache_1.researchCache.set(cacheKey, goal, [report], synthesis.summary, 12 * 60 * 60 * 1000);
        // ── 8. Emit event ─────────────────────────────────────────
        eventBus_1.eventBus.emit("research_completed", {
            goal,
            insightCount: synthesis.insights.length,
            sourceCount: synthesis.sources.length,
            durationMs,
        });
        console.log(`[ResearchEngine] ✅ Research complete — ` +
            `${synthesis.insights.length} insights, ` +
            `${synthesis.sources.length} sources, ` +
            `${(durationMs / 1000).toFixed(1)}s`);
        return report;
    }
    // ── Format insights as extraContext string ────────────────
    toExtraContext(report) {
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
    async saveReport(goal, markdown) {
        try {
            if (!fs.existsSync(REPORT_DIR))
                fs.mkdirSync(REPORT_DIR, { recursive: true });
            const slug = goal.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
            const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
            const outPath = path.join(REPORT_DIR, `${slug}-${ts}.md`);
            fs.writeFileSync(outPath, markdown, "utf-8");
            console.log(`[ResearchEngine] Report saved: ${outPath}`);
        }
        catch (err) {
            console.error(`[ResearchEngine] Failed to save report: ${err.message}`);
        }
    }
}
exports.ResearchEngine = ResearchEngine;
exports.researchEngine = new ResearchEngine();
