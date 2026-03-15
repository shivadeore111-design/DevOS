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
exports.runExpressSkill = runExpressSkill;
const execa_1 = require("execa");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
async function runExpressSkill(projectRoot) {
    console.log("🧩 Running Express scaffold skill...");
    await (0, execa_1.execa)("npm init -y", { shell: true, cwd: projectRoot });
    await (0, execa_1.execa)("npm install express", { shell: true, cwd: projectRoot });
    const filePath = path_1.default.join(projectRoot, "server.js");
    const content = `
const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(\`Server running at http://localhost:\${port}\`);
});
`;
    fs_1.default.writeFileSync(filePath, content);
    console.log("✅ Express project scaffolded.");
}
