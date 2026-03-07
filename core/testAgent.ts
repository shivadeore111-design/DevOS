// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import { AgentLoop } from "./agentLoop";

async function run() {
  const agent = new AgentLoop();

  const result = await agent.run("search AI agents 2026");

  console.log("\nFinal Result:\n", result);
}

run();