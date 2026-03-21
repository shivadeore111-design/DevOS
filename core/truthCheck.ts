// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// core/truthCheck.ts — Mandatory postcondition verification
// Runs after every TaskGraph execution and confirms that
// each action actually achieved its intended effect.

import * as fs   from "fs"
import * as path from "path"
import { TaskGraph, TaskNode } from "./taskGraph"

// ── Public types ──────────────────────────────────────────

export interface NodeVerification {
  nodeId:      string
  description: string
  actionType:  string
  passed:      boolean
  detail:      string
}

export interface TruthCheckResult {
  passed:        boolean
  verified:      number
  failed:        number
  skipped:       number
  verifications: NodeVerification[]
  summary:       string
}

// ── Main verifier class ───────────────────────────────────

export class TruthChecker {

  /**
   * Verify every completed node in the graph.
   * Nodes that are "skipped" or "failed" are noted but not re-checked.
   * Only "done" nodes are verified against their postconditions.
   */
  verify(graph: TaskGraph, workspacePath: string): TruthCheckResult {
    const verifications: NodeVerification[] = []
    let verified = 0
    let failed   = 0
    let skipped  = 0

    for (const node of graph.nodes.values()) {
      if (node.status === "skipped" || node.status === "pending" || node.status === "running") {
        skipped++
        verifications.push({
          nodeId:      node.id,
          description: node.description,
          actionType:  node.action?.type ?? "unknown",
          passed:      false,
          detail:      `Node ${node.status} — not verified`,
        })
        continue
      }

      if (node.status === "failed") {
        failed++
        verifications.push({
          nodeId:      node.id,
          description: node.description,
          actionType:  node.action?.type ?? "unknown",
          passed:      false,
          detail:      `Node failed during execution: ${node.error ?? "unknown error"}`,
        })
        continue
      }

      // status === "done" — run postcondition check
      const v = this.verifyNode(node, workspacePath)
      verifications.push(v)

      if (v.passed) {
        verified++
        console.log(`[TruthCheck] ✅ ${node.action?.type ?? "?"} — ${v.detail}`)
      } else {
        failed++
        console.error(`[TruthCheck] ❌ ${node.action?.type ?? "?"} failed — ${v.detail}`)
        // Retroactively mark node as failed so GraphExecutor results stay consistent
        node.status = "failed"
        node.error  = `[TruthCheck] ${v.detail}`
      }
    }

    const total   = graph.nodes.size
    const passed  = failed === 0
    const summary = passed
      ? `[TruthCheck] ✅ All ${verified} action${verified !== 1 ? "s" : ""} verified`
      : `[TruthCheck] ❌ ${failed}/${total} action${total !== 1 ? "s" : ""} failed postcondition check`

    console.log(summary)
    return { passed, verified, failed, skipped, verifications, summary }
  }

  // ── Per-node verification ─────────────────────────────

  private verifyNode(node: TaskNode, workspacePath: string): NodeVerification {
    const action = node.action ?? {}
    const type   = action.type as string | undefined
    const result = node.result   // output from engine

    const base: Omit<NodeVerification, "passed" | "detail"> = {
      nodeId:      node.id,
      description: node.description,
      actionType:  type ?? "unknown",
    }

    try {
      switch (type) {

        // ── file_write ────────────────────────────────
        case "file_write": {
          const filePath = this.resolvePath(workspacePath, action.path)
          if (!filePath) return { ...base, passed: false, detail: `file_write: no path specified` }
          const exists    = fs.existsSync(filePath)
          const nonEmpty  = exists && fs.statSync(filePath).size > 0
          if (!exists)   return { ...base, passed: false, detail: `file_write failed — file not found at ${filePath}` }
          if (!nonEmpty) return { ...base, passed: false, detail: `file_write failed — file is empty at ${filePath}` }
          return { ...base, passed: true, detail: `file exists and non-empty at ${filePath}` }
        }

        // ── file_append ───────────────────────────────
        case "file_append": {
          const filePath = this.resolvePath(workspacePath, action.path)
          if (!filePath) return { ...base, passed: false, detail: `file_append: no path specified` }
          const exists = fs.existsSync(filePath)
          return {
            ...base,
            passed: exists,
            detail: exists ? `file exists at ${filePath}` : `file_append failed — file not found at ${filePath}`,
          }
        }

        // ── file_read ─────────────────────────────────
        case "file_read": {
          // file_read is verified by checking that result.output.content is non-null
          const content = result?.content ?? result?.output?.content
          const ok = typeof content === "string" && content.length > 0
          return {
            ...base,
            passed: ok,
            detail: ok ? `file_read returned ${content.length} chars` : `file_read returned empty/null content`,
          }
        }

        // ── file_delete ───────────────────────────────
        case "file_delete": {
          const filePath = this.resolvePath(workspacePath, action.path)
          if (!filePath) return { ...base, passed: false, detail: `file_delete: no path specified` }
          const gone = !fs.existsSync(filePath)
          return {
            ...base,
            passed: gone,
            detail: gone ? `file successfully deleted: ${filePath}` : `file_delete failed — file still exists at ${filePath}`,
          }
        }

        // ── folder_create ─────────────────────────────
        case "folder_create": {
          const dirPath = this.resolvePath(workspacePath, action.path)
          if (!dirPath) return { ...base, passed: false, detail: `folder_create: no path specified` }
          const exists = fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()
          return {
            ...base,
            passed: exists,
            detail: exists ? `directory exists: ${dirPath}` : `folder_create failed — directory not found at ${dirPath}`,
          }
        }

        // ── shell_exec ────────────────────────────────
        case "shell_exec": {
          const exitCode = result?.exitCode ?? result?.output?.exitCode ?? result?.output?.exit_code
          // If exitCode is explicitly 0 → pass
          // If result.success = true (engine already passed it) → pass
          const enginePassed = node.status === "done"
          if (typeof exitCode === "number") {
            return {
              ...base,
              passed: exitCode === 0,
              detail: exitCode === 0
                ? `shell_exec exited 0`
                : `shell_exec exited ${exitCode}: ${result?.output?.stderr ?? ""}`.slice(0, 120),
            }
          }
          // No exitCode in result — trust the engine's done status
          return {
            ...base,
            passed: enginePassed,
            detail: enginePassed ? `shell_exec completed (no exit code returned)` : `shell_exec failed`,
          }
        }

        // ── npm_install ───────────────────────────────
        case "npm_install": {
          const nmPath = path.join(workspacePath, "node_modules")
          const exists = fs.existsSync(nmPath) && fs.statSync(nmPath).isDirectory()
          return {
            ...base,
            passed: exists,
            detail: exists ? `node_modules found at ${nmPath}` : `npm_install failed — node_modules not found at ${nmPath}`,
          }
        }

        // ── http_check ────────────────────────────────
        case "http_check": {
          const statusCode = result?.statusCode ?? result?.output?.statusCode
          if (typeof statusCode === "number") {
            const ok = statusCode >= 200 && statusCode < 300
            return {
              ...base,
              passed: ok,
              detail: ok
                ? `HTTP ${statusCode} — ${action.url}`
                : `http_check returned HTTP ${statusCode} for ${action.url}`,
            }
          }
          // No status code — fall back to engine result
          return { ...base, passed: node.status === "done", detail: `http_check completed (no status code in result)` }
        }

        // ── run_python / run_node / run_powershell ────
        case "run_python":
        case "run_node":
        case "run_powershell": {
          const output = result?.output ?? result
          const errored = typeof output === "string" && output.startsWith("Error:")
          return {
            ...base,
            passed: !errored,
            detail: errored ? `${type} failed: ${String(output).slice(0, 120)}` : `${type} executed successfully`,
          }
        }

        // ── fetch_url / web_fetch / web_search ────────
        case "fetch_url":
        case "web_fetch":
        case "web_search": {
          const content = result?.content ?? result?.output?.content ?? result?.output?.body
          const ok = typeof content === "string" && content.length > 0
          return {
            ...base,
            passed: ok,
            detail: ok ? `${type} returned ${content.length} chars` : `${type} returned empty response`,
          }
        }

        // ── notify / system_info / open_browser ───────
        case "notify":
        case "system_info":
        case "open_browser": {
          // These are fire-and-forget — engine status is the ground truth
          return { ...base, passed: true, detail: `${type} completed (no postcondition)` }
        }

        // ── llm_task ──────────────────────────────────
        case "llm_task": {
          const content = result?.content ?? result?.output?.content
          const ok = typeof content === "string" && content.length > 0
          return {
            ...base,
            passed: ok,
            detail: ok ? `llm_task returned ${content.length} chars` : `llm_task returned empty response`,
          }
        }

        // ── product_build ─────────────────────────────
        case "product_build": {
          const status = result?.status ?? result?.output?.status
          return {
            ...base,
            passed: status === "completed",
            detail: status === "completed" ? `product_build completed` : `product_build status: ${status ?? "unknown"}`,
          }
        }

        // ── Default: trust engine result ──────────────
        default:
          return { ...base, passed: true, detail: `${type ?? "unknown"}: no postcondition defined — engine result trusted` }
      }
    } catch (err: any) {
      return { ...base, passed: false, detail: `TruthCheck threw: ${err.message}` }
    }
  }

  // ── Helpers ───────────────────────────────────────────

  private resolvePath(workspace: string, filePath: string | undefined): string | null {
    if (!filePath) return null
    if (path.isAbsolute(filePath)) return filePath
    return path.join(workspace, filePath)
  }
}

export const truthChecker = new TruthChecker()
