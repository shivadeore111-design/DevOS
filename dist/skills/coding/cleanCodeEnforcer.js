"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanCodeEnforcer = exports.CleanCodeEnforcer = void 0;
// ============================================================
// skills/coding/cleanCodeEnforcer.ts
// Analyses TypeScript/JavaScript files for code quality issues.
// Checks: duplication, complexity, naming, function length.
// ============================================================
const fs_1 = __importDefault(require("fs"));
const router_1 = require("../../llm/router");
// ── Skill ─────────────────────────────────────────────────────
class CleanCodeEnforcer {
    constructor() {
        this.name = "clean_code_enforcer";
        this.description = "Analyses TypeScript/JavaScript files for duplication, complexity, naming, and function length — returns findings with line numbers";
    }
    async execute(args) {
        return this.analyze(args.filePath);
    }
    async analyze(filePath) {
        if (!fs_1.default.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        const source = fs_1.default.readFileSync(filePath, "utf-8");
        const lines = source.split("\n");
        const linesOfCode = lines.filter(l => l.trim() && !l.trim().startsWith("//")).length;
        // Run quick static checks locally (no LLM needed for these)
        const staticFindings = this.runStaticChecks(lines);
        // Then use LLM for semantic analysis
        const systemPrompt = `You are a code quality expert. Analyse code for: duplication, cyclomatic complexity, naming conventions, overly long functions, magic numbers, dead code, missing TypeScript types, missing error handling.
Return ONLY valid JSON — no markdown, no text.`;
        // Limit source to 4000 chars to avoid context overflow
        const truncated = source.length > 4000
            ? source.slice(0, 4000) + "\n// ... (truncated)"
            : source;
        const prompt = `Analyse this code for quality issues:

\`\`\`
${truncated}
\`\`\`

Return JSON:
{
  "score": 75,
  "findings": [
    {
      "type": "naming|duplication|complexity|function_length|magic_number|dead_code|missing_types|error_handling",
      "line": 42,
      "lineEnd": 60,
      "symbol": "processData",
      "message": "Function is 80 lines long",
      "suggestion": "Extract helper functions for each responsibility",
      "severity": "warning"
    }
  ],
  "summary": "Short overall assessment",
  "topIssue": "Single most impactful issue to fix"
}`;
        const fallback = {
            score: 70,
            findings: staticFindings,
            summary: `Static analysis found ${staticFindings.length} issue(s). Run with a live LLM for deeper analysis.`,
            topIssue: staticFindings[0]?.message ?? "No critical issues found",
        };
        const result = await (0, router_1.llmCallJSON)(prompt, systemPrompt, fallback);
        // Merge LLM findings with static findings
        const allFindings = [...staticFindings, ...(result.findings ?? [])];
        const score = Math.max(0, Math.min(100, result.score ?? 70));
        const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 45 ? "D" : "F";
        return {
            filePath,
            linesOfCode,
            score,
            grade,
            findings: allFindings,
            summary: result.summary ?? fallback.summary,
            topIssue: result.topIssue ?? fallback.topIssue,
            generatedAt: new Date().toISOString(),
        };
    }
    // ── Static heuristic checks ───────────────────────────────
    runStaticChecks(lines) {
        const findings = [];
        // Check function length (> 50 lines)
        let funcStart = -1;
        let funcName = "";
        let braceDepth = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const funcMatch = line.match(/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\()/);
            if (funcMatch && braceDepth === 0) {
                funcStart = i;
                funcName = funcMatch[1] ?? funcMatch[2] ?? "anonymous";
            }
            braceDepth += (line.match(/\{/g) ?? []).length;
            braceDepth -= (line.match(/\}/g) ?? []).length;
            if (funcStart >= 0 && braceDepth <= 0) {
                const length = i - funcStart + 1;
                if (length > 50) {
                    findings.push({
                        type: "function_length",
                        line: funcStart + 1,
                        lineEnd: i + 1,
                        symbol: funcName,
                        message: `Function "${funcName}" is ${length} lines long (limit: 50)`,
                        suggestion: "Break into smaller, single-responsibility functions",
                        severity: length > 100 ? "error" : "warning",
                    });
                }
                funcStart = -1;
                braceDepth = 0;
            }
            // Magic numbers
            const magicMatch = line.match(/(?<!['"a-zA-Z_])\b([2-9]\d{2,}|\d{4,})\b(?!['"ms])/);
            if (magicMatch && !line.trim().startsWith("//")) {
                findings.push({
                    type: "magic_number",
                    line: i + 1,
                    message: `Magic number ${magicMatch[1]} on line ${i + 1}`,
                    suggestion: "Extract to a named constant",
                    severity: "info",
                });
            }
            // any type
            if (line.includes(": any") && !line.trim().startsWith("//")) {
                findings.push({
                    type: "missing_types",
                    line: i + 1,
                    message: `Explicit 'any' type on line ${i + 1}`,
                    suggestion: "Replace with specific type or unknown",
                    severity: "warning",
                });
            }
        }
        return findings;
    }
}
exports.CleanCodeEnforcer = CleanCodeEnforcer;
exports.cleanCodeEnforcer = new CleanCodeEnforcer();
