// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// core/faultEngine.ts — Error classification and automatic repair
// Classifies failures by type and attempts targeted repairs
// before escalating to the user with an exact manual fix command.

import * as fs   from "fs"
import * as path from "path"
import * as net  from "net"
import { execa } from "execa"

// ── Fault taxonomy ────────────────────────────────────────

export type FaultType =
  | "MISSING_DEPENDENCY"
  | "MODULE_NOT_FOUND"
  | "SYNTAX_ERROR"
  | "PORT_IN_USE"
  | "PERMISSION_DENIED"
  | "FILE_NOT_FOUND"
  | "TIMEOUT"
  | "EMPTY_OUTPUT"
  | "NETWORK_ERROR"
  | "BUILD_ERROR"
  | "UNKNOWN"

// ── Context passed with each failure ─────────────────────

export interface FaultContext {
  actionType:    string
  command?:      string
  filePath?:     string
  workspacePath: string
  goalId?:       string
}

// ── Classification result ─────────────────────────────────

export interface FaultClassification {
  type:           FaultType
  confidence:     number          // 0.0 – 1.0
  repairStrategy: string          // human-readable description of the repair
  repairAction?:  RepairAction    // machine-executable repair
  manualFix:      string          // exact command the user can run if repair fails
}

// ── Repair action spec ────────────────────────────────────

export interface RepairAction {
  kind:       "shell" | "file_delete" | "mkdir" | "noop"
  command?:   string
  targetPath?: string
}

// ── Fault patterns ────────────────────────────────────────

interface FaultPattern {
  type:           FaultType
  patterns:       RegExp[]
  repairStrategy: string
  buildRepair:    (error: string, ctx: FaultContext) => RepairAction
  buildManualFix: (error: string, ctx: FaultContext) => string
}

const FAULT_PATTERNS: FaultPattern[] = [
  // ── Missing npm dependency ────────────────────────────
  {
    type:           "MISSING_DEPENDENCY",
    patterns:       [
      /cannot find module '([^']+)'/i,
      /module not found.*error: can't resolve '([^']+)'/i,
      /error: cannot find module/i,
    ],
    repairStrategy: "Run npm install to restore missing package",
    buildRepair:    (_err, ctx) => ({
      kind:    "shell",
      command: `npm install`,
    }),
    buildManualFix: (_err, ctx) => `cd "${ctx.workspacePath}" && npm install`,
  },

  // ── Node module not found (require/import fail) ───────
  {
    type:           "MODULE_NOT_FOUND",
    patterns:       [
      /cannot find module/i,
      /module '([^']+)' not found/i,
    ],
    repairStrategy: "Install missing node module",
    buildRepair:    (err, ctx) => {
      const match = err.match(/cannot find module '([^']+)'/i) ?? err.match(/module '([^']+)' not found/i)
      const pkg   = match?.[1]?.replace(/^@?[./].*/, "").split("/")[0]
      return pkg
        ? { kind: "shell", command: `npm install ${pkg}` }
        : { kind: "shell", command: `npm install` }
    },
    buildManualFix: (err, ctx) => {
      const match = err.match(/cannot find module '([^']+)'/i)
      const pkg   = match?.[1]?.replace(/^@?[./].*/, "").split("/")[0]
      return pkg
        ? `cd "${ctx.workspacePath}" && npm install ${pkg}`
        : `cd "${ctx.workspacePath}" && npm install`
    },
  },

  // ── Port already in use ───────────────────────────────
  {
    type:           "PORT_IN_USE",
    patterns:       [
      /address already in use/i,
      /eaddrinuse/i,
      /port (\d+) already in use/i,
    ],
    repairStrategy: "Kill the process occupying the port and retry",
    buildRepair:    (err, ctx) => {
      const match = err.match(/[:\s](\d{4,5})/)
      const port  = match?.[1] ?? "3000"
      const isWin = process.platform === "win32"
      const cmd   = isWin
        ? `for /f "tokens=5" %a in ('netstat -aon ^| findstr :${port}') do taskkill /F /PID %a`
        : `lsof -ti tcp:${port} | xargs kill -9 2>/dev/null || true`
      return { kind: "shell", command: cmd }
    },
    buildManualFix: (err, _ctx) => {
      const match = err.match(/[:\s](\d{4,5})/)
      const port  = match?.[1] ?? "3000"
      return process.platform === "win32"
        ? `netstat -aon | findstr :${port}  (then taskkill /F /PID <pid>)`
        : `lsof -ti tcp:${port} | xargs kill -9`
    },
  },

  // ── Permission denied ─────────────────────────────────
  {
    type:           "PERMISSION_DENIED",
    patterns:       [
      /permission denied/i,
      /eacces/i,
      /access is denied/i,
    ],
    repairStrategy: "Fix file permissions and retry",
    buildRepair:    (_err, ctx) => {
      const target = ctx.filePath ?? ctx.workspacePath
      const isWin  = process.platform === "win32"
      const cmd    = isWin
        ? `icacls "${target}" /grant Everyone:F`
        : `chmod -R u+rwX "${target}"`
      return { kind: "shell", command: cmd }
    },
    buildManualFix: (_err, ctx) => {
      const target = ctx.filePath ?? ctx.workspacePath
      return process.platform === "win32"
        ? `icacls "${target}" /grant Everyone:F`
        : `chmod -R u+rwX "${target}"`
    },
  },

  // ── File not found ────────────────────────────────────
  {
    type:           "FILE_NOT_FOUND",
    patterns:       [
      /no such file or directory/i,
      /enoent/i,
      /file not found/i,
      /cannot open.*no such file/i,
    ],
    repairStrategy: "Create missing directory structure and retry",
    buildRepair:    (_err, ctx) => {
      const dir = ctx.filePath ? path.dirname(ctx.filePath) : ctx.workspacePath
      return { kind: "mkdir", targetPath: dir }
    },
    buildManualFix: (_err, ctx) => {
      const dir = ctx.filePath ? path.dirname(ctx.filePath) : ctx.workspacePath
      return process.platform === "win32"
        ? `mkdir "${dir}"`
        : `mkdir -p "${dir}"`
    },
  },

  // ── Syntax / parse error ──────────────────────────────
  {
    type:           "SYNTAX_ERROR",
    patterns:       [
      /syntaxerror/i,
      /unexpected token/i,
      /parse error/i,
      /unexpected end of/i,
    ],
    repairStrategy: "Syntax error in generated code — requires manual review",
    buildRepair:    () => ({ kind: "noop" }),
    buildManualFix: (_err, ctx) => {
      const file = ctx.filePath ?? ctx.workspacePath
      return `Review and fix syntax error in: ${file}`
    },
  },

  // ── Timeout ───────────────────────────────────────────
  {
    type:           "TIMEOUT",
    patterns:       [
      /timed? ?out/i,
      /etimedout/i,
      /operation timed out/i,
      /request timed out/i,
    ],
    repairStrategy: "Command timed out — retry with extended timeout or check network",
    buildRepair:    () => ({ kind: "noop" }),
    buildManualFix: (_err, ctx) => {
      if (ctx.command) return `${ctx.command}  # (timed out — check network or increase timeout)`
      return `Check network connectivity or increase timeout in configuration`
    },
  },

  // ── Network error ─────────────────────────────────────
  {
    type:           "NETWORK_ERROR",
    patterns:       [
      /econnrefused/i,
      /econnreset/i,
      /network.*unreachable/i,
      /getaddrinfo.*fail/i,
      /fetch failed/i,
    ],
    repairStrategy: "Network connection failed — verify service is running",
    buildRepair:    () => ({ kind: "noop" }),
    buildManualFix: (_err, ctx) => ctx.command
      ? `# Ensure target service is up, then: ${ctx.command}`
      : `Check network and service availability`,
  },

  // ── Build error ───────────────────────────────────────
  {
    type:           "BUILD_ERROR",
    patterns:       [
      /error ts\d+/i,
      /compilation failed/i,
      /build failed/i,
      /tsc.*error/i,
    ],
    repairStrategy: "TypeScript / build error — check types and tsconfig",
    buildRepair:    (_err, ctx) => ({
      kind:    "shell",
      command: `cd "${ctx.workspacePath}" && ./node_modules/.bin/tsc --noEmit 2>&1`,
    }),
    buildManualFix: (_err, ctx) => `cd "${ctx.workspacePath}" && ./node_modules/.bin/tsc --noEmit`,
  },

  // ── Empty output ──────────────────────────────────────
  {
    type:           "EMPTY_OUTPUT",
    patterns:       [
      /empty (output|response|result)/i,
      /returned empty/i,
    ],
    repairStrategy: "Command produced no output — check command syntax",
    buildRepair:    () => ({ kind: "noop" }),
    buildManualFix: (_err, ctx) => ctx.command ?? "Review command for correctness",
  },
]

// ── FaultEngine class ─────────────────────────────────────

export class FaultEngine {

  // ── Classify ─────────────────────────────────────────

  classify(error: string, ctx: FaultContext): FaultClassification {
    for (const fp of FAULT_PATTERNS) {
      for (const pattern of fp.patterns) {
        pattern.lastIndex = 0  // reset stateful regex
        if (pattern.test(error)) {
          return {
            type:           fp.type,
            confidence:     0.9,
            repairStrategy: fp.repairStrategy,
            repairAction:   fp.buildRepair(error, ctx),
            manualFix:      fp.buildManualFix(error, ctx),
          }
        }
      }
    }

    // UNKNOWN fallback
    return {
      type:           "UNKNOWN",
      confidence:     0.3,
      repairStrategy: "Unknown error — escalating to manual review",
      repairAction:   { kind: "noop" },
      manualFix:      ctx.command
        ? `Retry manually: ${ctx.command}`
        : `Check logs and retry goal`,
    }
  }

  // ── Repair ───────────────────────────────────────────

  async repair(classification: FaultClassification, ctx: FaultContext): Promise<boolean> {
    const ra = classification.repairAction
    if (!ra || ra.kind === "noop") {
      console.log(`[FaultEngine] No auto-repair for ${classification.type} — skipping`)
      return false
    }

    console.log(`[FaultEngine] 🔧 Attempting repair: ${classification.repairStrategy}`)

    try {
      if (ra.kind === "shell" && ra.command) {
        const { shell, flag } = this.runtimeShell()
        const result = await execa(shell, [flag, ra.command], {
          cwd:     ctx.workspacePath,
          timeout: 60_000,
          reject:  false,
        })
        const ok = (result.exitCode ?? 1) === 0
        console.log(`[FaultEngine] Repair shell exit ${result.exitCode ?? "?"}: ${ra.command.slice(0, 80)}`)
        return ok
      }

      if (ra.kind === "mkdir" && ra.targetPath) {
        fs.mkdirSync(ra.targetPath, { recursive: true })
        console.log(`[FaultEngine] Created directory: ${ra.targetPath}`)
        return true
      }

      if (ra.kind === "file_delete" && ra.targetPath) {
        if (fs.existsSync(ra.targetPath)) {
          fs.unlinkSync(ra.targetPath)
          console.log(`[FaultEngine] Deleted file: ${ra.targetPath}`)
        }
        return true
      }

    } catch (err: any) {
      console.error(`[FaultEngine] Repair threw: ${err.message}`)
    }

    return false
  }

  // ── Helpers ───────────────────────────────────────────

  private runtimeShell(): { shell: string; flag: string } {
    return process.platform === "win32"
      ? { shell: "cmd.exe", flag: "/c" }
      : { shell: "/bin/sh", flag: "-c" }
  }
}

export const faultEngine = new FaultEngine()
