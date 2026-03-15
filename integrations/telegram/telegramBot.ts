// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// integrations/telegram/telegramBot.ts — Telegram bot with streaming edit pattern

import * as fs   from 'fs'
import * as path from 'path'

function loadConfig() {
  const configPath = path.join(process.cwd(), 'config/integrations.json')
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  return config.telegram || {}
}

export class TelegramBot {
  private bot: any = null
  private config: any = {}

  async start(): Promise<void> {
    this.config = loadConfig()
    if (!this.config.enabled || !this.config.botToken) {
      console.log('[TelegramBot] Disabled — set enabled:true and botToken in config/integrations.json')
      return
    }

    const TelegramBotAPI = require('node-telegram-bot-api')
    this.bot = new TelegramBotAPI(this.config.botToken, { polling: true })
    console.log('[TelegramBot] ✅ Started — polling for messages')

    this.bot.onText(/\/start/, async (msg: any) => {
      const chatId = msg.chat.id
      if (!this.isAllowed(msg.from?.id)) {
        return this.bot.sendMessage(chatId, 'This DevOS instance is private.')
      }
      this.bot.sendMessage(chatId, 'DevOS is running. What do you need?\n\nCommands:\n/status — what\'s running\n/briefing — morning summary\n/help — all commands')
    })

    this.bot.onText(/\/status/, async (msg: any) => {
      if (!this.isAllowed(msg.from?.id)) return
      try {
        const { goalStore }    = await import('../../goals/goalStore')
        const { missionState } = await import('../../coordination/missionState')
        const active   = goalStore.listGoals('active' as any).length
        const missions = (missionState.listMissions() as any[]).filter((m: any) => m.status === 'active').length
        this.bot.sendMessage(msg.chat.id, `DevOS Status\n\nActive goals: ${active}\nActive missions: ${missions}\nAPI: http://127.0.0.1:4200`)
      } catch {
        this.bot.sendMessage(msg.chat.id, 'Status unavailable.')
      }
    })

    this.bot.onText(/\/briefing/, async (msg: any) => {
      if (!this.isAllowed(msg.from?.id)) return
      try {
        const { morningBriefing } = await import('../../personal/morningBriefing')
        const briefing = await morningBriefing.generate()
        this.bot.sendMessage(msg.chat.id, briefing)
      } catch {
        this.bot.sendMessage(msg.chat.id, 'Briefing unavailable.')
      }
    })

    this.bot.onText(/\/stop (.+)/, async (msg: any, match: any) => {
      if (!this.isAllowed(msg.from?.id)) return
      try {
        const { autonomousMission } = await import('../../coordination/autonomousMission')
        await autonomousMission.cancelMission(match[1])
        this.bot.sendMessage(msg.chat.id, `Mission ${match[1]} cancelled.`)
      } catch {
        this.bot.sendMessage(msg.chat.id, 'Could not cancel mission.')
      }
    })

    this.bot.onText(/\/help/, (msg: any) => {
      this.bot.sendMessage(msg.chat.id,
        'DevOS Commands:\n/status — what\'s running\n/briefing — morning summary\n/stop <id> — cancel mission\n/help — this list\n\nOr just send a message to chat with DevOS.')
    })

    // Handle regular messages — stream via sequential edits
    this.bot.on('message', async (msg: any) => {
      if (msg.text?.startsWith('/')) return
      if (!this.isAllowed(msg.from?.id)) return
      const chatId = msg.chat.id

      // Send initial placeholder
      const sent      = await this.bot.sendMessage(chatId, 'DevOS is thinking...')
      const messageId = sent.message_id

      try {
        const { dialogueEngine } = await import('../../personality/dialogueEngine')
        let accumulated = ''
        let lastEdit    = Date.now()

        for await (const token of dialogueEngine.chat(msg.text)) {
          accumulated += token
          // Edit every 300ms to avoid Telegram rate limits
          if (Date.now() - lastEdit > 300) {
            try {
              await this.bot.editMessageText(accumulated + '▌', { chat_id: chatId, message_id: messageId })
              lastEdit = Date.now()
            } catch { /* ignore edit-too-similar errors */ }
          }
        }

        // Final edit without cursor
        await this.bot.editMessageText(accumulated || 'Done.', { chat_id: chatId, message_id: messageId })
      } catch (e: any) {
        this.bot.editMessageText('Error: ' + (e?.message ?? String(e)), { chat_id: chatId, message_id: messageId }).catch(() => {})
      }
    })

    // Handle inline keyboard callback queries (approval buttons)
    this.bot.on('callback_query', async (query: any) => {
      const { telegramApproval } = await import('./telegramApproval')
      telegramApproval.handleCallbackQuery(query)
      this.bot.answerCallbackQuery(query.id)
    })
  }

  stop(): void {
    if (this.bot) this.bot.stopPolling()
  }

  getBot(): any {
    return this.bot
  }

  isAllowed(userId?: number): boolean {
    if (!userId) return false
    if (!this.config.allowedUserIds?.length) return true // open if no restrictions set
    return this.config.allowedUserIds.includes(userId)
  }

  getPrimaryChatId(): number | null {
    return this.config.allowedUserIds?.[0] || null
  }
}

export const telegramBot = new TelegramBot()
