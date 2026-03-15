// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// integrations/telegram/telegramApproval.ts — Inline keyboard approval flow

import { telegramBot } from './telegramBot'

export class TelegramApproval {
  private pendingApprovals = new Map<string, { resolve: (v: boolean) => void }>()

  async requestViaBot(actionDescription: string, taskId: string): Promise<boolean> {
    const chatId = telegramBot.getPrimaryChatId()
    if (!chatId) return false

    const bot = telegramBot.getBot()
    if (!bot) return false

    await bot.sendMessage(chatId, `DevOS wants to:\n${actionDescription}\n\nApprove?`, {
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Yes', callback_data: `approve_${taskId}` },
          { text: '❌ No',  callback_data: `reject_${taskId}`  },
        ]],
      },
    })

    return new Promise<boolean>((resolve) => {
      this.pendingApprovals.set(taskId, { resolve })

      // 60 second timeout — auto-reject
      setTimeout(() => {
        if (this.pendingApprovals.has(taskId)) {
          this.pendingApprovals.delete(taskId)
          bot.sendMessage(chatId, '⏰ Approval timed out — action cancelled.').catch(() => {})
          resolve(false)
        }
      }, 60000)
    })
  }

  handleCallbackQuery(query: any): void {
    const data: string = query.data || ''
    const bot = telegramBot.getBot()

    if (data.startsWith('approve_')) {
      const taskId = data.replace('approve_', '')
      const pending = this.pendingApprovals.get(taskId)
      if (pending) {
        pending.resolve(true)
        this.pendingApprovals.delete(taskId)
        bot?.editMessageText('✅ Approved', {
          chat_id:    query.message.chat.id,
          message_id: query.message.message_id,
        }).catch(() => {})
      }
    }

    if (data.startsWith('reject_')) {
      const taskId = data.replace('reject_', '')
      const pending = this.pendingApprovals.get(taskId)
      if (pending) {
        pending.resolve(false)
        this.pendingApprovals.delete(taskId)
        bot?.editMessageText('❌ Rejected', {
          chat_id:    query.message.chat.id,
          message_id: query.message.message_id,
        }).catch(() => {})
      }
    }
  }
}

export const telegramApproval = new TelegramApproval()
