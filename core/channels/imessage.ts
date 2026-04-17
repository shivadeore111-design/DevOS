// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/channels/imessage.ts — iMessage channel adapter via BlueBubbles.
//
// BlueBubbles is a Mac app that exposes iMessage via REST + WebSocket.
// A Mac running the BlueBubbles server is REQUIRED — iMessage is an
// Apple-exclusive service.
//
// Setup (one-time, on a Mac):
//   1. Install BlueBubbles from https://bluebubbles.app
//   2. Open BlueBubbles, set a server password, note the URL/port
//   3. Set BLUEBUBBLES_URL and BLUEBUBBLES_PASSWORD in Aiden's .env
//
// Config (env vars):
//   BLUEBUBBLES_URL              — e.g. http://192.168.1.5:1234
//   BLUEBUBBLES_PASSWORD         — set in BlueBubbles server settings
//   BLUEBUBBLES_ALLOWED_NUMBERS  — optional comma-separated allowlist

import axios from 'axios'
import { WebSocket } from 'ws'
import { gateway } from '../gateway'
import type { ChannelAdapter } from './adapter'

export class IMessageAdapter implements ChannelAdapter {
  readonly name = 'imessage'

  private healthy          = false
  private baseUrl:  string
  private password: string
  private allowedNumbers: Set<string>
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    this.baseUrl  = (process.env.BLUEBUBBLES_URL ?? '').replace(/\/$/, '')
    this.password = process.env.BLUEBUBBLES_PASSWORD ?? ''
    const raw     = process.env.BLUEBUBBLES_ALLOWED_NUMBERS ?? ''
    this.allowedNumbers = raw ? new Set(raw.split(',').map(s => s.trim()).filter(Boolean)) : new Set()
  }

  // ── Lifecycle ──────────────────────────────────────────────

  async start(): Promise<void> {
    if (!this.baseUrl || !this.password) {
      console.log('[iMessage] Disabled — set BLUEBUBBLES_URL and BLUEBUBBLES_PASSWORD to enable')
      return
    }

    // Verify BlueBubbles is reachable
    const reachable = await this.checkHealth()
    if (!reachable) {
      console.log(`[iMessage] Disabled — BlueBubbles server not reachable at ${this.baseUrl}`)
      return
    }

    this.healthy = true
    console.log(`[iMessage] Connected to BlueBubbles at ${this.baseUrl}`)

    // Register outbound delivery
    gateway.registerChannel('imessage', async (msg) => {
      await this.send(msg.channelId, msg.text)
      return true
    })

    // Connect WebSocket for real-time inbound messages
    this.connectWebSocket()
  }

  async stop(): Promise<void> {
    this.healthy = false
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    gateway.unregisterChannel('imessage')
    console.log('[iMessage] Disconnected')
  }

  async send(target: string, message: string): Promise<void> {
    if (!this.healthy) return
    try {
      await axios.post(
        `${this.baseUrl}/api/v1/message/text`,
        { chatGuid: target, message, tempGuid: `aiden-${Date.now()}` },
        {
          params:  { password: this.password },
          timeout: 10000,
        },
      )
    } catch (e: any) {
      console.error('[iMessage] send error:', e.message)
    }
  }

  isHealthy(): boolean { return this.healthy }

  // ── Helpers ────────────────────────────────────────────────

  private async checkHealth(): Promise<boolean> {
    try {
      await axios.get(`${this.baseUrl}/api/v1/ping`, {
        params:  { password: this.password },
        timeout: 3000,
      })
      return true
    } catch {
      return false
    }
  }

  private connectWebSocket(): void {
    if (!this.healthy) return

    const wsUrl = this.baseUrl.replace(/^http/, 'ws')
    this.ws     = new WebSocket(`${wsUrl}?password=${encodeURIComponent(this.password)}`)

    this.ws.on('open', () => {
      console.log('[iMessage] WebSocket connected')
    })

    this.ws.on('message', async (raw: Buffer) => {
      try {
        const event = JSON.parse(raw.toString())
        if (event.type !== 'new-message') return

        const msg = event.data
        // Only handle inbound (not self-sent) chat messages
        if (!msg || msg.isFromMe) return
        if (msg.attributedBody === null && !msg.text) return

        const text   = msg.text ?? ''
        const chatId = msg.chats?.[0]?.guid ?? ''
        const sender = msg.handle?.address ?? ''

        if (!this.isAllowed(sender)) return

        const response = await this.processMessage(chatId || sender, sender, text)
        await this.send(chatId || sender, response)
      } catch (e: any) {
        console.error('[iMessage] message parse error:', e.message)
      }
    })

    this.ws.on('error', (e) => {
      console.error('[iMessage] WebSocket error:', e.message)
    })

    this.ws.on('close', () => {
      if (this.healthy) {
        // Reconnect after 5 seconds
        this.reconnectTimer = setTimeout(() => this.connectWebSocket(), 5000)
      }
    })
  }

  private isAllowed(number: string): boolean {
    if (this.allowedNumbers.size === 0) return true
    return this.allowedNumbers.has(number)
  }

  private async processMessage(channelId: string, userId: string, text: string): Promise<string> {
    try {
      return await gateway.routeMessage({
        channel:   'imessage',
        channelId,
        userId,
        text,
        timestamp: Date.now(),
      })
    } catch (e: any) {
      console.error('[iMessage] routeMessage error:', e.message)
      return '❌ Something went wrong. Try again.'
    }
  }
}
