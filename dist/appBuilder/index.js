"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
const planner_1 = require("./planner");
const generator_1 = require("./generator");
const runner_1 = require("./runner");
async function main() {
    const idea = process.argv.slice(2).join(" ");
    if (!idea) {
        console.log("Please provide an app idea.");
        process.exit(1);
    }
    try {
        console.log("\n🧠 Planning project...");
        const plan = await (0, planner_1.planProject)(idea);
        console.log("\n📁 Generating structure...");
        const structure = await (0, generator_1.generateStructure)(plan);
        console.log("\n🚀 Installing dependencies and starting server...");
        await (0, runner_1.runProject)(structure.rootDir);
        console.log("\n✅ Kitchen Engine build complete.");
    }
    catch (err) {
        console.error("\n❌ Build failed:", err);
    }
}
main();
