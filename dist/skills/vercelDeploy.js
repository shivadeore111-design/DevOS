"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.runVercelDeploySkill = runVercelDeploySkill;
const execa_1 = require("execa");
const analyzeBuildError_1 = require("./analyzeBuildError");
async function runVercelDeploySkill(projectRoot) {
    console.log("🧩 Running Vercel deploy skill...");
    const token = process.env.VERCEL_TOKEN;
    if (!token) {
        throw new Error("VERCEL_TOKEN environment variable not set.");
    }
    try {
        const { stdout } = await (0, execa_1.execa)(`vercel --prod --yes --token ${token}`, {
            shell: true,
            cwd: projectRoot
        });
        console.log("🚀 Deployment complete.");
        console.log(stdout);
    }
    catch (err) {
        const errorOutput = err?.stderr || err?.stdout || err?.message;
        console.log("⚠️ Deployment failed. Analyzing error...");
        const analysis = (0, analyzeBuildError_1.analyzeBuildError)(errorOutput);
        console.log("🧠 Analysis:", analysis.message);
        if (analysis.type === "install_missing_package") {
            console.log("🔁 Attempting auto-fix: npm install");
            await (0, execa_1.execa)("npm install", {
                shell: true,
                cwd: projectRoot
            });
            console.log("🔁 Retrying deployment...");
            await (0, execa_1.execa)(`vercel --prod --yes --token ${token}`, {
                shell: true,
                cwd: projectRoot
            });
            console.log("🚀 Deployment successful after auto-fix.");
            return;
        }
        console.log("🚨 Could not auto-fix. Escalation required.");
        console.log(errorOutput);
    }
}
