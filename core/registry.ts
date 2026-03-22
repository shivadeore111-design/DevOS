// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import fs from "fs";
import path from "path";

const REGISTRY_PATH = path.join(__dirname, "..", "projects", "registry.json");

export interface ProjectRegistry {
  activeProject: string | null;
  projects: string[];
}

function ensureRegistry(): ProjectRegistry {
  if (!fs.existsSync(REGISTRY_PATH)) {
    const initial: ProjectRegistry = {
      activeProject: null,
      projects: []
    };

    fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }

  return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
}

export function getRegistry(): ProjectRegistry {
  return ensureRegistry();
}

export function setActiveProject(name: string) {
  const registry = ensureRegistry();

  if (!registry.projects.includes(name)) {
    registry.projects.push(name);
  }

  registry.activeProject = name;

  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
}

export function getActiveProject(): string | null {
  const registry = ensureRegistry();
  return registry.activeProject;
}