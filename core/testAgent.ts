// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import { AgentLoop } from "./agentLoop";
import { sessionManager } from "./sessionManager";

async function run() {
  const agent = new AgentLoop();
  const sess  = sessionManager.create("search AI agents 2026", process.cwd());

  await agent.run("search AI agents 2026", sess.id);

  console.log("\nAgent loop finished. Check session:", sess.id);
}

run();