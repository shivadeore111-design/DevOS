// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// ============================================================
// skills/utils/terminalOperator.ts — Safe terminal command runner
// Wraps Node child_process for use inside DevOS skills.
// No external dependencies — uses Node built-ins only.
// ============================================================

import { exec, execSync } from "child_process";
import { promisify }      from "util";

const execAsync = promisify(exec);

export interface CommandResult {
  stdout:     string;
  stderr:     string;
  exitCode:   number;
  command:    string;
  durationMs: number;
}

export class TerminalOperator {
  private defaultCwd: string;
  private timeoutMs:  number;

  constructor(cwd: string = process.cwd(), timeoutMs: number = 60_000) {
    this.defaultCwd = cwd;
    this.timeoutMs  = timeoutMs;
  }

  /**
   * Run a shell command asynchronously.
   * Returns stdout, stderr, and exit code.
   * Never throws — captures errors in the result object.
   */
  async run(command: string, cwd?: string): Promise<CommandResult> {
    const dir   = cwd ?? this.defaultCwd;
    const start = Date.now();

    console.log(`[TerminalOperator] $ ${command}  (cwd: ${dir})`);

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd:     dir,
        timeout: this.timeoutMs,
        env:     { ...process.env },
      });
      return {
        stdout:     stdout.trim(),
        stderr:     stderr.trim(),
        exitCode:   0,
        command,
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        stdout:     err.stdout?.trim() ?? "",
        stderr:     err.stderr?.trim() ?? err.message,
        exitCode:   err.code ?? 1,
        command,
        durationMs: Date.now() - start,
      };
    }
  }

  /**
   * Run a shell command synchronously.
   * Throws on non-zero exit code.
   */
  runSync(command: string, cwd?: string): string {
    const dir = cwd ?? this.defaultCwd;
    console.log(`[TerminalOperator] sync $ ${command}  (cwd: ${dir})`);
    return execSync(command, { cwd: dir, encoding: "utf-8", timeout: this.timeoutMs }).trim();
  }

  /**
   * Run a sequence of commands, stopping on first failure.
   */
  async runSequence(commands: string[], cwd?: string): Promise<CommandResult[]> {
    const results: CommandResult[] = [];
    for (const cmd of commands) {
      const result = await this.run(cmd, cwd);
      results.push(result);
      if (result.exitCode !== 0) {
        console.error(`[TerminalOperator] Sequence aborted after: ${cmd}`);
        break;
      }
    }
    return results;
  }

  /**
   * Check whether a CLI tool is available in PATH.
   */
  isAvailable(tool: string): boolean {
    try {
      execSync(`which ${tool}`, { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }
}

/** Default singleton terminal operator rooted at CWD. */
export const terminal = new TerminalOperator();
