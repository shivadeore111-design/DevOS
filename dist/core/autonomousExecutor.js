"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAutonomousGoal = runAutonomousGoal;
// core/autonomousExecutor.ts
const planner_1 = require("./planner");
const autoSkillBuilder_1 = require("./autoSkillBuilder");
const skillRegistry_1 = require("./skillRegistry");
const executionController_1 = require("./executionController");
async function runAutonomousGoal(goal) {
    console.log("🧠 Starting autonomous goal execution...");
    const plan = await (0, planner_1.planGoal)(goal);
    if (!plan.actions.length && !plan.requiredCapabilities.length) {
        console.log("⚠ Planner returned empty plan.");
        return;
    }
    if (plan.missingCapabilities.length > 0) {
        console.log("🚧 Missing capabilities detected:");
        console.log(plan.missingCapabilities);
        for (const missing of plan.missingCapabilities) {
            const success = await (0, autoSkillBuilder_1.buildMissingSkill)(missing, goal);
            if (!success) {
                console.log("🛑 Skill generation failed. Escalating.");
                return;
            }
        }
        console.log("🔁 Re-planning after skill generation...");
        return runAutonomousGoal(goal);
    }
    console.log("✅ All required capabilities available.");
    console.log("📋 Executing planned actions...");
    const generatedSkills = await (0, skillRegistry_1.loadGeneratedSkills)();
    const stageMap = {};
    for (const action of plan.actions) {
        if (action.type === "deploy") {
            stageMap["deploy"] = async () => {
                console.log("🚀 Deploy action triggered.");
            };
        }
        if (action.type === "command" && action.command) {
            stageMap[action.description] = async () => {
                const { execSync } = require("child_process");
                execSync(action.command, { stdio: "inherit" });
            };
        }
        if (action.type === "file_create" && action.path && action.content) {
            stageMap[action.description] = async () => {
                const fs = require("fs");
                fs.writeFileSync(action.path, action.content);
                console.log(`📄 File created: ${action.path}`);
            };
        }
    }
    await (0, executionController_1.executeWithIntelligence)(stageMap, goal);
}
