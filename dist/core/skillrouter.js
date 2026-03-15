"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeSkills = executeSkills;
const express_1 = require("../skills/express");
const gitPush_1 = require("../skills/gitPush");
const vercelDeploy_1 = require("../skills/vercelDeploy");
const checkDeploymentHealth_1 = require("../skills/checkDeploymentHealth");
async function executeSkills(goal, projectRoot) {
    const lowerGoal = goal.toLowerCase().trim();
    let executed = false;
    if (lowerGoal.includes("express")) {
        console.log("🧩 Skill detected: Express");
        await (0, express_1.runExpressSkill)(projectRoot);
        executed = true;
    }
    if (lowerGoal.includes("github")) {
        console.log("🧩 Skill detected: Git Push");
        await (0, gitPush_1.runGitPushSkill)(projectRoot);
        executed = true;
    }
    if (lowerGoal.includes("vercel")) {
        console.log("🧩 Skill detected: Vercel Deploy");
        await (0, vercelDeploy_1.runVercelDeploySkill)(projectRoot);
        executed = true;
    }
    if (lowerGoal.includes("health")) {
        console.log("🧩 Skill detected: Health Check");
        await (0, checkDeploymentHealth_1.runHealthCheckSkill)(projectRoot);
        executed = true;
    }
    return executed;
}
