// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// integrations/telegram/botGate.ts — Telegram inline-keyboard approval gate
//
// Wires into coordination/commandGate.ts:
//   1. Listens to 'command_gate_triggered' on eventBus
//   2. When Telegram is configured, sends inline keyboard [✅ Approve] [❌ Reject]
//   3. 60-second timeout → auto-reject
//   4. handleCallbackQuery() resolves the pending Promise

import * as fs   from 'fs'
import * as path from 'path'
import { eventBus } from '../../core/eventBus'

const APPROVAL_TIMEOUT_MS = 60_000

function loadTelegramConfig(): any {
  try {
    const configPath = path.join(process.cwd(), 'config/integrations.json')
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    return config.telegram || {}
  } catch {
    return {}
  }
}

function isTelegramEnabled(): boolean {
  const cfg = loadTelegramConfig()
  return !!(cfg.enabled && cfg.botToken && cfg.requireApprovalForDangerous)
}

// ── BotGate class ─────────────────────────────────────────

export class BotGate {
  private pendingApprovals = new Map<string, { resolve: (v: boolean) => void }>()

  constructor() {
    // Subscribe to commandGate events so we can intercept via eventBus too
    // (humanInTheLoop calls requestViaBot() directly; this covers any other emitters)
    eventBus.on('command_gate_triggered', async (data: any) => {
      if (!isTelegramEnabled()) return
      // humanInTheLoop will call requestViaBot() — nothing extra needed here.
      // This handler is intentionally lightweight: just log so the event is consumed.
      console.log(`[BotGate] CommandGate triggered — taskId: ${data?.taskId}, danger: ${data?.danger}`)
    })
  }

  /**
   * Send an inline-keyboard approval request to the primary Telegram chat.
   * Returns true (approved) or false (rejected/timed-out).
   */
  async requestViaBot(actionDescription: string, taskId: string): Promise<boolean> {
    // Dynamically import so we don't create a circular dependency at module load time
    const { devosBot } = await import('./devosBot').catch(async () => {
      // Fall back to the legacy telegramBot if devosBot not ready
      const m = await import('./telegramBot')
      return { devosBot: m.telegramBot }
    })

    const chatId = devosBot.getPrimaryChatId()
    if (!chatId) {
      console.warn('[BotGate] No primary chat ID — cannot send approval request')
      return false
    }

    const bot = devosBot.getBot()
    if (!bot) {
      console.warn('[BotGate] Bot not running — cannot send approval request')
      return false
    }

    const DANGER_ICONS: Record<string, string> = {
      file_delete:       '🗑️',
      production_deploy: '🚀',
      external_api:      '🌐',
    }

    const lines = [
      '⚠️ *DevOS wants to perform a dangerous action*',
      '',
      actionDescription,
      '',
      `Task ID: \`${taskId}\``,
      '',
      'Approve?',
    ]

    await bot.sendMessage(chatId, lines.join('\n'), {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Approve', callback_data: `approve_${taskId}` },
          { text: '❌ Reject',  callback_data: `reject_${taskId}`  },
        ]],
      },
    })

    return new Promise<boolean>((resolve) => {
      this.pendingApprovals.set(taskId, { resolve })

      // 60-second hard timeout → auto-reject
      setTimeout(() => {
        if (this.pendingApprovals.has(taskId)) {
          this.pendingApprovals.delete(taskId)
          console.warn(`[BotGate] ⏱️  Approval timeout for ${taskId} — auto-rejected`)
          bot.sendMessage(chatId, `⏰ Approval timed out for task \`${taskId}\` — action cancelled.`, { parse_mode: 'Markdown' }).catch(() => {})
          resolve(false)
        }
      }, APPROVAL_TIMEOUT_MS)
    })
  }

  /**
   * Handle inline keyboard callback queries forwarded from the bot.
   * Resolves the matching pending approval.
   */
  handleCallbackQuery(query: any): void {
    const data: string = query.data || ''
    const bot = this.getActiveBot()

    if (data.startsWith('approve_')) {
      const taskId  = data.slice('approve_'.length)
      const pending = this.pendingApprovals.get(taskId)
      if (pending) {
        pending.resolve(true)
        this.pendingApprovals.delete(taskId)
        bot?.editMessageText('✅ *Approved*', {
          chat_id:    query.message.chat.id,
          message_id: query.message.message_id,
          parse_mode: 'Markdown',
        }).catch(() => {})
        console.log(`[BotGate] ✅ Approved: ${taskId}`)
      }
    }

    if (data.startsWith('reject_')) {
      const taskId  = data.slice('reject_'.length)
      const pending = this.pendingApprovals.get(taskId)
      if (pending) {
        pending.resolve(false)
        this.pendingApprovals.delete(taskId)
        bot?.editMessageText('❌ *Rejected*', {
          chat_id:    query.message.chat.id,
          message_id: query.message.message_id,
          parse_mode: 'Markdown',
        }).catch(() => {})
        console.log(`[BotGate] ❌ Rejected: ${taskId}`)
      }
    }
  }

  /** How many approvals are currently waiting. */
  pendingCount(): number {
    return this.pendingApprovals.size
  }

  // ── Private ────────────────────────────────────────────

  private getActiveBot(): any {
    // Try devosBot first, fall back to legacy telegramBot
    try {
      const { devosBot }    = require('./devosBot')
      const b = devosBot?.getBot()
      if (b) return b
    } catch { /* ignore */ }
    try {
      const { telegramBot } = require('./telegramBot')
      return telegramBot?.getBot()
    } catch { /* ignore */ }
    return null
  }
}

export const botGate = new BotGate()
