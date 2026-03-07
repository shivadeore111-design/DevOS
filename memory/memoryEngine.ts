// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import fs from "fs";
import path from "path";

const memoryPath = path.join(__dirname, "researchMemory.json");

export function loadMemory() {
  if (!fs.existsSync(memoryPath)) {
    return {
      topicsResearched: [],
      insights: [],
      improvements: [],
      failures: []
    };
  }

  const raw = fs.readFileSync(memoryPath, "utf-8");
  return JSON.parse(raw);
}

export function saveMemory(data: any) {
  fs.writeFileSync(memoryPath, JSON.stringify(data, null, 2));
}

export function appendMemory(section: string, entry: any) {
  const memory = loadMemory();

  if (!memory[section]) {
    memory[section] = [];
  }

  memory[section].push({
    timestamp: new Date().toISOString(),
    data: entry
  });

  saveMemory(memory);
}