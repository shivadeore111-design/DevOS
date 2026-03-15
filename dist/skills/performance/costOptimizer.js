"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.costOptimizer = exports.CostOptimizer = void 0;
// ============================================================
// skills/performance/costOptimizer.ts
// Scans a project for unnecessary API calls, unoptimized queries,
// and redundant compute. Returns findings with estimated savings.
// ============================================================
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const router_1 = require("../../llm/router");
// ── Skill ─────────────────────────────────────────────────────
class CostOptimizer {
    constructor() {
        this.name = "cost_optimizer";
        this.description = "Scans a project for unnecessary API calls, unoptimized queries, and redundant compute — returns findings with estimated savings";
    }
    async execute(args) {
        return this.analyze(args.projectDir);
    }
    async analyze(projectDir) {
        if (!fs_1.default.existsSync(projectDir)) {
            throw new Error(`Directory not found: ${projectDir}`);
        }
        const tsFiles = this.collectSourceFiles(projectDir);
        const staticFindings = this.runStaticScan(tsFiles, projectDir);
        // Build a condensed code summary for LLM analysis (avoid token overflow)
        const codeSnippets = tsFiles
            .slice(0, 8)
            .map(f => {
            const rel = path_1.default.relative(projectDir, f);
            const src = fs_1.default.readFileSync(f, "utf-8").slice(0, 800);
            return `// ${rel}\n${src}`;
        })
            .join("\n\n---\n\n");
        const systemPrompt = `You are a cloud cost and performance optimisation engineer.
Identify cost drivers: unnecessary API calls, N+1 queries, missing caches, polling loops, large payloads, unused deps.
Return ONLY valid JSON — no markdown, no text.`;
        const prompt = `Scan this codebase for cost and performance issues:

${codeSnippets.slice(0, 5000)}

Return JSON:
{
  "findings": [
    {
      "type": "unnecessary_api_call|unoptimized_query|redundant_compute|missing_cache|n_plus_one|large_payload|polling_instead_of_webhook|unused_dependency",
      "file": "src/service.ts",
      "line": 42,
      "description": "What the issue is",
      "estimatedSavings": "$20/mo or 30% CPU reduction",
      "recommendation": "How to fix it",
      "effort": "low|medium|high",
      "priority": "high|medium|low"
    }
  ],
  "summary": "Overall assessment",
  "totalEstimatedSavings": "$50/mo"
}`;
        const fallback = {
            findings: staticFindings,
            summary: `Static scan found ${staticFindings.length} potential issue(s).`,
            totalEstimatedSavings: "Varies",
        };
        const llmResult = await (0, router_1.llmCallJSON)(prompt, systemPrompt, fallback);
        const allFindings = this.deduplicateFindings([
            ...staticFindings,
            ...(llmResult.findings ?? []),
        ]);
        const quickWins = allFindings
            .filter(f => f.effort === "low" && f.priority === "high")
            .slice(0, 5);
        return {
            projectDir,
            filesScanned: tsFiles.length,
            findings: allFindings,
            summary: llmResult.summary ?? fallback.summary,
            totalEstimatedSavings: llmResult.totalEstimatedSavings ?? fallback.totalEstimatedSavings,
            quickWins,
            generatedAt: new Date().toISOString(),
        };
    }
    // ── Static scan ───────────────────────────────────────────
    runStaticScan(files, baseDir) {
        const findings = [];
        for (const file of files) {
            const rel = path_1.default.relative(baseDir, file);
            const source = fs_1.default.readFileSync(file, "utf-8");
            const lines = source.split("\n");
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                // Detect polling patterns
                if (/setInterval\s*\(/.test(line) && /fetch|axios|http/i.test(source)) {
                    findings.push({
                        type: "polling_instead_of_webhook",
                        file: rel,
                        line: i + 1,
                        description: "setInterval-based polling detected — may indicate a polling loop instead of event-driven approach",
                        estimatedSavings: "50-90% reduction in API calls",
                        recommendation: "Replace polling with webhooks, WebSockets, or Server-Sent Events",
                        effort: "medium",
                        priority: "medium",
                    });
                }
                // Detect queries inside loops (N+1)
                if (/for\s*\(|forEach\s*\(|map\s*\(/.test(line)) {
                    const lookahead = lines.slice(i + 1, i + 6).join("\n");
                    if (/await\s+.*(?:find|query|select|get|fetch)/i.test(lookahead)) {
                        findings.push({
                            type: "n_plus_one",
                            file: rel,
                            line: i + 1,
                            description: "Possible N+1 query: database/API call inside a loop",
                            estimatedSavings: "10x–100x query reduction",
                            recommendation: "Batch the queries using findMany/IN clause or Promise.all outside the loop",
                            effort: "medium",
                            priority: "high",
                        });
                    }
                }
                // Missing cache for expensive operations
                if (/await\s+.*(?:llmCall|callOllama|openai|anthropic)/i.test(line) && !/cache|memo/i.test(source)) {
                    findings.push({
                        type: "missing_cache",
                        file: rel,
                        line: i + 1,
                        description: "LLM API call without caching — identical prompts billed repeatedly",
                        estimatedSavings: "30-70% token cost reduction",
                        recommendation: "Cache LLM responses by prompt hash with a Redis TTL of 1-24h",
                        effort: "low",
                        priority: "high",
                    });
                }
            }
        }
        return findings;
    }
    collectSourceFiles(dir, exts = [".ts", ".js"]) {
        const results = [];
        const skip = new Set(["node_modules", ".git", "dist", "build", ".next"]);
        const walk = (d) => {
            if (!fs_1.default.existsSync(d))
                return;
            for (const entry of fs_1.default.readdirSync(d, { withFileTypes: true })) {
                if (entry.isDirectory() && !skip.has(entry.name)) {
                    walk(path_1.default.join(d, entry.name));
                }
                else if (entry.isFile() && exts.some(e => entry.name.endsWith(e))) {
                    results.push(path_1.default.join(d, entry.name));
                }
            }
        };
        walk(dir);
        return results;
    }
    deduplicateFindings(findings) {
        const seen = new Set();
        return findings.filter(f => {
            const key = `${f.type}:${f.file}:${f.line ?? ""}`;
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
    }
}
exports.CostOptimizer = CostOptimizer;
exports.costOptimizer = new CostOptimizer();
