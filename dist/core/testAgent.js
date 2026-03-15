"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
const agentLoop_1 = require("./agentLoop");
const sessionManager_1 = require("./sessionManager");
async function run() {
    const agent = new agentLoop_1.AgentLoop();
    const sess = sessionManager_1.sessionManager.create("search AI agents 2026", process.cwd());
    await agent.run("search AI agents 2026", sess.id);
    console.log("\nAgent loop finished. Check session:", sess.id);
}
run();
