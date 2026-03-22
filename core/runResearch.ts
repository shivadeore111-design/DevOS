// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import { ResearchAgent } from "./researchAgent";
import { generateNextTopic } from "./topicGenerator";
import { shouldStop, calculateAdaptiveDelay } from "./controlEngine";

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function start() {
  const agent = new ResearchAgent();

  console.log("DevOS Research Mode Activated...\n");

  let cycle = 0;

  while (true) {
    const control = shouldStop(cycle);

    if (control.stop) {
      console.log("\nResearch halted:", control.reason);
      break;
    }

    const topic = await generateNextTopic();
    console.log("Generated Topic:", topic);

    await agent.run(topic);

    cycle++;

    const delay = calculateAdaptiveDelay();
    console.log(`Waiting ${delay / 1000} seconds before next cycle...\n`);

    await sleep(delay);
  }

  console.log("DevOS session ended safely.");
}

start();