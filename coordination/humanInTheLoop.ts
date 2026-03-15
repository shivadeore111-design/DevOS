// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// coordination/humanInTheLoop.ts — User approval gate for dangerous actions

import * as readline from 'readline'
import { eventBus }  from '../core/eventBus'

const APPROVAL_TIMEOUT_MS = 60000

interface PendingApproval {
  resolve: (approved: boolean) => void
}

class HumanInTheLoop {
  private pendingApprovals = new Map<string, PendingApproval>()

  async requestApproval(
    actionDescription: string,
    reason: string,
    taskId: string,
  ): Promise<boolean> {
    // Check Telegram first — if enabled, route approval through the bot
    try {
      const fs   = require('fs')
      const path = require('path')
      const configPath = path.join(process.cwd(), 'config/integrations.json')
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        if (config.telegram?.enabled && config.telegram?.requireApprovalForDangerous) {
          const { telegramApproval } = await import('../integrations/telegram/telegramApproval')
          return telegramApproval.requestViaBot(actionDescription, taskId)
        }
      }
    } catch { /* fall through to CLI/SSE path */ }

    // CLI mode: prompt interactively
    if (process.env.DEVOS_MODE !== 'api') {
      return new Promise<boolean>(resolve => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
        rl.question(
          `\n🔔 DevOS wants to: ${actionDescription}\nReason: ${reason}\nApprove? (y/N): `,
          (answer: string) => {
            rl.close()
            const a = answer.trim().toLowerCase()
            const approved = a === 'y' || a === 'yes'
            console.log(`[HumanInTheLoop] ${approved ? '✅ Approved' : '❌ Rejected'}: ${taskId}`)
            resolve(approved)
          },
        )
      })
    }

    // API mode: emit SSE event and wait for approve/reject
    return new Promise<boolean>(resolve => {
      this.pendingApprovals.set(taskId, { resolve })

      eventBus.emit('approval_required', { actionDescription, reason, taskId })
      console.log(`[HumanInTheLoop] ⏳ Waiting for approval on task ${taskId}`)

      // Auto-reject after timeout
      setTimeout(() => {
        if (this.pendingApprovals.has(taskId)) {
          console.warn(`[HumanInTheLoop] ⏱️  Approval timeout for task ${taskId} — auto-rejected`)
          this.pendingApprovals.delete(taskId)
          resolve(false)
        }
      }, APPROVAL_TIMEOUT_MS)
    })
  }

  approve(taskId: string): void {
    const pending = this.pendingApprovals.get(taskId)
    if (!pending) {
      console.warn(`[HumanInTheLoop] No pending approval for task ${taskId}`)
      return
    }
    this.pendingApprovals.delete(taskId)
    console.log(`[HumanInTheLoop] ✅ Approved: ${taskId}`)
    pending.resolve(true)
  }

  reject(taskId: string, reason?: string): void {
    const pending = this.pendingApprovals.get(taskId)
    if (!pending) {
      console.warn(`[HumanInTheLoop] No pending approval for task ${taskId}`)
      return
    }
    this.pendingApprovals.delete(taskId)
    console.log(`[HumanInTheLoop] ❌ Rejected: ${taskId}${reason ? ` — ${reason}` : ''}`)
    pending.resolve(false)
  }
}

export const humanInTheLoop = new HumanInTheLoop()
