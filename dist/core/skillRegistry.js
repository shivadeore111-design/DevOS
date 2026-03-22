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
exports.ensureSkillDirectory = ensureSkillDirectory;
exports.listGeneratedSkills = listGeneratedSkills;
exports.loadGeneratedSkills = loadGeneratedSkills;
// core/skillRegistry.ts
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const SKILL_DIR = path_1.default.join(process.cwd(), "workspace", "generated_skills");
function ensureSkillDirectory() {
    if (!fs_1.default.existsSync(SKILL_DIR)) {
        fs_1.default.mkdirSync(SKILL_DIR, { recursive: true });
    }
}
function listGeneratedSkills() {
    ensureSkillDirectory();
    return fs_1.default
        .readdirSync(SKILL_DIR)
        .filter((file) => file.endsWith(".js"));
}
async function loadGeneratedSkills() {
    ensureSkillDirectory();
    const files = listGeneratedSkills();
    const skills = [];
    for (const file of files) {
        const fullPath = path_1.default.join(SKILL_DIR, file);
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
