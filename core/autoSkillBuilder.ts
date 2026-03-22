// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// core/autoSkillBuilder.ts

import { queryLocalLLM } from "../llm/local";
import { generateSkillFile } from "./skillGenerator";

export async function buildMissingSkill(
  skillName: string,
  goal: string
): Promise<boolean> {
  console.log(`🧠 Generating missing skill: ${skillName}`);

  const prompt = `
You are DevOS Skill Generator.

Generate ONLY JavaScript logic body (no exports, no wrapper).
The function will be inserted inside:

exports.execute = async function(context) {
  // your logic here
};

Rules:
- Must work in Node.js
- Windows PowerShell environment
- Use only safe commands
- Use relative paths
- No explanations
- No markdown
- Return raw JavaScript only

Goal context:
${goal}

Skill name:
${skillName}
`;

  const response = await queryLocalLLM(prompt);

  const cleaned = response
    .replace(/```javascript/gi, "")
    .replace(/```/g, "")
    .trim();

  if (!cleaned || cleaned.length < 10) {
    console.log("⚠ Skill generation failed.");
    return false;
  }

  generateSkillFile(skillName, cleaned);

  console.log(`✅ Skill ${skillName} generated successfully.`);
  return true;
}