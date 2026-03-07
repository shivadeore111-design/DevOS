// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// core/capabilityRegistry.ts

import { loadGeneratedSkills } from "./skillRegistry";

export interface Capability {
  name: string;
  source: "built-in" | "generated";
}

const builtInCapabilities: string[] = [
  "git_push",
  "vercel_deploy",
  "check_deployment_health",
  "express_setup",
  "analyze_build_error",
  "run_command",
  "file_create",
  "file_edit"
];

export async function getAvailableCapabilities(): Promise<Capability[]> {
  const generatedSkills = await loadGeneratedSkills();

  const generatedCapabilities = generatedSkills.map((skill) => ({
    name: skill.name,
    source: "generated" as const
  }));

  const builtIn = builtInCapabilities.map((name) => ({
    name,
    source: "built-in" as const
  }));

  return [...builtIn, ...generatedCapabilities];
}

export async function getCapabilityNames(): Promise<string[]> {
  const capabilities = await getAvailableCapabilities();
  return capabilities.map((c) => c.name);
}