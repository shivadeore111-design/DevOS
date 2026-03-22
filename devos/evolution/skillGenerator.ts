// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// ============================================================
// devos/evolution/skillGenerator.ts — LLM-powered Skill Generator
// Uses Ollama qwen2.5-coder:14b to improve or create skills.
// ============================================================

import fs   from "fs";
import path from "path";
import axios from "axios";

const SKILLS_ROOT = path.join(process.cwd(), "skills");

// ── Interface ─────────────────────────────────────────────────

export interface GeneratedSkill {
  skillName:         string;
  version:           string;
  code:              string;
  generatedAt:       string;
  basedOn?:          string;
  improvementReason: string;
}

// ── SkillGenerator ────────────────────────────────────────────

export class SkillGenerator {
  private ollamaUrl: string;

  constructor(ollamaBaseUrl = "http://localhost:11434") {
    this.ollamaUrl = ollamaBaseUrl;
  }

  /**
   * Read the current on-disk code for a skill and ask Ollama to improve it.
   */
  async improve(
    skillName:    string,
    reason:       string,
    currentCode:  string
  ): Promise<GeneratedSkill> {
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
      generatedAt:       new Date().toISOString(),
      basedOn:           skillName,
      improvementReason: reason,
    };
  }

  /**
   * Generate a brand-new skill from scratch for the given capability.
   * Saves it to skills/generated/<capability>.ts.
   */
  async createNew(capability: string): Promise<GeneratedSkill> {
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
    const version   = `v${Date.now()}`;

    // Persist to skills/generated/<skillName>.ts
    const generatedDir = path.join(SKILLS_ROOT, "generated");
    if (!fs.existsSync(generatedDir)) {
      fs.mkdirSync(generatedDir, { recursive: true });
    }
    const filePath = path.join(generatedDir, `${skillName}.ts`);
    fs.writeFileSync(filePath, code, "utf-8");
    console.log(`[SkillGenerator] Created new skill: ${filePath}`);

    return {
      skillName,
      version,
      code,
      generatedAt:       new Date().toISOString(),
      improvementReason: `New skill generated for capability: ${capability}`,
    };
  }

  // ── Private ──────────────────────────────────────────────────

  private async _callOllama(prompt: string): Promise<string> {
    try {
      const response = await axios.post(
        `${this.ollamaUrl}/api/generate`,
        {
          model:  "qwen2.5-coder:14b",
          prompt,
          stream: false,
          options: { temperature: 0.2 },
        },
        { timeout: 180_000 }
      );
      return (response.data?.response ?? "").trim();
    } catch (err: any) {
      throw new Error(`[SkillGenerator] Ollama call failed: ${err.message}`);
    }
  }

  private _toCamelCase(str: string): string {
    return str
      .replace(/[^a-zA-Z0-9 ]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map((w, i) => i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())
      .join("");
  }
}

// ── Singleton ─────────────────────────────────────────────────

export const skillGenerator = new SkillGenerator();
