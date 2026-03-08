// ============================================================
// DevOS - Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
import fs from "fs";
import path from "path";
import { execa } from "execa";
import { getRuntimeShell } from "../os-adapter";

const BLOCKED_PATTERNS = [
  "rm -rf /",
  "del /f /s /q c:\\",
  "format c:",
  "shutdown",
  ":(){ :|:& };:",
];

export interface ShellActionResult {
  success: boolean;
  output?: any;
  error?: string;
}

export async function executeShellAction(action: any, workspace: string): Promise<ShellActionResult> {
  const command = action.command as string;
  if (!command) return { success: false, error: "No command provided" };

  for (const blocked of BLOCKED_PATTERNS) {
    if (command.toLowerCase().includes(blocked.toLowerCase())) {
      return { success: false, error: `Blocked command pattern: "${blocked}"` };
    }
  }

  if (action.risk === "high") {
    return { success: false, error: "High-risk shell commands require OpenClaw escalation" };
  }

  const { shell, flag } = getRuntimeShell();
  const sandboxCwd = path.join(workspace, "sandbox");
  const cwd = path.basename(workspace) === "sandbox"
    ? workspace
    : (fs.existsSync(sandboxCwd) ? sandboxCwd : workspace);

  console.log(`[ShellActions] Executing: ${command}`);

  const serverPatterns = ["node server", "npm start", "python app", "flask run"];
  const isServerCmd = serverPatterns.some(p => command.toLowerCase().includes(p));
  if (isServerCmd) {
    const proc = require("child_process").spawn(shell, [flag, command], {
      cwd, detached: true, stdio: "ignore"
    });
    proc.unref();
    await new Promise(r => setTimeout(r, 3000));
    const alive = (() => { try { process.kill(proc.pid!, 0); return true; } catch { return false; } })();
    return alive
      ? { success: true, output: { stdout: "Server started in background", stderr: "", exitCode: 0 } }
      : { success: false, error: "Server process exited immediately" };
  }

  try {
    const result = await execa(shell, [flag, command], {
      cwd,
      timeout: 30000,
      reject: false,
    });
    const exitCode = result.exitCode ?? (result.stdout && !result.stderr ? 0 : 1);
    const success = exitCode === 0;
    console.log(`[ShellActions] Exit ${exitCode}: ${command}`);
    return {
      success,
      output: { stdout: result.stdout, stderr: result.stderr, exitCode },
      error: success ? undefined : `Exit ${exitCode}: ${result.stderr}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
