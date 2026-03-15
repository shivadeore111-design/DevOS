// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// integrations/telegram/telegramNotifier.ts — Event-driven push notifications via Telegram

import * as fs   from 'fs'
import * as path from 'path'
import { eventBus }    from '../../core/eventBus'
import { telegramBot } from './telegramBot'

function loadConfig() {
  const configPath = path.join(process.cwd(), 'config/integrations.json')
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  return config.telegram || {}
}

export class TelegramNotifier {
  private config: any = {}

  start(): void {
    this.config = loadConfig()
    if (!this.config.enabled) return

    eventBus.on('goal:completed' as any, (data: any) => {
      if (!this.config.notifyOnGoalComplete) return
      this.notify(`✅ ${data.title || 'Goal'} finished.${data.result ? ' ' + String(data.result).slice(0, 80) : ''}`)
    })

    eventBus.on('goal:failed' as any, (data: any) => {
      this.notify(`❌ ${data.title || 'Goal'} failed.${data.error ? ' ' + String(data.error).slice(0, 80) : ''} Reply with goal ID to retry.`)
    })

    eventBus.on('mission:complete' as any, (data: any) => {
      if (!this.config.notifyOnMissionComplete) return
      this.notify(`🚀 Mission complete: ${data.goal || data.missionId}`)
    })

    eventBus.on('mission:limit_reached' as any, (data: any) => {
      this.notify(`⚠️ Mission hit a limit: ${data.reason || 'unknown'}. Open dashboard to review.`)
    })

    eventBus.on('pilot_completed' as any, (data: any) => {
      if (!this.config.notifyOnPilotComplete) return
      this.notify(`🔍 ${data.pilotId || 'Pilot'} completed a run.`)
    })

    eventBus.on('devos_proactive' as any, (data: any) => {
      if (data.message) this.notify(data.message)
    })

    eventBus.on('approval_required' as any, async (data: any) => {
      if (!this.config.requireApprovalForDangerous) return
      const { telegramApproval } = await import('./telegramApproval')
      telegramApproval.requestViaBot(data.actionDescription, data.taskId)
    })

    console.log('[TelegramNotifier] ✅ Listening for events')
  }

  async notify(message: string): Promise<void> {
    const chatId = telegramBot.getPrimaryChatId()
    if (!chatId) return
    const bot = telegramBot.getBot()
    if (!bot) return
    try {
      await bot.sendMessage(chatId, message)
    } catch (e: any) {
      console.error('[TelegramNotifier] Failed to send:', e?.message ?? String(e))
    }
  }
}

export const telegramNotifier = new TelegramNotifier()
