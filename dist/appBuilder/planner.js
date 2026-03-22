"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.planProject = planProject;
async function planProject(idea) {
    const prompt = `
You are a senior software architect.

Convert this idea into structured JSON.

Idea:
${idea}

STRICT RULES:
- Return ONLY JSON
- No explanation
- No markdown
- No extra text

Format:

{
  "projectName": "lowercase-no-spaces",
  "description": "",
  "techStack": ["Node.js", "Express"],
  "features": [],
  "pages": [],
  "apiRoutes": []
}
`;
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
    const raw = data.response.trim();
    const json = extractFirstJsonObject(raw);
    return JSON.parse(json);
}
function extractFirstJsonObject(text) {
    const firstBrace = text.indexOf("{");
    if (firstBrace === -1)
        throw new Error("No JSON found");
    let braceCount = 0;
    let endIndex = -1;
    for (let i = firstBrace; i < text.length; i++) {
        if (text[i] === "{")
            braceCount++;
        if (text[i] === "}")
            braceCount--;
        if (braceCount === 0) {
            endIndex = i;
            break;
        }
    }
    if (endIndex === -1)
        throw new Error("Incomplete JSON");
    return text.substring(firstBrace, endIndex + 1);
}
