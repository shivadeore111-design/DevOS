// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// core/skillGenerator.ts

import fs from "fs";
import path from "path";

const SKILL_DIR = path.join(
  process.cwd(),
  "workspace",
  "generated_skills"
);

export function generateSkillFile(
  skillName: string,
  logicBody: string
) {
  if (!skillName.match(/^[a-zA-Z0-9_]+$/)) {
    throw new Error("Invalid skill name.");
  }

  const filePath = path.join(SKILL_DIR, `${skillName}.js`);

  const template = `
/**
 * AUTO-GENERATED SKILL
 * DO NOT EDIT CORE FILES
 */

exports.execute = async function(context) {
  console.log("⚙ Running generated skill: ${skillName}");

  ${logicBody}
};
`;

  fs.writeFileSync(filePath, template);

  console.log(`✅ Skill created: ${skillName}`);
}