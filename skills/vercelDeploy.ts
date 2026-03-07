// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import { execa } from "execa";
import { analyzeBuildError } from "./analyzeBuildError";

export async function runVercelDeploySkill(projectRoot: string) {
  console.log("🧩 Running Vercel deploy skill...");

  const token = process.env.VERCEL_TOKEN;

  if (!token) {
    throw new Error("VERCEL_TOKEN environment variable not set.");
  }

  try {
    const { stdout } = await execa(
      `vercel --prod --yes --token ${token}`,
      {
        shell: true,
        cwd: projectRoot
      }
    );

    console.log("🚀 Deployment complete.");
    console.log(stdout);

  } catch (err: any) {
    const errorOutput = err?.stderr || err?.stdout || err?.message;

    console.log("⚠️ Deployment failed. Analyzing error...");

    const analysis = analyzeBuildError(errorOutput);

    console.log("🧠 Analysis:", analysis.message);

    if (analysis.type === "install_missing_package") {
      console.log("🔁 Attempting auto-fix: npm install");
      await execa("npm install", {
        shell: true,
        cwd: projectRoot
      });

      console.log("🔁 Retrying deployment...");
      await execa(
        `vercel --prod --yes --token ${token}`,
        {
          shell: true,
          cwd: projectRoot
        }
      );

      console.log("🚀 Deployment successful after auto-fix.");
      return;
    }

    console.log("🚨 Could not auto-fix. Escalation required.");
    console.log(errorOutput);
  }
}