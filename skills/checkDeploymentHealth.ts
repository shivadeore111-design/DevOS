// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import https from "https";
import { loadMemory, saveMemory } from "../core/memory";

export async function runHealthCheckSkill(projectRoot: string) {
  console.log("🧩 Running Deployment Health Check...");

  const memory = loadMemory(projectRoot);

  if (!memory.lastDeploymentUrl) {
    console.log("⚠ No deployment URL found in memory.");
    return;
  }

  const url = memory.lastDeploymentUrl;

  await new Promise<void>((resolve) => {
    https
      .get(url, (res) => {
        const status = res.statusCode || 0;

        if (status >= 200 && status < 400) {
          console.log("✅ Deployment is healthy:", status);
          memory.lastError = "";
        } else {
          console.log("🚨 Deployment returned bad status:", status);
          memory.lastError = `Health check failed with status ${status}`;
        }

        saveMemory(projectRoot, memory);
        resolve();
      })
      .on("error", (err) => {
        console.log("🚨 Health check failed:", err.message);
        memory.lastError = err.message;
        saveMemory(projectRoot, memory);
        resolve();
      });
  });
}