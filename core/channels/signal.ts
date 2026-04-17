// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/channels/signal.ts — Signal channel adapter.
//
// Uses signal-cli-rest-api — a standalone REST wrapper around the
// official signal-cli Java tool. Users run it separately:
//   https://github.com/bbernhard/signal-cli-rest-api
//
// Setup (one-time, outside Aiden):
//   docker run -p 8080:8080 -v ~/.local/share/signal-cli:/home/.local/share/signal-cli \
//     bbernhard/signal-cli-rest-api
//   # then register your number at http://localhost:8080/v1/register/<number>
//
// Config (env vars):
//   SIGNAL_CLI_URL          — REST API base URL (default: http://localhost:8080)
//   SIGNAL_PHONE_NUMBER     — your registered Signal number (+15551234567)
//   SIGNAL_ALLOWED_NUMBERS  — optional comma-separated allowlist

import axios from 'axios'
import { gateway } from '../gateway'
import type { ChannelAdapter } from './adapter'

export class SignalAdapter implements ChannelAdapter {
  readonly name = 'signal'

  private healthy          = false
  private baseUrl:  string
  private myNumber: string
  private allowedNumbers: Set<string>
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private lastReceived = 0

  constructor() {
    this.baseUrl    = (process.env.SIGNAL_CLI_URL ?? 'http://localhost:8080').replace(/\/$/, '')
    this.myNumber   = process.env.SIGNAL_PHONE_NUMBER ?? ''
    const raw       = process.env.SIGNAL_ALLOWED_NUMBERS ?? ''
    this.allowedNumbers = raw ? new Set(raw.split(',').map(s => s.trim()).filter(Boolean)) : new Set()
  }

  // ── Lifecycle ──────────────────────────────────────────────

  async start(): Promise<void> {
    if (!this.myNumber) {
      console.log('[Signal] Disabled — set SIGNAL_PHONE_NUMBER to enable')
      return
    }

    // Verify signal-cli is reachable
    const reachable = await this.checkHealth()
    if (!reachable) {
      console.log(`[Signal] Disabled — signal-cli-rest-api not reachable at ${this.baseUrl}`)
      return
    }

    this.healthy = true
    this.lastReceived = Date.now()
    console.log(`[Signal] Connected — polling ${this.baseUrl}`)

    // Register outbound delivery
    gateway.registerChannel('signal', async (msg) => {
      await this.send(msg.channelId, msg.text)
      return true
    })

    // Poll for new messages every 2 seconds
    this.pollTimer = setInterval(() => this.poll(), 2000)
  }

  async stop(): Promise<void> {
    this.healthy = false
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    gateway.unregisterChannel('signal')
    console.log('[Signal] Disconnected')
  }

  async send(target: string, message: string): Promise<void> {
    if (!this.healthy) return
    try {
      await axios.post(
        `${this.baseUrl}/v2/send`,
        { message, number: this.myNumber, recipients: [target] },
        { timeout: 10000 },
      )
    } catch (e: any) {
      console.error('[Signal] send error:', e.message)
    }
  }

  isHealthy(): boolean { return this.healthy }

  // ── Helpers ────────────────────────────────────────────────

  private async checkHealth(): Promise<boolean> {
    try {
      await axios.get(`${this.baseUrl}/v1/health`, { timeout: 3000 })
      return true
    } catch {
      return false
    }
  }

  private async poll(): Promise<void> {
    if (!this.healthy) return
    try {
      const res = await axios.get<any[]>(
        `${this.baseUrl}/v1/receive/${encodeURIComponent(this.myNumber)}`,
        { timeout: 5000 },
      )
      const messages: any[] = Array.isArray(res.data) ? res.data : []

      for (const item of messages) {
        const envelope = item.envelope
        if (!envelope) continue
        const dm = envelope.dataMessage
        if (!dm?.message) continue

        const sender = envelope.source ?? envelope.sourceNumber ?? ''
        if (!this.isAllowed(sender)) continue

        const response = await this.processMessage(sender, sender, dm.message)
        await this.send(sender, response)
      }
    } catch (e: any) {
      // Don't spam logs on transient poll errors
      if (this.healthy) {
        console.error('[Signal] poll error:', e.message)
      }
    }
  }

  private isAllowed(number: string): boolean {
    if (this.allowedNumbers.size === 0) return true
    return this.allowedNumbers.has(number)
  }

  private async processMessage(channelId: string, userId: string, text: string): Promise<string> {
    try {
      return await gateway.routeMessage({
        channel:   'signal',
        channelId,
        userId,
        text,
        timestamp: Date.now(),
      })
    } catch (e: any) {
      console.error('[Signal] routeMessage error:', e.message)
      return '❌ Something went wrong. Try again.'
    }
  }
}
