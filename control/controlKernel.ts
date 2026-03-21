// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// control/controlKernel.ts — Central gate: every action passes through here

import { commandSanitizer }     from "./commandSanitizer"
import { policyEngine }         from "./policyEngine"
import type { RiskLevel } from "./riskEvaluator"
import { budgetManager }        from "./budgetManager"
import { eventBus }             from "../core/eventBus"
import { auditLogger }          from "../security/auditLogger"

export interface ValidationResult {
  approved:  boolean
  reason?:   string
  riskLevel: RiskLevel
}

const APPROVAL_TIMEOUT_MS = 30_000

export class ControlKernel {

  // ── Prompt injection scanner ────────────────────────────

  private scanForInjection(input: string): boolean {
    const INJECTION_PATTERNS = [
      /ignore\s+previous\s+instructions/i,
      /disregard\s+(all\s+)?(previous|prior|earlier)/i,
      /override\s+(your\s+)?(instructions|directives|rules)/i,
      /you\s+are\s+now\s+/i,
      /forget\s+your\s+/i,
      /new\s+persona/i,
      /act\s+as\s+(a\s+|an\s+)?(?!devos)/i,
      /jailbreak/i,
      /rm\s+-rf\s+\//i,
      /DROP\s+TABLE/i,
      /;\s*cat\s+\/etc\/passwd/i,
      /\/etc\/shadow/i,
      /base64\s*--decode/i,
      /eval\s*\(/i,
    ];

    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        console.warn(`[ControlKernel] 🚨 Prompt injection detected: ${input.slice(0, 100)}`);
        return true;
      }
    }
    return false;
  }

  // ── Main validation gate ────────────────────────────────

  validate(action: any, goalId: string): ValidationResult {
    const actionLabel = `${action.type}${action.description ? ` "${action.description.slice(0, 40)}"` : ""}`

    // 0. Prompt injection scan — check goal, description, command, query fields
    const inputsToScan = [
      action.goal, action.description, action.command,
      action.query, action.content, action.prompt,
    ].filter(Boolean).join(" ");

    if (inputsToScan && this.scanForInjection(inputsToScan)) {
      auditLogger.log({
        timestamp: new Date().toISOString(),
        type:      "injection_blocked",
        actor:     "control-kernel",
        action:    `blocked:${action.type ?? "unknown"}`,
        detail:    inputsToScan.slice(0, 200),
        success:   false,
      });
      return { approved: false, reason: "Prompt injection detected", riskLevel: "critical" };
    }

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

    // 4. OpenCode-style approval — execute by default, block only truly dangerous ops
    const ALWAYS_EXECUTE = [
      'file_write', 'file_read', 'shell_exec', 'run_python',
      'run_node', 'run_powershell', 'fetch_url', 'open_browser',
      'notify', 'system_info', 'git_push', 'vercel_deploy',
    ]

    const REQUIRE_APPROVAL = [
      'rm_rf', 'format_disk', 'drop_database', 'delete_all',
    ]

    // Block truly dangerous op types first
    if (REQUIRE_APPROVAL.some(op => action.command?.includes(op) || action.type === op)) {
      return { approved: false, reason: 'Dangerous operation requires manual approval', riskLevel: 'critical' as RiskLevel }
    }

    // Always allow standard action types
    if (ALWAYS_EXECUTE.includes(action.type)) {
      console.log(`[ControlKernel] ✅ ${action.type} — standard action auto-approved`)
      return { approved: true, reason: 'Standard action — auto-approved', riskLevel: 'low' as RiskLevel }
    }

    // Shell commands — check for dangerous patterns only
    if (action.type === 'shell_exec' && action.command) {
      const dangerous = ['rm -rf /', 'format c:', 'del /f /s /q c:\\', 'DROP TABLE', ':(){:|:&}']
      if (dangerous.some(d => action.command.toLowerCase().includes(d.toLowerCase()))) {
        return { approved: false, reason: 'Dangerous command pattern detected', riskLevel: 'critical' as RiskLevel }
      }
      console.log(`[ControlKernel] ✅ ${action.type} — shell command auto-approved`)
      return { approved: true, reason: 'Shell command — auto-approved', riskLevel: 'medium' as RiskLevel }
    }

    // Default: auto-approve
    console.log(`[ControlKernel] ✅ ${action.type} — auto-approved`)
    return { approved: true, reason: 'Auto-approved', riskLevel: 'low' as RiskLevel }
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
