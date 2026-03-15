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
exports.writeFiles = writeFiles;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
async function writeFiles(structure, plan) {
    for (const file of structure.files) {
        const fullPath = path_1.default.join(structure.rootDir, file);
        const prompt = `
Generate ONLY the raw file content.

Project Plan:
${JSON.stringify(plan, null, 2)}

File to generate:
${file}

Rules:
- No explanations
- No markdown
- Only code
`;
        const content = await generateWithOllama(prompt);
        fs_1.default.writeFileSync(fullPath, content);
        console.log(`✔ Created ${file}`);
    }
}
async function generateWithOllama(prompt) {
    const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "llama3:latest",
            prompt,
            stream: false
        })
    });
    const data = await response.json();
    return data.response;
}
