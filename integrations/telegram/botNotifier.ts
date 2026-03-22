// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// integrations/telegram/botNotifier.ts — Event-driven push notifications v2
//
// Subscribes to all relevant eventBus events and forwards them to Telegram:
//   goal_completed        → ✅ Done: <title>
//   goal_failed           → ❌ Failed: <title> — <reason>
//   pilot_completed       → 🔍 <pilot>: <one-line finding>
//   agent_pulse (done/ceo)→ mission completions forwarded
//   mission_limit_reached → ⚠️ Mission hit limit. Check dashboard.
//   approval_required     → routes to botGate for inline keyboard

import * as fs   from 'fs'
import * as path from 'path'
import { eventBus }  from '../../core/eventBus'

function loadConfig(): any {
  try {
    const configPath = path.join(process.cwd(), 'config/integrations.json')
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    return config.telegram || {}
  } catch {
    return {}
  }
}

export class BotNotifier {
  private config: any      = {}
  private _started         = false
  /** Tracks last forwarded agent_pulse missionId to avoid duplicates */
  private lastPulseMission = new Set<string>()

  // ── Start ─────────────────────────────────────────────────

  start(): void {
    if (this._started) return
    this.config = loadConfig()
    if (!this.config.enabled) {
      console.log('[BotNotifier] Telegram disabled — skipping')
      return
    }

    this._started = true

    // ── goal_completed ─────────────────────────────────────
    eventBus.on('goal_completed', (data: any) => {
      if (!this.config.notifyOnGoalComplete) return
      const title  = data?.title  ?? data?.goalId ?? 'Goal'
      const result = data?.result ? `\n${String(data.result).slice(0, 120)}` : ''
      this.notify(`✅ Done: ${title}${result}`)
    })

    // ── goal_failed ────────────────────────────────────────
    eventBus.on('goal_failed', (data: any) => {
      const title  = data?.title ?? data?.goalId ?? 'Goal'
      const reason = data?.error ?? data?.reason ?? 'unknown reason'
      this.notify(`❌ Failed: ${title} — ${String(reason).slice(0, 100)}`)
    })

    // ── pilot_completed ────────────────────────────────────
    // Expected shape: { pilotId, finding?, summary?, result? }
    eventBus.on('pilot_completed', (data: any) => {
      if (!this.config.notifyOnPilotComplete) return
      const pilot   = data?.pilotId ?? data?.name ?? 'Pilot'
      const finding = data?.finding ?? data?.summary ?? data?.result ?? 'run completed'
      // One-line finding: strip newlines, truncate
      const oneLine = String(finding).replace(/\n+/g, ' ').slice(0, 140)
      this.notify(`🔍 ${pilot}: ${oneLine}`)
    })

    // ── agent_pulse: type=done, agent=ceo → mission completion ──
    eventBus.on('agent_pulse', (data: any) => {
      if (data?.type !== 'done') return
      if (data?.agent !== 'ceo') return
      // Only forward once per mission
      const missionId = data?.missionId
      if (missionId && this.lastPulseMission.has(missionId)) return
      if (missionId) {
        this.lastPulseMission.add(missionId)
        // Cap the set size to avoid memory leaks
        if (this.lastPulseMission.size > 200) {
          const first = this.lastPulseMission.values().next().value as string
          this.lastPulseMission.delete(first)
        }
      }
      const msg = data?.message ?? 'Mission complete'
      this.notify(`🏁 Mission done: ${String(msg).slice(0, 120)}`)
    })

    // ── mission_limit_reached ──────────────────────────────
    // Both 'mission_limit_reached' and 'mission:limit_reached' are emitted
    const onMissionLimit = (data: any) => {
      const reason = data?.reason ?? data?.missionId ?? 'check dashboard'
      this.notify(`⚠️ Mission hit limit. Check dashboard.\n${String(reason).slice(0, 100)}`)
    }
    eventBus.on('mission_limit_reached',  onMissionLimit)
    eventBus.on('mission:limit_reached',  onMissionLimit)

    // ── mission:complete ───────────────────────────────────
    eventBus.on('mission:complete', (data: any) => {
      if (!this.config.notifyOnMissionComplete) return
      const goal = data?.goal ?? data?.missionId ?? 'mission'
      this.notify(`🚀 Mission complete: ${String(goal).slice(0, 120)}`)
    })

    // ── approval_required → botGate ───────────────────────
    eventBus.on('approval_required', async (data: any) => {
      if (!this.config.requireApprovalForDangerous) return
      try {
        const { botGate } = await import('./botGate')
        botGate.requestViaBot(data.actionDescription, data.taskId)
      } catch { /* botGate unavailable — fall through */ }
    })

    // ── devos_proactive (existing compat) ─────────────────
    eventBus.on('devos_proactive', (data: any) => {
      if (data?.message) this.notify(data.message)
    })

    console.log('[BotNotifier] ✅ Listening for events')
  }

  // ── notify ────────────────────────────────────────────────

  async notify(message: string): Promise<void> {
    const bot    = this.getActiveBot()
    const chatId = this.getPrimaryChatId()
    if (!bot || !chatId) return
    try {
      await bot.sendMessage(chatId, message)
    } catch (e: any) {
      console.error('[BotNotifier] Send failed:', e?.message ?? String(e))
    }
  }

  // ── Helpers ───────────────────────────────────────────────

  private getActiveBot(): any {
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

  private getPrimaryChatId(): number | null {
    try {
      const { devosBot }    = require('./devosBot')
      const id = devosBot?.getPrimaryChatId()
      if (id) return id
    } catch { /* ignore */ }
    try {
      const { telegramBot } = require('./telegramBot')
      return telegramBot?.getPrimaryChatId() ?? null
    } catch { /* ignore */ }
    return null
  }
}

export const botNotifier = new BotNotifier()
