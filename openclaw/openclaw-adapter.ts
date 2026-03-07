// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// openclaw/openclaw-adapter.ts

import { spawn } from "child_process"
import * as fs from "fs"
import * as path from "path"

export interface OpenClawResult {
  success: boolean
  output?: string
  error?: string
  artifacts?: string[]
  exitCode?: number
  durationMs?: number
}

export class OpenClawAdapter {
  private timeoutMs = 60000

  async executeEscalation(
    action: any,
    workspace: string
  ): Promise<OpenClawResult> {
    try {
      console.log("⚡ OpenClaw Escalation Triggered")

      switch (action.type) {
        case "file_create":
          return this.handleFileCreate(action, workspace)

        case "shell":
          return this.executeShellCommand(action.command, workspace)

        case "shell_plan":
          return this.executeShellPlan(action.commands, workspace)

        default:
          return {
            success: false,
            error: `Unsupported escalation type: ${action.type}`
          }
      }
    } catch (err: any) {
      return {
        success: false,
        error: err.message
      }
    }
  }

  // ================================
  // FILE CREATE (Controlled)
  // ================================

  private async handleFileCreate(action: any, workspace: string): Promise<OpenClawResult> {
    const fullPath = path.join(workspace, action.path)

    this.assertPathInsideWorkspace(fullPath, workspace)

    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, action.content || "")

    return {
      success: true,
      output: "File created via OpenClaw",
      artifacts: [fullPath]
    }
  }

  // ================================
  // SINGLE SHELL EXECUTION
  // ================================

  private async executeShellCommand(
    command: string,
    workspace: string
  ): Promise<OpenClawResult> {
    this.assertSafeCommand(command)

    return new Promise((resolve) => {
      const start = Date.now()

      const child = spawn(command, {
        shell: true,
        cwd: workspace,
        windowsHide: true
      })

      let stdout = ""
      let stderr = ""
      let killedByTimeout = false

      const timeout = setTimeout(() => {
        killedByTimeout = true
        child.kill("SIGKILL")
      }, this.timeoutMs)

      child.stdout.on("data", (data) => {
        stdout += data.toString()
      })

      child.stderr.on("data", (data) => {
        stderr += data.toString()
      })

      child.on("close", (code) => {
        clearTimeout(timeout)

        const durationMs = Date.now() - start

        resolve({
          success: !killedByTimeout && code === 0,
          output: stdout.trim(),
          error: stderr.trim() || undefined,
          exitCode: code ?? -1,
          durationMs
        })
      })
    })
  }

  // ================================
  // MULTI-COMMAND PLAN EXECUTION
  // ================================

  private async executeShellPlan(
    commands: string[],
    workspace: string
  ): Promise<OpenClawResult> {
    const artifacts: string[] = []
    const start = Date.now()

    for (const command of commands) {
      const result = await this.executeShellCommand(command, workspace)

      if (!result.success) {
        return {
          success: false,
          error: `Plan failed at command: ${command}\n${result.error || ""}`,
          durationMs: Date.now() - start
        }
      }

      artifacts.push(`executed: ${command}`)
    }

    return {
      success: true,
      output: "Shell plan executed successfully",
      artifacts,
      durationMs: Date.now() - start
    }
  }

  // ================================
  // SAFETY LAYERS
  // ================================

  private assertSafeCommand(command: string) {
    const blockedPatterns = [
      /rm\s+-rf\s+\//i,
      /rm\s+-rf\s+\*/i,
      /format\s+/i,
      /shutdown/i,
      /reboot/i,
      /del\s+\/f/i,
      /rmdir\s+\/s/i,
      /:\(\)\{:\|\:&\};:/ // fork bomb
    ]

    for (const pattern of blockedPatterns) {
      if (pattern.test(command)) {
        throw new Error(`Blocked dangerous command: ${command}`)
      }
    }
  }

  private assertPathInsideWorkspace(fullPath: string, workspace: string) {
    const resolvedWorkspace = path.resolve(workspace)
    const resolvedPath = path.resolve(fullPath)

    if (!resolvedPath.startsWith(resolvedWorkspace)) {
      throw new Error("Path escape attempt detected")
    }
  }
}