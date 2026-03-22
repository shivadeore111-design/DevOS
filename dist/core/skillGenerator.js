"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSkillFile = generateSkillFile;
// core/skillGenerator.ts
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const SKILL_DIR = path_1.default.join(process.cwd(), "workspace", "generated_skills");
function generateSkillFile(skillName, logicBody) {
    if (!skillName.match(/^[a-zA-Z0-9_]+$/)) {
        throw new Error("Invalid skill name.");
    }
    const filePath = path_1.default.join(SKILL_DIR, `${skillName}.js`);
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
    fs_1.default.writeFileSync(filePath, template);
    console.log(`✅ Skill created: ${skillName}`);
}
