// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import { runExpressSkill } from "../skills/express";
import { runGitPushSkill } from "../skills/gitPush";
import { runVercelDeploySkill } from "../skills/vercelDeploy";
import { runHealthCheckSkill } from "../skills/checkDeploymentHealth";

export async function executeSkills(goal: string, projectRoot: string): Promise<boolean> {
  const lowerGoal = goal.toLowerCase().trim();
  let executed = false;

  if (lowerGoal.includes("express")) {
    console.log("🧩 Skill detected: Express");
    await runExpressSkill(projectRoot);
    executed = true;
  }

  if (lowerGoal.includes("github")) {
    console.log("🧩 Skill detected: Git Push");
    await runGitPushSkill(projectRoot);
    executed = true;
  }

  if (lowerGoal.includes("vercel")) {
    console.log("🧩 Skill detected: Vercel Deploy");
    await runVercelDeploySkill(projectRoot);
    executed = true;
  }

  if (lowerGoal.includes("health")) {
    console.log("🧩 Skill detected: Health Check");
    await runHealthCheckSkill(projectRoot);
    executed = true;
  }

  return executed;
}