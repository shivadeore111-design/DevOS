"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
const documentIngestor_1 = require("./documentIngestor");
async function run() {
    const filePath = process.argv[2];
    if (!filePath) {
        console.log("Provide file path.");
        return;
    }
    await (0, documentIngestor_1.ingestDocument)(filePath);
}
run();
