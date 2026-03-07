// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import { execa } from "execa";
import fs from "fs";
import path from "path";

export async function runExpressSkill(projectRoot: string) {
  console.log("🧩 Running Express scaffold skill...");

  await execa("npm init -y", { shell: true, cwd: projectRoot });
  await execa("npm install express", { shell: true, cwd: projectRoot });

  const filePath = path.join(projectRoot, "server.js");

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

  fs.writeFileSync(filePath, content);

  console.log("✅ Express project scaffolded.");
}