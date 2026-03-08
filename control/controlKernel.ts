// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// control/controlKernel.ts — Central gate: every action passes through here

import { commandSanitizer }     from "./commandSanitizer"
import { policyEngine }         from "./policyEngine"
import { riskEvaluator, RiskLevel } from "./riskEvaluator"
import { budgetManager }        from "./budgetManager"
import { eventBus }             from "../core/eventBus"

export interface ValidationResult {
  approved:  boolean
  reason?:   string
  riskLevel: RiskLevel
}

const APPROVAL_TIMEOUT_MS = 30_000

export class ControlKernel {

  // ── Main validation gate ────────────────────────────────

  validate(action: any, goalId: string): ValidationResult {
    const actionLabel = `${action.type}${action.description ? ` "${action.description.slice(0, 40)}"` : ""}`

    // 1. Budget / runtime check
    const budget = budgetManager.canContinue(goalId)
    if (!budget.allowed) {
      console.log(`[ControlKernel] ${actionLabel} ❌ ${budget.reason}`)
      return { approved: false, reason: budget.reason, riskLevel: "high" }
    }

    // 2. Command sanitizer (shell only)
    if (action.type === "shell_exec" && action.command) {
      const san = commandSanitizer.sanitize(action.command)
      if (!san.safe) {
        console.log(`[ControlKernel] ${actionLabel} ❌ ${san.reason}`)
        return { approved: false, reason: san.reason!, riskLevel: "critical" }
      }
      // Apply sanitized command back (strips sudo etc.)
      action.command = san.sanitized
      for (const w of san.warnings) {
        console.warn(`[ControlKernel] ⚠️  ${w}`)
      }
    }

    // 3. Policy engine check
    const policy = policyEngine.check(action)
    if (!policy.allowed) {
      console.log(`[ControlKernel] ${actionLabel} ❌ ${policy.reason}`)
      return { approved: false, reason: policy.reason, riskLevel: "critical" }
    }

    // 4. Risk evaluation
    const risk = riskEvaluator.evaluate(action)
    const icon = risk.requiresApproval ? "⚠️ " : "✅"
    console.log(`[ControlKernel] ${action.type} risk=${risk.level} ${icon}`)

    if (risk.requiresApproval) {
      // Emit event for dashboard; caller should call requestApproval() for interactive flow
      return {
        approved:  false,
        reason:    `Risk level ${risk.level} requires manual approval (score: ${risk.score})`,
        riskLevel: risk.level,
      }
    }

    return { approved: true, riskLevel: risk.level }
  }

  // ── Async approval request ──────────────────────────────

  async requestApproval(action: any, goalId: string): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      console.log(`[ControlKernel] 🔔 Approval required for action: ${action.type} — goalId: ${goalId}`)

      // Emit approval_required event
      eventBus.emit("approval_required", { action, goalId })

      let settled = false

      const onGranted = (data: any) => {
        if (data?.goalId !== goalId) return
        if (settled) return
        settled = true
        eventBus.off("approval_granted", onGranted)
        eventBus.off("approval_denied",  onDenied)
        console.log(`[ControlKernel] ✅ Approval granted for ${goalId}`)
        resolve(true)
      }

      const onDenied = (data: any) => {
        if (data?.goalId !== goalId) return
        if (settled) return
        settled = true
        eventBus.off("approval_granted", onGranted)
        eventBus.off("approval_denied",  onDenied)
        console.log(`[ControlKernel] ❌ Approval denied for ${goalId}`)
        resolve(false)
      }

      eventBus.on("approval_granted", onGranted)
      eventBus.on("approval_denied",  onDenied)

      // Auto-deny after timeout
      setTimeout(() => {
        if (!settled) {
          settled = true
          eventBus.off("approval_granted", onGranted)
          eventBus.off("approval_denied",  onDenied)
          console.log(`[ControlKernel] ⏱️  Approval timed out for ${goalId} — auto-denied`)
          resolve(false)
        }
      }, APPROVAL_TIMEOUT_MS)
    })
  }
}

export const controlKernel = new ControlKernel()
