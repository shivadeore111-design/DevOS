// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// coordination/commandGate.ts — Approval gate for potentially dangerous operations.
//
// Any subsystem that is about to take an irreversible or high-impact action
// (e.g. computer control, file deletion, external API calls with side effects)
// must call commandGate.requestApproval() first.
//
// In interactive mode (DEVOS_AUTO_APPROVE not set) approval is requested via
// stdout/stdin prompt.  In headless/CI mode (DEVOS_AUTO_APPROVE=true) all
// requests are approved automatically and logged.

import * as readline from 'readline'

export interface ApprovalRequest {
  action:    string
  reason:    string
  taskId?:   string
  timestamp: string
}

export interface ApprovalResult {
  approved:  boolean
  requestId: string
  timestamp: string
}

// ── CommandGate ───────────────────────────────────────────────

class CommandGate {
  private readonly log: ApprovalRequest[] = []

  /**
   * Request approval before executing a potentially dangerous operation.
   *
   * - DEVOS_AUTO_APPROVE=true  → always approves (CI/headless mode)
   * - DEVOS_HEADLESS=true      → always approves with a warning log
   * - Interactive               → prompts on stdout/stdin (y/N)
   *
   * @param action  Short human-readable description of what will happen.
   * @param reason  Context: why this action is being requested.
   * @param taskId  Optional task identifier for audit trail.
   */
  async requestApproval(action: string, reason: string, taskId?: string): Promise<boolean> {
    const request: ApprovalRequest = {
      action,
      reason,
      taskId,
      timestamp: new Date().toISOString(),
    }
    this.log.push(request)

    // Auto-approve in CI / headless environments
    if (
      process.env.DEVOS_AUTO_APPROVE === 'true' ||
      process.env.DEVOS_HEADLESS     === 'true' ||
      process.env.CI                 === 'true'
    ) {
      console.log(`[CommandGate] ✅ Auto-approved: ${action}`)
      return true
    }

    // Interactive prompt
    return new Promise<boolean>((resolve) => {
      const rl = readline.createInterface({
        input:  process.stdin,
        output: process.stdout,
      })

      console.log('\n┌─────────────────────────────────────────────────┐')
      console.log('│  ⚠️  DevOS CommandGate — Approval Required        │')
      console.log('└─────────────────────────────────────────────────┘')
      console.log(`  Action : ${action}`)
      console.log(`  Reason : ${reason}`)
      if (taskId) console.log(`  Task   : ${taskId}`)
      console.log()

      rl.question('  Approve? [y/N] ', (answer) => {
        rl.close()
        const approved = answer.trim().toLowerCase() === 'y'
        console.log(approved ? '  ✅ Approved\n' : '  ❌ Rejected\n')
        resolve(approved)
      })

      // Timeout: auto-reject after 30 s if no input
      setTimeout(() => {
        rl.close()
        console.log('  ⏱  Timed out — rejected\n')
        resolve(false)
      }, 30_000)
    })
  }

  /** Return the full audit log of all approval requests. */
  getLog(): ApprovalRequest[] {
    return this.log
  }
}

export const commandGate = new CommandGate()
