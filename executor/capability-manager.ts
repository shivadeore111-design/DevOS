// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import fs from "fs";
import path from "path";
import axios from "axios";

export class CapabilityManager {
  private skillsDir: string;

  constructor(skillsDir: string) {
    this.skillsDir = path.resolve(process.cwd(), skillsDir);
  }

  // ─────────────────────────────────────────────
  // Safety Guard
  // ─────────────────────────────────────────────
  private isSafeCode(code: string): boolean {
    const forbidden = [
      "child_process",
      "exec(",
      "spawn(",
      "process.kill",
      "require('http')",
      "require('https')",
      "../",
      "rm -rf",
      "while(true)",
      "for(;;)"
    ];

    return !forbidden.some(f => code.includes(f));
  }

  // ─────────────────────────────────────────────
  // JS Syntax Validation
  // ─────────────────────────────────────────────
  private isValidJS(code: string): boolean {
    try {
      new Function(code);
      return true;
    } catch {
      return false;
    }
  }

  // ─────────────────────────────────────────────
  // Autonomous JS Skill Builder (Template-Based)
  // ─────────────────────────────────────────────
  async buildCapability(action: any): Promise<boolean> {
    try {
      console.log("🧠 Generating autonomous JS skill for:", action.type);

      const skillFileName = `${action.type}.js`;
      const fullPath = path.join(this.skillsDir, skillFileName);

      if (fs.existsSync(fullPath)) {
        console.log("⚠ Skill already exists.");
        return false;
      }

      // Ask LLM ONLY for inner logic
      const prompt = `
Write ONLY the inner logic for this action.

Action:
${JSON.stringify(action)}

Rules:
- Use: await fs.access(filePath) to check existence
- If not exists: await fs.writeFile(filePath, '')
- Then: await fs.appendFile(filePath, action.content, 'utf8')
- Return:
    return { success: true, artifacts: [filePath] };
- On failure:
    return { success: false, error: error.message };
- Do NOT include imports
- Do NOT include exports
- Do NOT include explanation
- Only write JavaScript statements
`;

      const response = await axios.post(
        "http://localhost:11434/api/generate",
        {
          model: "llama3",
          prompt,
          stream: false,
          options: { temperature: 0 }
        }
      );

      const innerLogic = response.data.response.trim();

      // Inject into guaranteed-valid template
      const template = `
const fs = require('fs').promises;
const path = require('path');

exports.execute = async function(action, workspace) {
  try {
    const filePath = path.join(workspace, action.path);

    ${innerLogic}

  } catch (error) {
    return { success: false, error: error.message };
  }
};
`;

      if (!this.isSafeCode(template)) {
        console.log("🚫 Generated code failed safety check.");
        return false;
      }

      if (!this.isValidJS(template)) {
        console.log("❌ Generated JS is syntactically invalid.");
        return false;
      }

      fs.writeFileSync(fullPath, template);

      console.log("✅ Autonomous JS skill generated:", skillFileName);

      return true;

    } catch (err: any) {
      console.log("🔥 JS generation failed:", err.message);
      return false;
    }
  }
}