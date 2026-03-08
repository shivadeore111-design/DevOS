// ============================================================
// DevOS - Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
import fs   from "fs";
import path from "path";
import * as net                from "net";
import { execa }              from "execa";
import { getRuntimeShell }    from "../os-adapter";
import { processSupervisor }  from "../../devos/runtime/processSupervisor";

// ── Port conflict detection ───────────────────────────────

function isPortInUse(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const s = net.createConnection(port, "127.0.0.1");
    s.once("connect", () => { s.destroy(); resolve(true); });
    s.once("error",   () => { s.destroy(); resolve(false); });
  });
}

function extractPort(command: string): number {
  // Match patterns: PORT=3000, -p 3000, :3000, standalone 4-digit port numbers
  const patterns = [
    /PORT[=\s]+(\d{4,5})/i,
    /-p\s+(\d{4,5})/i,
    /:(\d{4,5})\b/,
    /\b(3000|3001|4000|4200|5000|8000|8080|8888)\b/,
  ];
  for (const re of patterns) {
    const m = command.match(re);
    if (m) return parseInt(m[1], 10);
  }
  return 3000; // default
}

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

export async function executeShellAction(
  action: any,
  workspace: string,
  goalId?: string,
): Promise<ShellActionResult> {
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
  const isServerCmd    = serverPatterns.some(p => command.toLowerCase().includes(p));

  if (isServerCmd) {
    // ── Port conflict check ─────────────────────────────
    const port    = extractPort(command);
    const inUse   = await isPortInUse(port);
    if (inUse) {
      console.log(`[ShellActions] Port ${port} already in use — server may already be running`);
      return { success: true, output: { stdout: `Port ${port} already in use — skipping spawn`, stderr: "", exitCode: 0 } };
    }

    const proc = require("child_process").spawn(shell, [flag, command], {
      cwd, detached: true, stdio: "ignore",
    });
    proc.unref();

    // Register with process supervisor so it can be killed later
    if (proc.pid !== undefined && goalId) {
      processSupervisor.register(proc.pid, command, goalId);
    }

    await new Promise(r => setTimeout(r, 3000));

    const alive = (() => {
      try { process.kill(proc.pid!, 0); return true; }
      catch { return false; }
    })();

    if (!alive) {
      // Port may have come up even if PID check failed (process detached)
      const portUp = await isPortInUse(port);
      if (portUp) {
        return { success: true, output: { stdout: `Server listening on port ${port}`, stderr: "", exitCode: 0 } };
      }
      return { success: false, error: "Server process exited immediately" };
    }

    return { success: true, output: { stdout: "Server started in background", stderr: "", exitCode: 0 } };
  }

  try {
    const result = await execa(shell, [flag, command], {
      cwd,
      timeout: 30000,
      reject:  false,
    });
    const exitCode = result.exitCode ?? (result.stdout && !result.stderr ? 0 : 1);
    const success  = exitCode === 0;
    console.log(`[ShellActions] Exit ${exitCode}: ${command}`);
    return {
      success,
      output: { stdout: result.stdout, stderr: result.stderr, exitCode },
      error:  success ? undefined : `Exit ${exitCode}: ${result.stderr}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
