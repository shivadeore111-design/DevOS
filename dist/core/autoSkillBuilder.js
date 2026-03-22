"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMissingSkill = buildMissingSkill;
// core/autoSkillBuilder.ts
const local_1 = require("../llm/local");
const skillGenerator_1 = require("./skillGenerator");
async function buildMissingSkill(skillName, goal) {
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
    const response = await (0, local_1.queryLocalLLM)(prompt);
    const cleaned = response
        .replace(/```javascript/gi, "")
        .replace(/```/g, "")
        .trim();
    if (!cleaned || cleaned.length < 10) {
        console.log("⚠ Skill generation failed.");
        return false;
    }
    (0, skillGenerator_1.generateSkillFile)(skillName, cleaned);
    console.log(`✅ Skill ${skillName} generated successfully.`);
    return true;
}
