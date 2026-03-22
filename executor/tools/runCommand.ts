// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

import * as childProcess from "child_process"
import * as path         from "path"
import { Tool, ToolResult } from "../toolRuntime"
import { controlKernel }    from "../../control/controlKernel"

const DEFAULT_TIMEOUT_MS = 30_000

export const runCommand: Tool = {
  name:        "runCommand",
  description: "Execute a shell command in a given working directory",

  async execute(input: {
    command: string
    cwd?:    string
    timeout?: number
  }): Promise<ToolResult> {
    // ── Control-kernel validation ─────────────────────────
    const validation = controlKernel.validate(
      { type: "shell_exec", command: input.command },
      "tool_runtime"
    )
    if (!validation.approved) {
      return { success: false, error: `Blocked by ControlKernel: ${validation.reason}` }
    }

    const cwd     = input.cwd ? path.resolve(input.cwd) : process.cwd()
    const timeout = input.timeout ?? DEFAULT_TIMEOUT_MS

    try {
      const stdout = childProcess.execSync(input.command, {
        cwd,
        timeout,
        encoding: "utf-8",
        stdio:    ["pipe", "pipe", "pipe"],
      })

      return {
        success: true,
        output:  { stdout: stdout.trim(), exitCode: 0 },
      }
    } catch (err: any) {
      const stderr = err.stderr?.toString?.()?.trim() ?? err.message
      return { success: false, error: stderr }
    }
  },
}
