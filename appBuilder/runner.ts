// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import { exec } from "child_process";

export async function runProject(rootDir: string) {
  return new Promise((resolve) => {
    exec(`cd ${rootDir} && npm install`, (err) => {
      if (err) {
        console.log("Install failed.");
        resolve(false);
        return;
      }

      console.log("Dependencies installed.");

      exec(`cd ${rootDir} && npm run dev`, () => {
        resolve(true);
      });
    });
  });
}