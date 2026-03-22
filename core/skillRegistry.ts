// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// core/skillRegistry.ts

import fs from "fs";
import path from "path";

const SKILL_DIR = path.join(
  process.cwd(),
  "workspace",
  "generated_skills"
);

export interface SkillContext {
  goal: string;
  memory: any;
}

export type SkillFunction = (context: SkillContext) => Promise<void>;

export interface RegisteredSkill {
  name: string;
  execute: SkillFunction;
}

export function ensureSkillDirectory() {
  if (!fs.existsSync(SKILL_DIR)) {
    fs.mkdirSync(SKILL_DIR, { recursive: true });
  }
}

export function listGeneratedSkills(): string[] {
  ensureSkillDirectory();
  return fs
    .readdirSync(SKILL_DIR)
    .filter((file) => file.endsWith(".js"));
}

export async function loadGeneratedSkills(): Promise<
  RegisteredSkill[]
> {
  ensureSkillDirectory();

  const files = listGeneratedSkills();
  const skills: RegisteredSkill[] = [];

  for (const file of files) {
    const fullPath = path.join(SKILL_DIR, file);

    delete require.cache[require.resolve(fullPath)];
    const module = require(fullPath);

    if (module && module.execute) {
      skills.push({
        name: file.replace(".js", ""),
        execute: module.execute
      });
    }
  }

  return skills;
}