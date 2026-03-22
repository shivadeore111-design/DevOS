// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// integrations/telegram/devosBot.ts — Telegram bot v2
//
// Routes all free-text messages through devOSMind.chat() instead of
// the old dialogueEngine, and adds Sprint 18.5 commands:
//   /dawn             — today's dawn report
//   /echo <name>      — replay a recorded echo workflow
//   /mission <goal>   — start an autonomous mission
//   /missions         — list active missions

import * as fs   from 'fs'
import * as path from 'path'

const STREAM_INTERVAL_MS = 300   // edit throttle to avoid Telegram rate limits

function loadConfig() {
  const configPath = path.join(process.cwd(), 'config/integrations.json')
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    return config.telegram || {}
  } catch {
    return {}
  }
}

export class DevosBot {
  private bot: any     = null
  private config: any  = {}

  // ── Startup ───────────────────────────────────────────────

  async start(): Promise<void> {
    this.config = loadConfig()
    if (!this.config.enabled || !this.config.botToken) {
      console.log('[DevosBot] Disabled — set enabled:true and botToken in config/integrations.json')
      return
    }

    const TelegramBotAPI = require('node-telegram-bot-api')
    this.bot = new TelegramBotAPI(this.config.botToken, { polling: true })
    console.log('[DevosBot] ✅ Started — polling for messages')

    this.registerCommands()
    this.registerMessageHandler()
    this.registerCallbackHandler()
  }

  stop(): void {
    if (this.bot) this.bot.stopPolling()
  }

  getBot(): any   { return this.bot }

  isAllowed(userId?: number): boolean {
    if (!userId) return false
    if (!this.config.allowedUserIds?.length) return true
    return this.config.allowedUserIds.includes(userId)
  }

  getPrimaryChatId(): number | null {
    return this.config.allowedUserIds?.[0] ?? null
  }

  // ── Command registration ──────────────────────────────────

  private registerCommands(): void {
    const bot = this.bot

    // /start
    bot.onText(/\/start/, async (msg: any) => {
      if (!this.isAllowed(msg.from?.id)) return bot.sendMessage(msg.chat.id, 'This DevOS instance is private.')
      bot.sendMessage(msg.chat.id,
        'DevOS is running.\n\n' +
        'Commands:\n' +
        '/status       — what\'s running\n' +
        '/missions     — active missions\n' +
        '/mission <goal> — start a mission\n' +
        '/dawn         — today\'s briefing\n' +
        '/echo <name>  — replay a workflow\n' +
        '/briefing     — morning briefing\n' +
        '/stop <id>    — cancel mission\n' +
        '/help         — this list\n\n' +
        'Or just send a message to chat with DevOS.'
      )
    })

    // /status
    bot.onText(/\/status/, async (msg: any) => {
      if (!this.isAllowed(msg.from?.id)) return
      try {
        const { goalStore }    = await import('../../goals/goalStore')
        const { missionState } = await import('../../coordination/missionState')
        const active   = goalStore.listGoals('active' as any).length
        const missions = (missionState.listMissions() as any[]).filter((m: any) => m.status === 'active').length
        bot.sendMessage(msg.chat.id,
          `DevOS Status\n\n` +
          `Active goals:    ${active}\n` +
          `Active missions: ${missions}\n` +
          `API:             http://127.0.0.1:4200`
        )
      } catch {
        bot.sendMessage(msg.chat.id, 'Status unavailable.')
      }
    })

    // /missions — list active missions
    bot.onText(/^\/missions$/, async (msg: any) => {
      if (!this.isAllowed(msg.from?.id)) return
      try {
        const { missionState } = await import('../../coordination/missionState')
        const active = (missionState.listMissions() as any[]).filter((m: any) => m.status === 'active')
        if (active.length === 0) {
          return bot.sendMessage(msg.chat.id, 'No active missions.')
        }
        const lines = active.map((m: any) =>
          `🚀 ${m.goal?.slice(0, 60) ?? m.missionId}\n   ID: ${m.missionId}  Status: ${m.status}`
        )
        bot.sendMessage(msg.chat.id, `Active missions (${active.length}):\n\n` + lines.join('\n\n'))
      } catch {
        bot.sendMessage(msg.chat.id, 'Could not list missions.')
      }
    })

    // /mission <goal> — start a new autonomous mission
    bot.onText(/^\/mission (.+)$/, async (msg: any, match: any) => {
      if (!this.isAllowed(msg.from?.id)) return
      const goal = match[1]?.trim()
      if (!goal) return bot.sendMessage(msg.chat.id, 'Usage: /mission <your goal>')
      const sent = await bot.sendMessage(msg.chat.id, `🚀 Starting mission: "${goal}"…`)
      try {
        const { autonomousMission } = await import('../../coordination/autonomousMission')
        const mission = await autonomousMission.startMission(goal, goal)
        bot.editMessageText(
          `🚀 Mission started\n\nGoal: ${goal}\nID:   ${mission.id ?? '—'}\n\nTrack it on the dashboard.`,
          { chat_id: msg.chat.id, message_id: sent.message_id }
        ).catch(() => bot.sendMessage(msg.chat.id, `✅ Mission created: ${goal}`))
      } catch (e: any) {
        bot.editMessageText(`❌ Failed to start mission: ${e?.message ?? String(e)}`,
          { chat_id: msg.chat.id, message_id: sent.message_id }
        ).catch(() => {})
      }
    })

    // /dawn — today's dawn report
    bot.onText(/^\/dawn$/, async (msg: any) => {
      if (!this.isAllowed(msg.from?.id)) return
      const sent = await bot.sendMessage(msg.chat.id, '🌅 Generating your dawn report…')
      try {
        const { dawnReport } = await import('../../personal/dawnReport')
        const text = await dawnReport.generate()
        // Telegram has 4096 char message limit
        const chunks = splitMessage(text, 4000)
        await bot.editMessageText(chunks[0], { chat_id: msg.chat.id, message_id: sent.message_id }).catch(() => {})
        for (let i = 1; i < chunks.length; i++) {
          await bot.sendMessage(msg.chat.id, chunks[i])
        }
      } catch (e: any) {
        bot.editMessageText(`❌ Dawn report failed: ${e?.message ?? String(e)}`,
          { chat_id: msg.chat.id, message_id: sent.message_id }
        ).catch(() => {})
      }
    })

    // /echo <name> — replay a recorded workflow
    bot.onText(/^\/echo (.+)$/, async (msg: any, match: any) => {
      if (!this.isAllowed(msg.from?.id)) return
      const name = match[1]?.trim()
      if (!name) return bot.sendMessage(msg.chat.id, 'Usage: /echo <workflow-name>')
      const sent = await bot.sendMessage(msg.chat.id, `🔄 Replaying workflow: "${name}"…`)
      try {
        const { echoMode } = await import('../../personal/echoMode')
        await echoMode.runWorkflow(name)
        bot.editMessageText(`✅ Workflow "${name}" completed.`,
          { chat_id: msg.chat.id, message_id: sent.message_id }
        ).catch(() => {})
      } catch (e: any) {
        bot.editMessageText(`❌ Workflow "${name}" failed: ${e?.message ?? String(e)}`,
          { chat_id: msg.chat.id, message_id: sent.message_id }
        ).catch(() => {})
      }
    })

    // /briefing — legacy morning briefing
    bot.onText(/^\/briefing$/, async (msg: any) => {
      if (!this.isAllowed(msg.from?.id)) return
      try {
        const { morningBriefing } = await import('../../personal/morningBriefing')
        const text = await morningBriefing.generate()
        const chunks = splitMessage(text, 4000)
        for (const chunk of chunks) bot.sendMessage(msg.chat.id, chunk)
      } catch {
        bot.sendMessage(msg.chat.id, 'Briefing unavailable.')
      }
    })

    // /stop <id> — cancel mission
    bot.onText(/^\/stop (.+)$/, async (msg: any, match: any) => {
      if (!this.isAllowed(msg.from?.id)) return
      try {
        const { autonomousMission } = await import('../../coordination/autonomousMission')
        await autonomousMission.cancelMission(match[1])
        bot.sendMessage(msg.chat.id, `✅ Mission ${match[1]} cancelled.`)
      } catch {
        bot.sendMessage(msg.chat.id, 'Could not cancel mission.')
      }
    })

    // /help
    bot.onText(/^\/help$/, (msg: any) => {
      bot.sendMessage(msg.chat.id,
        'DevOS Commands:\n\n' +
        '/status          — what\'s running\n' +
        '/missions        — list active missions\n' +
        '/mission <goal>  — start autonomous mission\n' +
        '/dawn            — today\'s dawn report\n' +
        '/echo <name>     — replay a workflow\n' +
        '/briefing        — morning briefing\n' +
        '/stop <id>       — cancel mission\n' +
        '/help            — this list\n\n' +
        'Or just type anything to chat with DevOS.'
      )
    })
  }

  // ── Free-text → DevOSMind.chat() with streaming edits ────

  private registerMessageHandler(): void {
    const bot = this.bot

    bot.on('message', async (msg: any) => {
      if (msg.text?.startsWith('/')) return
      if (!this.isAllowed(msg.from?.id)) return

      const chatId = msg.chat.id

      // Send initial placeholder
      const sent      = await bot.sendMessage(chatId, '▌')
      const messageId = sent.message_id

      try {
        const { devOSMind } = await import('../../personality/devOSMind')

        let accumulated = ''
        let lastEdit    = Date.now()
        let lastSent    = ''   // avoid edits with identical text (Telegram 400)

        for await (const token of devOSMind.chat(msg.text)) {
          accumulated += token
          if (Date.now() - lastEdit >= STREAM_INTERVAL_MS) {
            const preview = accumulated + '▌'
            if (preview !== lastSent) {
              try {
                await bot.editMessageText(preview, { chat_id: chatId, message_id: messageId })
                lastSent = preview
              } catch { /* ignore rate-limit / no-change errors */ }
            }
            lastEdit = Date.now()
          }
        }

        // Final edit — no cursor
        const final = accumulated.trim() || '…'
        if (final !== lastSent) {
          await bot.editMessageText(final, { chat_id: chatId, message_id: messageId }).catch(() => {})
        }

      } catch (e: any) {
        bot.editMessageText(
          `Error: ${e?.message ?? String(e)}`,
          { chat_id: chatId, message_id: messageId }
        ).catch(() => {})
      }
    })
  }

  // ── Inline keyboard callback → botGate ───────────────────

  private registerCallbackHandler(): void {
    this.bot.on('callback_query', async (query: any) => {
      try {
        const { botGate } = await import('./botGate')
        botGate.handleCallbackQuery(query)
      } catch {
        // fallback to legacy telegramApproval if botGate not yet loaded
        try {
          const { telegramApproval } = await import('./telegramApproval')
          telegramApproval.handleCallbackQuery(query)
        } catch { /* ignore */ }
      }
      this.bot.answerCallbackQuery(query.id).catch(() => {})
    })
  }
}

// ── Helpers ───────────────────────────────────────────────

/** Split long text into Telegram-safe chunks */
function splitMessage(text: string, maxLen: number): string[] {
  const chunks: string[] = []
  let pos = 0
  while (pos < text.length) {
    chunks.push(text.slice(pos, pos + maxLen))
    pos += maxLen
  }
  return chunks.length > 0 ? chunks : ['']
}

export const devosBot = new DevosBot()
