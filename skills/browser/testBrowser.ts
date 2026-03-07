// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import { WebActions } from "./webActions";

async function run() {
  const web = new WebActions();

  const results = await web.search("OpenAI");

  console.log("\nTop Results:\n");

  if (results.length === 0) {
    console.log("No results found.");
  } else {
    results.forEach((r) => console.log("-", r));
  }
}

run();