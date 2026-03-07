// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// ============================================================
// shellActions.ts — DevOS Shell Action Executor
// ============================================================

import { execa } from "execa";

const BLOCKED_PATTERNS = [
  "rm -rf /",
  "del /f /s /q c:\\",
  "format c:",
  "shutdown",
  ":(){ :|:& };:",  // fork bomb
];

export interface ShellActionResult {
  success: boolean;
  output?: any;
  error?: string;
}

export async function executeShellAction(action: any, workspace: string): Promise<ShellActionResult> {
  const command = action.command as string;

  if (!command) return { success: false, error: "No command provided" };

  // Safety check
  for (const blocked of BLOCKED_PATTERNS) {
    if (command.toLowerCase().includes(blocked.toLowerCase())) {
      return { success: false, error: `Blocked command pattern: "${blocked}"` };
    }
  }

  if (action.risk === "high") {
    return { success: false, error: "High-risk shell commands require OpenClaw escalation" };
  }

  console.log(`[ShellActions] Executing: ${command}`);

  try {
    const result = await execa("bash", ["-c", command], {
      cwd: workspace,
      timeout: 30000,
      reject: false,
    });

    const success = result.exitCode === 0;
    console.log(`[ShellActions] Exit ${result.exitCode}: ${command}`);

    return {
      success,
      output: {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      },
      error: success ? undefined : `Exit ${result.exitCode}: ${result.stderr}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
