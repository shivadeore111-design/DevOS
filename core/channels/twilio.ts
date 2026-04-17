// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/channels/twilio.ts — SMS channel adapter via Twilio.
//
// Inbound SMS requires a publicly reachable webhook URL pointing to
//   POST /api/channels/sms/inbound
// Use ngrok or similar for local dev: ngrok http 4200
// Then set WEBHOOK_URL=https://<your-ngrok-id>.ngrok.io
//
// Config (env vars):
//   TWILIO_ACCOUNT_SID    — required
//   TWILIO_AUTH_TOKEN     — required
//   TWILIO_PHONE_NUMBER   — your Twilio-owned number (+15551234567)
//   TWILIO_ALLOWED_NUMBERS — optional comma-separated inbound allowlist
//   WEBHOOK_URL           — base URL for inbound webhook registration

import { gateway } from '../gateway'
import type { ChannelAdapter } from './adapter'
import type { Application } from 'express'

// SMS max segment length per GSM spec
const SMS_CHUNK_SIZE = 160

/** Split a message into ≤160-character segments */
function chunkSms(text: string): string[] {
  const chunks: string[] = []
  let remaining = text
  while (remaining.length > 0) {
    chunks.push(remaining.substring(0, SMS_CHUNK_SIZE))
    remaining = remaining.substring(SMS_CHUNK_SIZE)
  }
  return chunks
}

export class TwilioAdapter implements ChannelAdapter {
  readonly name = 'sms'

  private twilioClient:    any    = null
  private healthy                 = false
  private accountSid:      string
  private authToken:       string
  private fromNumber:      string
  private allowedNumbers:  Set<string>
  private webhookUrl:      string
  private app:             Application | null = null

  constructor(app?: Application) {
    this.accountSid     = process.env.TWILIO_ACCOUNT_SID      ?? ''
    this.authToken      = process.env.TWILIO_AUTH_TOKEN       ?? ''
    this.fromNumber     = process.env.TWILIO_PHONE_NUMBER     ?? ''
    const raw           = process.env.TWILIO_ALLOWED_NUMBERS  ?? ''
    this.allowedNumbers = raw ? new Set(raw.split(',').map(s => s.trim()).filter(Boolean)) : new Set()
    this.webhookUrl     = process.env.WEBHOOK_URL             ?? ''
    this.app            = app ?? null
  }

  // ── Lifecycle ──────────────────────────────────────────────

  async start(): Promise<void> {
    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      console.log('[SMS] Disabled — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER to enable')
      return
    }

    let twilio: any
    try {
      twilio = require('twilio')
    } catch (e: any) {
      console.log('[SMS] Disabled — twilio package not available:', e.message)
      return
    }

    this.twilioClient = twilio(this.accountSid, this.authToken)

    // Register outbound delivery
    gateway.registerChannel('sms', async (msg) => {
      await this.send(msg.channelId, msg.text)
      return true
    })

    // Register inbound webhook handler on the express app
    if (this.app) {
      this.app.post('/api/channels/sms/inbound', async (req: any, res: any) => {
        res.set('Content-Type', 'text/xml')
        const from  = req.body?.From ?? ''
        const body  = req.body?.Body ?? ''

        if (!this.isAllowed(from)) {
          res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>')
          return
        }

        const response = await this.processMessage(from, from, body)

        // Reply via TwiML (Twilio Markup Language) — Twilio sends this as SMS
        const twiml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<Response>',
          ...chunkSms(response).map(chunk =>
            `  <Message>${chunk.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Message>`
          ),
          '</Response>',
        ].join('\n')
        res.send(twiml)
      })
    }

    if (!this.webhookUrl) {
      console.log('[SMS] Outbound ready — inbound SMS requires public webhook URL (set WEBHOOK_URL env or use ngrok)')
    } else {
      console.log(`[SMS] Ready — inbound webhook: ${this.webhookUrl}/api/channels/sms/inbound`)
    }

    this.healthy = true
  }

  async stop(): Promise<void> {
    this.healthy = false
    gateway.unregisterChannel('sms')
    this.twilioClient = null
    console.log('[SMS] Disconnected')
  }

  async send(target: string, message: string): Promise<void> {
    if (!this.twilioClient || !this.healthy) return
    const chunks = chunkSms(message)
    for (const chunk of chunks) {
      try {
        await this.twilioClient.messages.create({
          body: chunk,
          from: this.fromNumber,
          to:   target,
        })
      } catch (e: any) {
        console.error('[SMS] send error:', e.message)
        break
      }
    }
  }

  isHealthy(): boolean { return this.healthy }

  // ── Helpers ────────────────────────────────────────────────

  private isAllowed(number: string): boolean {
    if (this.allowedNumbers.size === 0) return true
    return this.allowedNumbers.has(number)
  }

  private async processMessage(channelId: string, userId: string, text: string): Promise<string> {
    try {
      return await gateway.routeMessage({
        channel:   'sms',
        channelId,
        userId,
        text,
        timestamp: Date.now(),
      })
    } catch (e: any) {
      console.error('[SMS] routeMessage error:', e.message)
      return 'Something went wrong. Try again.'
    }
  }
}
