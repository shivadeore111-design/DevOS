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
exports.CapabilityManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const axios_1 = __importDefault(require("axios"));
class CapabilityManager {
    constructor(skillsDir) {
        this.skillsDir = path_1.default.resolve(process.cwd(), skillsDir);
    }
    // ─────────────────────────────────────────────
    // Safety Guard
    // ─────────────────────────────────────────────
    isSafeCode(code) {
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
    isValidJS(code) {
        try {
            new Function(code);
            return true;
        }
        catch {
            return false;
        }
    }
    // ─────────────────────────────────────────────
    // Autonomous JS Skill Builder (Template-Based)
    // ─────────────────────────────────────────────
    async buildCapability(action) {
        try {
            console.log("🧠 Generating autonomous JS skill for:", action.type);
            const skillFileName = `${action.type}.js`;
            const fullPath = path_1.default.join(this.skillsDir, skillFileName);
            if (fs_1.default.existsSync(fullPath)) {
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
            const response = await axios_1.default.post("http://localhost:11434/api/generate", {
                model: "llama3",
                prompt,
                stream: false,
                options: { temperature: 0 }
            });
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
            fs_1.default.writeFileSync(fullPath, template);
            console.log("✅ Autonomous JS skill generated:", skillFileName);
            return true;
        }
        catch (err) {
            console.log("🔥 JS generation failed:", err.message);
            return false;
        }
    }
}
exports.CapabilityManager = CapabilityManager;
