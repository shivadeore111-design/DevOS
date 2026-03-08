// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/osContext.ts — Runtime OS detection and capability discovery

import os from "os"
import { execSync } from "child_process"

export interface OSContext {
  platform: string
  shell: string
  shellFlag: string
  nodeVersion: string
  hasDocker: boolean
  hasGit: boolean
  hasNpm: boolean
  tempDir: string
  homeDir: string
}

function checkCommand(cmd: string): boolean {
  try { execSync(`${cmd} --version`, { stdio: "ignore" }); return true }
  catch { return false }
}

export function detectOSContext(): OSContext {
  const platform = os.platform()
  const isWindows = platform === "win32"
  return {
    platform,
    shell: isWindows ? "cmd.exe" : "/bin/bash",
    shellFlag: isWindows ? "/c" : "-c",
    nodeVersion: process.version,
    hasDocker: checkCommand("docker"),
    hasGit: checkCommand("git"),
    hasNpm: checkCommand("npm"),
    tempDir: os.tmpdir(),
    homeDir: os.homedir()
  }
}

export const osContext = detectOSContext()
