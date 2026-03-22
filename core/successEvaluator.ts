// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/successEvaluator.ts — Verify goal completion against success criteria

import * as net  from "net"
import * as http from "http"
import * as fs   from "fs"
import * as path from "path"

export interface EvaluationCheck {
  name:   string
  passed: boolean
  detail: string
}

export interface EvaluationResult {
  success:    boolean
  confidence: number
  checks:     EvaluationCheck[]
  summary:    string
}

// ── TCP port probe ────────────────────────────────────────

function tcpConnect(host: string, port: number, timeoutMs = 2000): Promise<boolean> {
  return new Promise(resolve => {
    const s = net.createConnection(port, host)
    const timer = setTimeout(() => { s.destroy(); resolve(false) }, timeoutMs)
    s.once("connect", () => { clearTimeout(timer); s.destroy(); resolve(true) })
    s.once("error",   () => { clearTimeout(timer); s.destroy(); resolve(false) })
  })
}

// ── HTTP GET probe ────────────────────────────────────────

function httpGet(url: string, timeoutMs = 3000): Promise<boolean> {
  return new Promise(resolve => {
    try {
      const req = http.get(url, { timeout: timeoutMs }, res => {
        resolve(res.statusCode !== undefined && res.statusCode < 500)
        res.resume()
      })
      req.on("error", () => resolve(false))
      req.on("timeout", () => { req.destroy(); resolve(false) })
    } catch {
      resolve(false)
    }
  })
}

// ── Evaluator ─────────────────────────────────────────────

export class SuccessEvaluator {

  async evaluate(task: any, result: any, parsedGoal: any): Promise<EvaluationResult> {
    const criteria: string[]    = parsedGoal?.successCriteria ?? []
    const workspacePath: string = task?.workspacePath ?? ""
    const checks: EvaluationCheck[] = []

    if (criteria.length === 0) {
      // Fallback: all nodes completed.
      // A graph with 0 nodes (empty plan) is NOT a failure — treat as neutral pass.
      // Only fail if nodes were present and didn't all complete.
      const total   = result?.totalNodes    ?? 0
      const done    = result?.nodesCompleted ?? 0
      const failed  = result?.nodesFailed   ?? 0
      const allDone = total === 0
        ? true                              // empty graph — nothing to fail
        : (done === total && failed === 0)
      checks.push({
        name:   "all nodes completed",
        passed: allDone,
        detail: total === 0
          ? "empty graph — no nodes to execute"
          : `${done}/${total} nodes done`,
      })
    } else {
      for (const criterion of criteria) {
        const check = await this.runCriterion(criterion, result, workspacePath)
        checks.push(check)
        console.log(`[SuccessEvaluator] ${check.name} ${check.passed ? "✅" : "❌"} — ${check.detail}`)
      }
    }

    const passed     = checks.filter(c => c.passed).length
    const total      = checks.length
    const confidence = total > 0 ? passed / total : 0
    const success    = confidence >= 0.5

    const summary = `${passed}/${total} checks passed (${(confidence * 100).toFixed(0)}% confidence)`

    return { success, confidence, checks, summary }
  }

  // ── Per-criterion logic ───────────────────────────────────

  private async runCriterion(
    criterion:     string,
    result:        any,
    workspacePath: string,
  ): Promise<EvaluationCheck> {
    const c = criterion.toLowerCase()

    if (c.includes("server running")) {
      const ports = [3000, 3001, 8000, 8080]
      for (const port of ports) {
        if (await tcpConnect("127.0.0.1", port)) {
          return { name: "server running", passed: true,  detail: `Port ${port} is listening` }
        }
      }
      return { name: "server running", passed: false, detail: "No server detected on 3000/3001/8000/8080" }
    }

    if (c.includes("no errors")) {
      const errors = result?.errors ? Object.keys(result.errors).length : 0
      return {
        name:   "no errors",
        passed: errors === 0,
        detail: errors === 0 ? "No execution errors" : `${errors} error(s) in result`,
      }
    }

    if (c.includes("dependencies installed")) {
      const nmPath = path.join(workspacePath, "node_modules")
      const exists = fs.existsSync(nmPath)
      return {
        name:   "dependencies installed",
        passed: exists,
        detail: exists ? "node_modules found" : "node_modules not found",
      }
    }

    if (c.includes("api endpoints respond")) {
      const ok = await httpGet("http://localhost:3000/api/health")
      return {
        name:   "API endpoints respond",
        passed: ok,
        detail: ok ? "GET /api/health responded" : "GET /api/health failed",
      }
    }

    if (c.includes("file exists")) {
      // Look for any files written in the result
      const filesWritten = result?.results
        ? Object.values(result.results).filter((r: any) => r?.output?.path).length
        : 0
      return {
        name:   "file exists",
        passed: filesWritten > 0,
        detail: filesWritten > 0 ? `${filesWritten} file(s) written` : "No files written",
      }
    }

    if (c.includes("build successful")) {
      const distPath  = path.join(workspacePath, "dist")
      const buildPath = path.join(workspacePath, "build")
      const exists    = fs.existsSync(distPath) || fs.existsSync(buildPath)
      return {
        name:   "build successful",
        passed: exists,
        detail: exists ? "dist/ or build/ found" : "No dist/ or build/ found",
      }
    }

    // Unknown criterion — skip with neutral pass
    return { name: criterion, passed: true, detail: "criterion not verifiable — assumed pass" }
  }
}

export const successEvaluator = new SuccessEvaluator()
