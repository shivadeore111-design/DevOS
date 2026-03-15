"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.skillGenerator = exports.SkillGenerator = void 0;
// ============================================================
// devos/evolution/skillGenerator.ts — LLM-powered Skill Generator
// Uses Ollama qwen2.5-coder:14b to improve or create skills.
// ============================================================
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const axios_1 = __importDefault(require("axios"));
const SKILLS_ROOT = path_1.default.join(process.cwd(), "skills");
// ── SkillGenerator ────────────────────────────────────────────
class SkillGenerator {
    constructor(ollamaBaseUrl = "http://localhost:11434") {
        this.ollamaUrl = ollamaBaseUrl;
    }
    /**
     * Read the current on-disk code for a skill and ask Ollama to improve it.
     */
    async improve(skillName, reason, currentCode) {
        const prompt = [
            `You are improving a DevOS skill module.`,
            `Skill: ${skillName}`,
            `Improvement needed: ${reason}`,
            `Current code:\n${currentCode}`,
            ``,
            `Generate an improved TypeScript implementation that fixes the issue.`,
            `Return ONLY valid TypeScript code, no explanation.`,
        ].join("\n");
        const code = await this._callOllama(prompt);
        const version = `v${Date.now()}`;
        return {
            skillName,
            version,
            code,
            generatedAt: new Date().toISOString(),
            basedOn: skillName,
            improvementReason: reason,
        };
    }
    /**
     * Generate a brand-new skill from scratch for the given capability.
     * Saves it to skills/generated/<capability>.ts.
     */
    async createNew(capability) {
        const prompt = [
            `You are creating a new DevOS skill module.`,
            `Required capability: ${capability}`,
            ``,
            `Generate a TypeScript module that implements this capability as a DevOS Skill.`,
            `The skill must match this interface exactly:`,
            ``,
            `export interface Skill {`,
            `  name:        string;`,
            `  description: string;`,
            `  category?:   string;`,
            `  execute(args: any): Promise<any>;`,
            `}`,
            ``,
            `Export a const that implements Skill, named after the capability in camelCase.`,
            `Include full error handling. Return ONLY valid TypeScript code, no explanation.`,
        ].join("\n");
        const code = await this._callOllama(prompt);
        const skillName = this._toCamelCase(capability);
        const version = `v${Date.now()}`;
        // Persist to skills/generated/<skillName>.ts
        const generatedDir = path_1.default.join(SKILLS_ROOT, "generated");
        if (!fs_1.default.existsSync(generatedDir)) {
            fs_1.default.mkdirSync(generatedDir, { recursive: true });
        }
        const filePath = path_1.default.join(generatedDir, `${skillName}.ts`);
        fs_1.default.writeFileSync(filePath, code, "utf-8");
        console.log(`[SkillGenerator] Created new skill: ${filePath}`);
        return {
            skillName,
            version,
            code,
            generatedAt: new Date().toISOString(),
            improvementReason: `New skill generated for capability: ${capability}`,
        };
    }
    // ── Private ──────────────────────────────────────────────────
    async _callOllama(prompt) {
        try {
            const response = await axios_1.default.post(`${this.ollamaUrl}/api/generate`, {
                model: "qwen2.5-coder:14b",
                prompt,
                stream: false,
                options: { temperature: 0.2 },
            }, { timeout: 180000 });
            return (response.data?.response ?? "").trim();
        }
        catch (err) {
            throw new Error(`[SkillGenerator] Ollama call failed: ${err.message}`);
        }
    }
    _toCamelCase(str) {
        return str
            .replace(/[^a-zA-Z0-9 ]/g, " ")
            .split(/\s+/)
            .filter(Boolean)
            .map((w, i) => i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())
            .join("");
    }
}
exports.SkillGenerator = SkillGenerator;
// ── Singleton ─────────────────────────────────────────────────
exports.skillGenerator = new SkillGenerator();
