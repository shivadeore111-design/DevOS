// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// ============================================================
// skills/registry.ts — Central Skill Interface & Registry
// All skills must implement the Skill interface and register here.
// ============================================================

import { EnvironmentBuilder } from "./system/environmentBuilder";
import { TerminalOperator } from "./system/terminalOperator";

// ── Skill Interface ───────────────────────────────────────────

export interface Skill {
  name:        string;
  description: string;
  category?:   string;
  execute(args: any): Promise<any>;
}

// ── Registry ─────────────────────────────────────────────────

export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();

  constructor(loadDefaults = false) {
    if (loadDefaults) this.registerDefaultSkills();
  }

  register(skill: Skill): void {
    this.skills.set(skill.name, skill);
    console.log(`[SkillRegistry] Registered: ${skill.name}`);
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  getAll(): Skill[] {
    return Array.from(this.skills.values());
  }

  list(): string[] {
    return Array.from(this.skills.keys());
  }

  has(name: string): boolean {
    return this.skills.has(name);
  }

  findByCategory(category: string): Skill[] {
    return this.getAll().filter(s => s.category === category);
  }

  private registerDefaultSkills(): void {
    const terminalOperator = new TerminalOperator();
    const environmentBuilder = new EnvironmentBuilder(terminalOperator);

    this.register({
      name: "terminalOperator",
      description: "Safely executes shell commands with timeout support",
      category: "system",
      execute: async (input: { command: string; timeout?: number; cwd?: string } | string) => {
        if (typeof input === "string") {
          return terminalOperator.execute(input);
        }
        return terminalOperator.execute(input.command, {
          timeout: input.timeout,
          cwd: input.cwd
        });
      }
    });

    this.register({
      name: "environmentBuilder",
      description: "Detects and prepares development environments",
      category: "system",
      execute: async (input: { dir: string; mode?: "detect" | "prepare" }) => {
        if (input.mode === "detect") {
          return environmentBuilder.detect(input.dir);
        }
        return environmentBuilder.prepare(input.dir);
      }
    });
  }
}

// ── Singletons ────────────────────────────────────────────────

/** Main singleton used by all v3 skills */
export const skillRegistry = new SkillRegistry();

/** Alias for code using the older `registry` export name */
export const registry = skillRegistry;
