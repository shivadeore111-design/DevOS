// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// integrations/slack/slackBot.ts — Interactive Slack bot via @slack/bolt (Socket Mode)
// Handles DMs and mentions: status, goals, help, goal execution, chat fallback.
// Posts goal_completed / goal_failed notifications to a configured channel.

import { App }              from '@slack/bolt'
import { goalEngine }       from '../../goals/goalEngine'
import { dialogueEngine }   from '../../personality/dialogueEngine'
import { persistentMemory } from '../../memory/persistentMemory'
import { eventBus }         from '../../core/eventBus'
import * as fs              from 'fs'
import * as path            from 'path'

const CONFIG_PATH    = path.join(process.cwd(), 'config', 'slack-config.json')
const BUILD_KEYWORDS = ['build', 'create', 'make', 'generate', 'write', 'deploy', 'fix', 'run']

class SlackBot {
  private app:           App | null = null
  private notifyChannel: string | null = null
  private isConnected    = false

  async start(botToken: string, signingSecret: string, notifyChannel?: string): Promise<void> {
    this.notifyChannel = notifyChannel || null

    this.app = new App({
      token:         botToken,
      signingSecret,
      socketMode:    true,
      appToken:      process.env.SLACK_APP_TOKEN || '',
    })

    // ── Incoming messages ─────────────────────────────────────
    this.app.message(async ({ message, say }: any) => {
      if (message.subtype) return          // ignore edits, joins, etc.
      const text = message.text?.trim()
      if (!text) return
      const lower = text.toLowerCase()
      console.log(`[Slack] ← ${message.user}: ${text}`)

      try {
        if (['status', 'ping', 's'].includes(lower)) {
          const stats = await persistentMemory.getStats()
          await say(`⚡ DevOS online\n📊 ${stats.totalGoals} goals | ${stats.totalFacts} facts in memory`)
          return
        }

        if (['help', 'h'].includes(lower)) {
          await say(
            `*DevOS commands:*\n` +
            `\`status\` — system info\n` +
            `\`goals\` — recent history\n` +
            `\`help\` — this message\n\n` +
            `Or send any goal:\n_"build a todo API"_\n_"create file on desktop"_`
          )
          return
        }

        if (['goals', 'g'].includes(lower)) {
          const goals = await persistentMemory.getRecentGoals(5)
          const list  = goals.length
            ? goals.map((g: any) => `${g.status === 'completed' ? '✅' : '❌'} ${g.title}`).join('\n')
            : 'No goals yet.'
          await say(list)
          return
        }

        if (['hi', 'hello', 'hey'].includes(lower)) {
          const name = await persistentMemory.getFact('user', 'name') || 'there'
          await say(`Hey ${name}! DevOS here. What do you want to build?`)
          return
        }

        if (BUILD_KEYWORDS.some(k => lower.includes(k))) {
          await say(`⚡ Starting: _"${text.slice(0, 60)}"_\nI'll update you when done.`)
          goalEngine.run(text.slice(0, 60), text).catch(() => {})
          return
        }

        // Chat fallback
        await say('⏳ Thinking...')
        const chunks: string[] = []
        for await (const chunk of dialogueEngine.chat(text)) chunks.push(chunk)
        await say(chunks.join('').trim().slice(0, 3000) || "I'm here.")

      } catch (err: any) {
        console.error('[Slack] Error:', err?.message)
      }
    })

    // ── Goal notifications ────────────────────────────────────
    eventBus.on('goal_completed', async (data: any) => {
      if (this.notifyChannel && this.app) {
        await this.app.client.chat.postMessage({
          channel: this.notifyChannel,
          text:    `✅ Done: ${data.title || data.goalId}`,
        }).catch((e: any) => console.warn('[Slack] Notify failed:', e?.message))
      }
    })

    eventBus.on('goal_failed', async (data: any) => {
      if (this.notifyChannel && this.app) {
        await this.app.client.chat.postMessage({
          channel: this.notifyChannel,
          text:    `❌ Failed: ${data.title || data.goalId}`,
        }).catch((e: any) => console.warn('[Slack] Notify failed:', e?.message))
      }
    })

    await this.app.start()
    this.isConnected = true
    console.log('[Slack] ✅ Connected!')
  }

  getStatus(): { connected: boolean } {
    return { connected: this.isConnected }
  }
}

export const slackBot = new SlackBot()
