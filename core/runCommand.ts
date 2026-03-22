// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// core/runCommand.ts

import { exec } from "child_process";

export interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  errorMessage?: string;
}

export function runCommand(cmd: string): Promise<CommandResult> {
  return new Promise((resolve) => {
    exec(cmd, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          success: false,
          stdout,
          stderr,
          errorMessage: error.message
        });
      } else {
        resolve({
          success: true,
          stdout,
          stderr
        });
      }
    });
  });
}