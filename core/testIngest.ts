// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import { ingestDocument } from "./documentIngestor";

async function run() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.log("Provide file path.");
    return;
  }

  await ingestDocument(filePath);
}

run();