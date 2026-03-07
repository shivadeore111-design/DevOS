// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import fs from "fs";
import path from "path";

export async function writeFiles(structure: any, plan: any) {
  for (const file of structure.files) {
    const fullPath = path.join(structure.rootDir, file);

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

    fs.writeFileSync(fullPath, content);
    console.log(`✔ Created ${file}`);
  }
}

async function generateWithOllama(prompt: string): Promise<string> {
  const response = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama3:latest",
      prompt,
      stream: false
    })
  });

  const data: any = await response.json();
  return data.response;
}