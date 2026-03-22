// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// integrations/email/emailAgent.ts — Email channel for DevOS
// Polls IMAP inbox every 60 s for emails from the owner address.
// Goal keywords trigger goalEngine; "status" triggers a status reply.
// Sends goal_completed / goal_failed notifications via SMTP.

import * as nodemailer      from 'nodemailer'
import { goalEngine }       from '../../goals/goalEngine'
import { persistentMemory } from '../../memory/persistentMemory'
import { eventBus }         from '../../core/eventBus'
import * as fs              from 'fs'
import * as path            from 'path'

const CONFIG_PATH    = path.join(process.cwd(), 'config', 'email-config.json')
const BUILD_KEYWORDS = ['build', 'create', 'make', 'generate', 'write', 'deploy', 'fix', 'run']

interface EmailConfig {
  smtp:        { host: string; port: number; user: string; pass: string }
  imap:        { host: string; port: number; user: string; pass: string }
  ownerEmail:  string
}

class EmailAgent {
  private config:       EmailConfig | null = null
  private transporter:  any = null
  private isRunning     = false
  private pollInterval: NodeJS.Timeout | null = null

  // ── Config ────────────────────────────────────────────────

  loadConfig(): boolean {
    try {
      if (!fs.existsSync(CONFIG_PATH)) {
        const template: EmailConfig = {
          smtp:       { host: 'smtp.gmail.com', port: 587, user: 'your@gmail.com', pass: 'app-password' },
          imap:       { host: 'imap.gmail.com', port: 993, user: 'your@gmail.com', pass: 'app-password' },
          ownerEmail: 'your@gmail.com',
        }
        fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true })
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(template, null, 2))
        console.log(`[Email] Config template created at ${CONFIG_PATH}`)
        return false
      }
      this.config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
      return true
    } catch {
      return false
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────

  async start(): Promise<void> {
    if (!this.loadConfig() || !this.config) {
      console.log('[Email] Configure email at config/email-config.json first')
      return
    }

    this.transporter = nodemailer.createTransport({
      host:   this.config.smtp.host,
      port:   this.config.smtp.port,
      secure: false,
      auth:   { user: this.config.smtp.user, pass: this.config.smtp.pass },
    })

    this.isRunning = true
    console.log('[Email] ✅ Email agent started')

    // Poll inbox every 60 s
    this.pollInterval = setInterval(() => this.checkInbox(), 60_000)

    // Goal completion notifications
    eventBus.on('goal_completed', async (data: any) => {
      await this.send(
        `✅ Goal completed — ${data.title || data.goalId}`,
        `Your goal "${data.title}" has been completed successfully.`
      )
    })

    eventBus.on('goal_failed', async (data: any) => {
      await this.send(
        `❌ Goal failed — ${data.title || data.goalId}`,
        `Your goal "${data.title}" failed. Check the DevOS dashboard for details.`
      )
    })
  }

  // ── Inbox polling ─────────────────────────────────────────

  async checkInbox(): Promise<void> {
    if (!this.config) return
    try {
      // imap-simple is loaded dynamically to keep startup fast when email
      // is not configured (avoids a hard require at module load time).
      const imaps      = require('imap-simple')
      const connection = await imaps.connect({
        imap: {
          ...this.config.imap,
          tls:        true,
          tlsOptions: { rejectUnauthorized: false },
        },
      })

      await connection.openBox('INBOX')
      const messages = await connection.search(
        ['UNSEEN', ['FROM', this.config.ownerEmail]],
        { bodies: ['HEADER', 'TEXT'], markSeen: true }
      )

      for (const msg of messages) {
        const subject = msg.parts.find((p: any) => p.which === 'HEADER')?.body?.subject?.[0] || ''
        const body    = msg.parts.find((p: any) => p.which === 'TEXT')?.body || ''
        const text    = (subject + ' ' + body).trim()
        const lower   = text.toLowerCase()

        console.log(`[Email] ← ${subject}`)

        if (BUILD_KEYWORDS.some(k => lower.includes(k))) {
          await this.send(
            '⚡ Starting goal',
            `Got it — starting: "${text.slice(0, 80)}"\nI'll email you when done.`
          )
          goalEngine.run(text.slice(0, 60), text).catch(() => {})
        } else if (lower.includes('status')) {
          const stats = await persistentMemory.getStats()
          await this.send(
            '⚡ DevOS Status',
            `DevOS is online.\n${stats.totalGoals} goals completed\n${stats.totalFacts} facts in memory`
          )
        }
      }

      connection.end()
    } catch (err: any) {
      console.error('[Email] Inbox check failed:', err?.message)
    }
  }

  // ── Outbound ──────────────────────────────────────────────

  async send(subject: string, body: string): Promise<void> {
    if (!this.transporter || !this.config) return
    try {
      await this.transporter.sendMail({
        from:    this.config.smtp.user,
        to:      this.config.ownerEmail,
        subject: `DevOS: ${subject}`,
        text:    body,
      })
      console.log(`[Email] → ${subject}`)
    } catch (err: any) {
      console.error('[Email] Send failed:', err?.message)
    }
  }

  // ── Lifecycle helpers ─────────────────────────────────────

  stop(): void {
    if (this.pollInterval) clearInterval(this.pollInterval)
    this.isRunning = false
  }

  getStatus(): { running: boolean; configured: boolean } {
    return { running: this.isRunning, configured: !!this.config }
  }
}

export const emailAgent = new EmailAgent()
