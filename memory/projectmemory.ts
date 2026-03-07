// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import fs from "fs";
import path from "path";
import { getActiveProject } from "../core/registry";

export interface ProjectMemory {
  techStack: string[];
  recentTasks: string[];
  knownIssues: string[];
  decisions: string[];
  deploymentTargets: string[];
}

function getMemoryPath(): string {
  const active = getActiveProject();
  if (!active) throw new Error("No active project.");

  return path.join(__dirname, "..", "projects", active, "memory.json");
}

export function loadMemory(): ProjectMemory {
  const memoryPath = getMemoryPath();

  if (!fs.existsSync(memoryPath)) {
    const initial: ProjectMemory = {
      techStack: [],
      recentTasks: [],
      knownIssues: [],
      decisions: [],
      deploymentTargets: []
    };

    fs.mkdirSync(path.dirname(memoryPath), { recursive: true });
    fs.writeFileSync(memoryPath, JSON.stringify(initial, null, 2));
    return initial;
  }

  return JSON.parse(fs.readFileSync(memoryPath, "utf-8"));
}

export function saveMemory(memory: ProjectMemory) {
  const memoryPath = getMemoryPath();
  fs.writeFileSync(memoryPath, JSON.stringify(memory, null, 2));
}