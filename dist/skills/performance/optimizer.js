"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceOptimizer = void 0;
const promises_1 = require("fs/promises");
class PerformanceOptimizer {
    async analyze(filePath) {
        const content = await (0, promises_1.readFile)(filePath, "utf-8");
        const lines = content.split("\n");
        const issues = [];
        lines.forEach((line, index) => {
            const lineNumber = index + 1;
            if (this.isSyncInsideAsync(line, lines, index)) {
                issues.push({
                    type: "sync-in-async",
                    line: lineNumber,
                    description: "Synchronous operation detected inside an async context.",
                    suggestion: "Replace synchronous APIs with async equivalents to avoid blocking.",
                    impact: "high"
                });
            }
            if (this.hasAwaitInLoop(line, lines, index)) {
                issues.push({
                    type: "blocking-loop",
                    line: lineNumber,
                    description: "Await detected inside an iterative loop, which can serialize operations.",
                    suggestion: "Batch operations with Promise.all or queue with controlled concurrency.",
                    impact: "medium"
                });
            }
            if (this.missingCachePattern(line)) {
                issues.push({
                    type: "missing-cache",
                    line: lineNumber,
                    description: "Potential repeated expensive computation without memoization/cache.",
                    suggestion: "Consider memoization or introducing a caching layer for repeated lookups.",
                    impact: "low"
                });
            }
        });
        const score = Math.max(0, 100 - issues.length * 12);
        const summary = issues.length === 0
            ? "No obvious performance anti-patterns detected."
            : `Detected ${issues.length} potential performance issue(s).`;
        return {
            file: filePath,
            issues,
            score,
            summary
        };
    }
    isSyncInsideAsync(line, lines, index) {
        if (!/(readFileSync|execSync)/.test(line)) {
            return false;
        }
        for (let i = index; i >= Math.max(0, index - 40); i -= 1) {
            if (/async\s+function|async\s*\([^)]*\)\s*=>/.test(lines[i])) {
                return true;
            }
        }
        return false;
    }
    hasAwaitInLoop(line, lines, index) {
        if (!/\bfor\b\s*\(.*\)/.test(line)) {
            return false;
        }
        const nextLines = lines.slice(index, index + 6).join("\n");
        return /await\s+/.test(nextLines);
    }
    missingCachePattern(line) {
        return /(fetch|get|load)\w*\([^)]*\)/.test(line) && !/(cache|memo|memoize)/i.test(line);
    }
}
exports.PerformanceOptimizer = PerformanceOptimizer;
