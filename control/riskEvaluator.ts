// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// control/riskEvaluator.ts — Score and classify action risk level

import * as fs from "fs"
import * as path from "path"

export type RiskLevel = "low" | "medium" | "high" | "critical"

export interface RiskAssessment {
  level:            RiskLevel
  score:            number
  reasons:          string[]
  requiresApproval: boolean
}

export class RiskEvaluator {

  evaluate(action: any): RiskAssessment {
    let score   = 0
    const reasons: string[] = []

    // ── file_write to existing file ──────────────────────
    if (action.type === "file_write" && action.path) {
      const absPath = path.resolve(action.path)
      if (fs.existsSync(absPath)) {
        score += 20
        reasons.push("file_write overwrites existing file (+20)")
      }
    }

    // ── shell_exec base ──────────────────────────────────
    if (action.type === "shell_exec") {
      score += 10
      reasons.push("shell_exec base risk (+10)")

      const cmd = (action.command ?? "").toLowerCase()

      if (/\binstall\b/.test(cmd)) {
        score += 15
        reasons.push("command contains 'install' (+15)")
      }

      if (/\b(delete|remove|drop)\b/.test(cmd)) {
        score += 40
        reasons.push("command contains delete/remove/drop (+40)")
      }

      if (/\b(deploy|publish)\b/.test(cmd)) {
        score += 30
        reasons.push("command contains deploy/publish (+30)")
      }
    }

    // ── Sensitive path ───────────────────────────────────
    const actionPath = action.path ?? action.command ?? ""
    if (/[Cc]:\\[Uu]sers[/\\][^/\\]+[/\\](?!AppData)/.test(actionPath)) {
      score += 25
      reasons.push("path touches C:\\Users root directory (+25)")
    }

    // ── Missing description ──────────────────────────────
    if (!action.description) {
      score += 10
      reasons.push("action has no description (+10)")
    }

    // ── Derive level ─────────────────────────────────────
    let level: RiskLevel
    if      (score >= 76) level = "critical"
    else if (score >= 51) level = "high"
    else if (score >= 26) level = "medium"
    else                  level = "low"

    const requiresApproval = level === "high" || level === "critical"

    return { level, score, reasons, requiresApproval }
  }
}

export const riskEvaluator = new RiskEvaluator()
