// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/channels/slack.ts — Slack channel adapter.
//
// Config (env vars):
//   SLACK_BOT_TOKEN         — required (xoxb-…); adapter stays disabled if absent
//   SLACK_SIGNING_SECRET    — required; used for request signature verification
//   SLACK_APP_TOKEN         — optional (xapp-…); enables Socket Mode (preferred for local dev)
//   SLACK_ALLOWED_CHANNELS  — optional comma-separated channel IDs
//
// Modes:
//   Socket mode  — if SLACK_APP_TOKEN set; no public URL required (ideal for local dev)
//   HTTP mode    — if no SLACK_APP_TOKEN; listens on port 3001
//
// Features:
//   - Responds to direct messages and app_mention events
//   - /aiden slash command
//   - Thread replies (replies in same thread as trigger)
//   - Allowlist enforcement
//   - Ignores bot messages
//   - Signature verification via SLACK_SIGNING_SECRET
//   - Graceful degradation: missing creds → disabled, no crash

import { App, LogLevel } from '@slack/bolt'
import { gateway } from '../gateway'
import type { ChannelAdapter } from './adapter'

export class SlackAdapter implements ChannelAdapter {
  readonly name = 'slack'

  private app:             App | null = null
  private botToken:        string
  private signingSecret:   string
  private appToken:        string
  private allowedChannels: Set<string>
  private healthy          = false

  constructor() {
    this.botToken        = process.env.SLACK_BOT_TOKEN          ?? ''
    this.signingSecret   = process.env.SLACK_SIGNING_SECRET     ?? ''
    this.appToken        = process.env.SLACK_APP_TOKEN          ?? ''
    const rawChannels    = process.env.SLACK_ALLOWED_CHANNELS   ?? ''
    this.allowedChannels = rawChannels
      ? new Set(rawChannels.split(',').map(s => s.trim()).filter(Boolean))
      : new Set()
  }

  // ── Lifecycle ──────────────────────────────────────────────

  async start(): Promise<void> {
    if (!this.botToken || !this.signingSecret) {
      console.log('[Slack] Disabled — set SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET to enable')
      return
    }

    const useSocketMode = !!this.appToken

    this.app = new App({
      token:         this.botToken,
      signingSecret: this.signingSecret,
      ...(useSocketMode
        ? { socketMode: true, appToken: this.appToken }
        : {}),
      logLevel: LogLevel.WARN,
    })

    // ── Direct messages ─────────────────────────────────────
    this.app.message(async ({ message, say }) => {
      const msg = message as any
      if (msg.bot_id || msg.subtype) return                          // ignore bots & system messages
      if (this.allowedChannels.size > 0 && !this.allowedChannels.has(msg.channel)) return

      const response = await this.processMessage(msg.channel, msg.user ?? 'unknown', msg.text ?? '')
      await say({ text: response, thread_ts: msg.ts }).catch((e: Error) =>
        console.error('[Slack] say error:', e.message),
      )
    })

    // ── App mentions (@Aiden) ────────────────────────────────
    this.app.event('app_mention', async ({ event, say }) => {
      if (this.allowedChannels.size > 0 && !this.allowedChannels.has(event.channel)) return

      // Strip the @mention prefix from the message
      const text = (event.text ?? '').replace(/<@[^>]+>/g, '').trim()
      const response = await this.processMessage(event.channel, event.user, text)
      await say({ text: response, thread_ts: event.ts }).catch((e: Error) =>
        console.error('[Slack] mention reply error:', e.message),
      )
    })

    // ── Slash command /aiden ─────────────────────────────────
    this.app.command('/aiden', async ({ command, ack, say }) => {
      await ack()
      if (this.allowedChannels.size > 0 && !this.allowedChannels.has(command.channel_id)) {
        await say('⚠️ This channel is not authorized for Aiden.')
        return
      }
      const response = await this.processMessage(command.channel_id, command.user_id, command.text)
      await say(response).catch((e: Error) =>
        console.error('[Slack] slash reply error:', e.message),
      )
    })

    // Register outbound delivery so gateway.deliver() and broadcast() work
    gateway.registerChannel('slack', async (msg) => {
      try {
        await this.app!.client.chat.postMessage({ channel: msg.channelId, text: msg.text })
        return true
      } catch (e: any) {
        console.error('[Slack] Delivery error:', e.message)
        return false
      }
    })

    const port = useSocketMode ? undefined : 3001
    try {
      await this.app.start(port)
      this.healthy = true
      console.log(`[Slack] Connected (${useSocketMode ? 'socket mode' : `HTTP mode port ${port}`})`)
    } catch (e: any) {
      console.error('[Slack] Start failed:', e.message)
      this.healthy = false
    }
  }

  async stop(): Promise<void> {
    this.healthy = false
    if (this.app) {
      gateway.unregisterChannel('slack')
      await this.app.stop().catch(() => {})
      this.app = null
    }
    console.log('[Slack] Disconnected')
  }

  async send(channelId: string, message: string): Promise<void> {
    await this.app?.client.chat.postMessage({ channel: channelId, text: message }).catch((e: Error) =>
      console.error('[Slack] send error:', e.message),
    )
  }

  isHealthy(): boolean { return this.healthy }

  // ── Helpers ────────────────────────────────────────────────

  private async processMessage(channelId: string, userId: string, text: string): Promise<string> {
    try {
      return await gateway.routeMessage({
        channel:   'slack',
        channelId,
        userId,
        text,
        timestamp: Date.now(),
      })
    } catch (e: any) {
      console.error('[Slack] routeMessage error:', e.message)
      return '❌ Something went wrong. Try again.'
    }
  }
}
