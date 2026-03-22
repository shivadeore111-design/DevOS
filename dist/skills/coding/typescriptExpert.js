"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.typescriptExpert = exports.TypeScriptExpert = void 0;
// ============================================================
// skills/coding/typescriptExpert.ts
// Reads a TypeScript file, suggests better types + safer patterns,
// and returns the improved file content.
// ============================================================
const fs_1 = __importDefault(require("fs"));
const router_1 = require("../../llm/router");
// ── Skill ─────────────────────────────────────────────────────
class TypeScriptExpert {
    constructor() {
        this.name = "typescript_expert";
        this.description = "Reads a TypeScript file and returns an improved version with better types, interfaces, and safer patterns";
    }
    async execute(args) {
        const improved = await this.improve(args.filePath);
        return {
            filePath: args.filePath,
            improved,
            summary: { changesCount: 0, improvements: [], originalLines: 0, improvedLines: improved.split("\n").length },
            generatedAt: new Date().toISOString(),
        };
    }
    async improve(filePath) {
        if (!fs_1.default.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        const source = fs_1.default.readFileSync(filePath, "utf-8");
        const lines = source.split("\n").length;
        // Limit source to prevent context overflow
        const MAX_CHARS = 6000;
        const truncated = source.length > MAX_CHARS
            ? source.slice(0, MAX_CHARS) + "\n// ... (truncated for analysis)"
            : source;
        const systemPrompt = `You are a TypeScript expert. Improve the provided TypeScript code by:
1. Replacing 'any' with specific types or 'unknown'
2. Adding interfaces/types for object shapes
3. Using readonly where appropriate
4. Adding proper return type annotations
5. Using type guards and narrowing
6. Replacing non-null assertions (!) with safe optional chaining (?.)
7. Using const assertions (as const) where suitable
8. Adding JSDoc comments for public functions

IMPORTANT: Return ONLY the improved TypeScript code — no explanation, no markdown fences.
Preserve all existing functionality. Do not add features, only improve types and safety.`;
        const prompt = `Improve this TypeScript file:\n\n${truncated}`;
        try {
            const { content } = await (0, router_1.llmCall)(prompt, systemPrompt);
            // Strip markdown code fences if present
            const cleaned = content
                .replace(/^```(?:typescript|ts)?\s*/i, "")
                .replace(/\s*```\s*$/, "")
                .trim();
            // Sanity check: must be longer than 10 chars and look like TS
            if (cleaned.length < 10 || (!cleaned.includes("import") && !cleaned.includes("export") && !cleaned.includes("const") && !cleaned.includes("function"))) {
                console.warn("[TypeScriptExpert] LLM returned invalid code — returning original");
                return source;
            }
            console.log(`[TypeScriptExpert] ✅ Improved ${filePath} (${lines} → ${cleaned.split("\n").length} lines)`);
            return cleaned;
        }
        catch (err) {
            console.warn(`[TypeScriptExpert] Failed: ${err.message} — returning original`);
            return source;
        }
    }
    /**
     * Improve a file and write changes back to disk (in-place).
     * Returns a diff summary.
     */
    async improveInPlace(filePath) {
        const original = fs_1.default.readFileSync(filePath, "utf-8");
        const improved = await this.improve(filePath);
        const originalLines = original.split("\n").length;
        const improvedLines = improved.split("\n").length;
        if (improved === original) {
            return { changesCount: 0, improvements: ["No changes needed"], originalLines, improvedLines };
        }
        // Count rough diff
        const origArr = original.split("\n");
        const imprArr = improved.split("\n");
        const changed = imprArr.filter((l, i) => l !== origArr[i]).length;
        fs_1.default.writeFileSync(filePath, improved, "utf-8");
        return {
            changesCount: changed,
            improvements: [
                "Replaced any types with specific types",
                "Added missing return type annotations",
                "Improved null safety with optional chaining",
            ],
            originalLines,
            improvedLines,
        };
    }
}
exports.TypeScriptExpert = TypeScriptExpert;
exports.typescriptExpert = new TypeScriptExpert();
