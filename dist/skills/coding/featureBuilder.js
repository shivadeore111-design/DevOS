"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.featureBuilder = exports.FeatureBuilder = void 0;
// ============================================================
// skills/coding/featureBuilder.ts
// Generates full feature implementations from a description.
// Writes code files directly to the project directory.
// ============================================================
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const router_1 = require("../../llm/router");
// ── Skill ─────────────────────────────────────────────────────
class FeatureBuilder {
    constructor() {
        this.name = "feature_builder";
        this.description = "Generates and writes full feature implementations (auth, payments, dashboards, REST endpoints) into a project directory";
    }
    async execute(args) {
        return this.build(args.feature, args.projectDir, args.context);
    }
    async build(feature, projectDir, context) {
        const contextSection = context
            ? `\n\nProject context:\n${context}`
            : "";
        const systemPrompt = `You are an expert software engineer. Generate complete, production-ready feature implementations.
Return a JSON array of files. Each file must have: relativePath (string), content (full file content), language (string).
Return ONLY the JSON array — no markdown, no explanation.`;
        const prompt = `Generate a complete implementation for: "${feature}"
Project directory: ${projectDir}${contextSection}

Examples of features: auth system (JWT + bcrypt), Stripe payment integration, admin dashboard, CRUD REST endpoints, websocket chat.

Return a JSON ARRAY of file objects:
[
  {
    "relativePath": "src/auth/authService.ts",
    "content": "import ...",
    "language": "typescript"
  },
  {
    "relativePath": "src/auth/authRouter.ts",
    "content": "import ...",
    "language": "typescript"
  }
]

Generate 2-6 files. Be thorough — include types, error handling, logging.`;
        const filesWritten = [];
        try {
            const { content } = await (0, router_1.llmCall)(prompt, systemPrompt);
            const generated = this.extractFilesArray(content);
            if (generated.length === 0) {
                // fallback: write a single stub file
                const stubPath = path_1.default.join(projectDir, "src", "features", `${feature.replace(/\s+/g, "_").toLowerCase()}.ts`);
                fs_1.default.mkdirSync(path_1.default.dirname(stubPath), { recursive: true });
                fs_1.default.writeFileSync(stubPath, `// ${feature}\n// TODO: implement\nexport {};\n`, "utf-8");
                filesWritten.push(stubPath);
                return {
                    feature, projectDir, filesWritten,
                    summary: `Stub created for "${feature}" — LLM output could not be parsed`,
                    success: true,
                };
            }
            for (const file of generated) {
                const fullPath = path_1.default.isAbsolute(file.relativePath)
                    ? file.relativePath
                    : path_1.default.join(projectDir, file.relativePath);
                fs_1.default.mkdirSync(path_1.default.dirname(fullPath), { recursive: true });
                fs_1.default.writeFileSync(fullPath, file.content, "utf-8");
                filesWritten.push(file.relativePath);
                console.log(`[FeatureBuilder] ✅ Wrote: ${file.relativePath}`);
            }
            return {
                feature, projectDir, filesWritten,
                summary: `Successfully implemented "${feature}" in ${filesWritten.length} file(s)`,
                success: true,
            };
        }
        catch (err) {
            return {
                feature, projectDir, filesWritten,
                summary: `Failed: ${err.message}`,
                success: false,
                error: err.message,
            };
        }
    }
    extractFilesArray(text) {
        try {
            // Try matching a JSON array
            const match = text.match(/\[[\s\S]*\]/);
            if (!match)
                return [];
            const parsed = JSON.parse(match[0]);
            if (!Array.isArray(parsed))
                return [];
            return parsed.filter((f) => typeof f.relativePath === "string" && typeof f.content === "string");
        }
        catch {
            return [];
        }
    }
}
exports.FeatureBuilder = FeatureBuilder;
exports.featureBuilder = new FeatureBuilder();
