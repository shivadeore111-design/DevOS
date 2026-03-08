// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/planConfidence.ts — Score a generated plan and decide execution mode

import { riskEvaluator } from "../control/riskEvaluator"

export type ExecutionDecision = "auto" | "confirm" | "approve"

const IDEAL_MIN = 2
const IDEAL_MAX = 6

export class PlanConfidence {

  /** Score a plan 0.0–1.0 based on quality signals */
  score(plan: any, parsedGoal: any): number {
    if (!plan?.actions?.length) return 0

    const actions: any[] = plan.actions
    let   total = 0

    // ── 1. Action count in ideal range ──────────────────
    if (actions.length >= IDEAL_MIN && actions.length <= IDEAL_MAX) {
      total += 0.2
    }

    // ── 2. All actions have descriptions ────────────────
    const allDescribed = actions.every(a => !!a.description)
    if (allDescribed) total += 0.2

    // ── 3. All file_write actions have content ───────────
    const fileWrites    = actions.filter(a => a.type === "file_write")
    const allHaveContent = fileWrites.every(a => !!a.content)
    if (fileWrites.length === 0 || allHaveContent) total += 0.2

    // ── 4. No high-risk actions ──────────────────────────
    const hasHighRisk = actions.some(a => {
      const assessment = riskEvaluator.evaluate(a)
      return assessment.level === "high" || assessment.level === "critical"
    })
    if (!hasHighRisk) total += 0.2

    // ── 5. Plan complexity matches goal type ─────────────
    const goalType = parsedGoal?.type ?? "unknown"
    const actionCount = actions.length
    let complexityMatch = false
    switch (goalType) {
      case "build":
        complexityMatch = actionCount >= 3 && actionCount <= IDEAL_MAX
        break
      case "debug":
        complexityMatch = actionCount >= 2 && actionCount <= 5
        break
      case "deploy":
        complexityMatch = actionCount >= 3 && actionCount <= 7
        break
      case "research":
        complexityMatch = actionCount >= 2 && actionCount <= 5
        break
      case "refactor":
        complexityMatch = actionCount >= 2 && actionCount <= 8
        break
      default:
        complexityMatch = actionCount >= IDEAL_MIN
    }
    if (complexityMatch) total += 0.2

    return Math.min(Math.max(total, 0), 1)
  }

  /** Decide how to proceed given a confidence score */
  decide(score: number): ExecutionDecision {
    if (score >= 0.8)  return "auto"
    if (score >= 0.5)  return "confirm"
    return "approve"
  }
}

export const planConfidence = new PlanConfidence()
