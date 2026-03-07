// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import fs from "fs";
import path from "path";
import { execa } from "execa";
import { spawn } from "child_process";

const LOG_FILE = "C:\\DevOS\\execution.log";

function logExecution(message: string) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
}

const BLOCKED_PATTERNS = [
  "format",
  "shutdown",
  "reboot",
  "rd /s",
  "del /s",
  "rm -rf /"
];

function isBlocked(command: string): boolean {
  return BLOCKED_PATTERNS.some(pattern =>
    command.toLowerCase().includes(pattern)
  );
}

function isLongRunning(command: string): boolean {
  return /node |npm start|python |flask|uvicorn/.test(command);
}

async function ensurePackageJson(cwd: string) {
  const pkgPath = path.join(cwd, "package.json");

  if (!fs.existsSync(pkgPath)) {
    await execa("npm init -y", {
      shell: true,
      cwd
    });
  }
}

export async function runCommand(
  command: string,
  risk: "low" | "medium" | "high",
  cwd: string
): Promise<string> {

  if (isBlocked(command)) {
    throw new Error("Blocked dangerous command.");
  }

  if (risk === "high") {
    throw new Error("High-risk command requires approval.");
  }

  logExecution(`COMMAND: ${command}`);

  if (command.startsWith("npm install")) {
    await ensurePackageJson(cwd);
  }

  if (isLongRunning(command)) {
    const child = spawn(command, {
      shell: true,
      cwd,
      detached: true,
      stdio: "ignore"
    });

    child.unref();
    logExecution(`SPAWNED LONG-RUNNING: ${command}`);
    return "Process started.";
  }

  const result = await execa(command, {
    shell: true,
    cwd
  });

  logExecution(`OUTPUT: ${result.stdout}`);
  return result.stdout;
}

export function createFile(
  filePath: string,
  content: string,
  risk: "low" | "medium" | "high"
) {

  if (risk === "high") {
    throw new Error("High-risk file operation requires approval.");
  }

  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, content);
  logExecution(`CREATE FILE: ${filePath}`);
}

export function editFile(
  filePath: string,
  content: string,
  risk: "low" | "medium" | "high"
) {

  if (risk === "high") {
    throw new Error("High-risk file edit requires approval.");
  }

  if (!fs.existsSync(filePath)) {
    throw new Error("File does not exist.");
  }

  fs.writeFileSync(filePath, content);
  logExecution(`EDIT FILE: ${filePath}`);
}

// ── SkillExecutor class (used by agentLoop, executionController) ──

/**
 * Class-based wrapper so legacy consumers that do `new SkillExecutor()`
 * keep working while the underlying logic stays in the free functions above.
 */
export class SkillExecutor {
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  async execute(skill: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const command = typeof args.command === "string" ? args.command : skill;
    return runCommand(command, "low", this.cwd);
  }

  async run(command: string, risk: "low" | "medium" | "high" = "low"): Promise<string> {
    return runCommand(command, risk, this.cwd);
  }

  write(filePath: string, content: string, risk: "low" | "medium" | "high" = "low"): void {
    createFile(filePath, content, risk);
  }

  edit(filePath: string, content: string, risk: "low" | "medium" | "high" = "low"): void {
    editFile(filePath, content, risk);
  }
}