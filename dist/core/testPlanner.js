"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
const skillExecutor_1 = require("./skillExecutor");
async function run() {
    const executor = new skillExecutor_1.SkillExecutor();
    const result = await executor.execute("web.search", {
        query: "AI agents 2026"
    });
    console.log("\nPlanner Result:\n", result);
}
run();
