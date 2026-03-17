// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// integrations/whatsapp/whatsappBot.ts — WhatsApp integration via whatsapp-web.js
// Connects via QR code (no Meta API key required).
// First message from any number sets the owner; all other numbers are ignored.

import { Client, LocalAuth, Message } from 'whatsapp-web.js'
import * as qrcode from 'qrcode-terminal'
import * as path   from 'path'
import * as fs     from 'fs'
import { dialogueEngine }   from '../../personality/dialogueEngine'
import { goalEngine }       from '../../goals/goalEngine'
import { persistentMemory } from '../../memory/persistentMemory'
import { eventBus }         from '../../core/eventBus'

const AUTH_DIR = path.join(process.cwd(), 'config', 'whatsapp-auth')
fs.mkdirSync(AUTH_DIR, { recursive: true })


class WhatsAppBot {
  private client: Client
  private ownerNumber: string | null = null
  private isConnected = false

  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: AUTH_DIR }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    })
  }

  async start(): Promise<void> {
    // ── QR code ───────────────────────────────────────────────────
    this.client.on('qr', (qr: string) => {
      console.log('\n[WhatsApp] Scan this QR code:')
      qrcode.generate(qr, { small: true })
      console.log('\nWhatsApp → Settings → Linked Devices → Link a Device\n')
    })

    // ── Ready ─────────────────────────────────────────────────────
    this.client.on('ready', async () => {
      this.isConnected = true
      console.log('[WhatsApp] ✅ Connected and ready!')
      const saved = await persistentMemory.getFact('user', 'whatsapp_number')
      if (saved) this.ownerNumber = saved
    })

    this.client.on('authenticated', () => {
      console.log('[WhatsApp] Authenticated')
    })

    this.client.on('auth_failure', (msg: string) => {
      console.error('[WhatsApp] Auth failed:', msg)
    })

    this.client.on('disconnected', (reason: string) => {
      this.isConnected = false
      const shouldReconnect = reason !== 'LOGOUT'
      console.log(`[WhatsApp] Disconnected (${reason}). Reconnecting: ${shouldReconnect}`)
      if (shouldReconnect) {
        // Recreate client so event listeners are fresh on next start()
        this.client = new Client({
          authStrategy: new LocalAuth({ dataPath: AUTH_DIR }),
          puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] },
        })
        setTimeout(() => this.start(), 3000)
      }
    })

    // ── Incoming messages ─────────────────────────────────────────
    this.client.on('message', async (msg: Message) => {
      // Skip group messages and status broadcasts
      if (msg.from.includes('@g.us'))      return
      if (msg.from === 'status@broadcast') return

      const text = msg.body?.trim()
      if (!text) return

      console.log(`[WhatsApp] ← ${msg.from}: ${text}`)

      // First message from any number → become the owner
      if (!this.ownerNumber) {
        this.ownerNumber = msg.from
        await persistentMemory.setFact('user', 'whatsapp_number', msg.from, 'whatsapp')
        console.log(`[WhatsApp] Owner set: ${msg.from}`)
      }

      // Only respond to owner
      if (msg.from !== this.ownerNumber) return

      await this.handleMessage(msg)
    })

    // ── Goal completion notifications ─────────────────────────────
    eventBus.on('goal_completed', async (data: any) => {
      if (this.isConnected && this.ownerNumber) {
        await this.send(`✅ Done: ${data.title ?? data.goalId}`)
      }
    })

    eventBus.on('goal_failed', async (data: any) => {
      if (this.isConnected && this.ownerNumber) {
        await this.send(`❌ Failed: ${data.title ?? data.goalId}`)
      }
    })

    console.log('[WhatsApp] Initializing...')
    await this.client.initialize()
  }

  // ── Message handling ────────────────────────────────────────────

  private async handleMessage(msg: Message): Promise<void> {
    try {
      const text  = msg.body.trim()
      const lower = text.toLowerCase().trim()
      console.log(`[WhatsApp] Processing: "${lower}"`)

      // ── Fast commands (no LLM, instant response) ──────────────────
      if (['status', 'ping', 's'].includes(lower)) {
        const stats = await persistentMemory.getStats()
        const reply = `⚡ DevOS online\n📊 ${stats.totalGoals} goals | ${stats.totalFacts} facts`
        console.log(`[WhatsApp] Sending reply: ${reply}`)
        await this.client.sendMessage(msg.from, reply)
        console.log(`[WhatsApp] Reply sent OK`)
        return
      }

      if (['hi', 'hello', 'hey', 'yo', 'sup'].includes(lower)) {
        const name = await persistentMemory.getFact('user', 'name') || 'there'
        await this.client.sendMessage(msg.from, `Hey ${name}! Send a goal or type help.`)
        return
      }

      if (['goals', 'history', 'g'].includes(lower)) {
        const goals = await persistentMemory.getRecentGoals(5)
        if (!goals.length) {
          await this.client.sendMessage(msg.from, 'No goals yet.')
          return
        }
        const list = goals
          .map((g: any) => `${g.status === 'completed' ? '✅' : '❌'} ${g.title}`)
          .join('\n')
        await this.client.sendMessage(msg.from, `Recent goals:\n${list}`)
        return
      }

      if (['help', 'h', '?'].includes(lower)) {
        await this.client.sendMessage(
          msg.from,
          `DevOS commands:\nstatus — system status\ngoals — recent history\nhelp — this message\n\nOr send any goal:\n"build a todo API"\n"create file on desktop"`
        )
        return
      }

      // ── Build intent (fire goal, no LLM wait) ─────────────────────
      const BUILD_KEYWORDS = ['build', 'create', 'make', 'generate', 'write', 'deploy', 'fix', 'run']
      const isBuild = BUILD_KEYWORDS.some(k => lower.includes(k))
      if (isBuild) {
        await this.client.sendMessage(msg.from, `⚡ Starting: "${text.slice(0, 50)}"\nI'll notify you when done.`)
        goalEngine.run(text.slice(0, 60), text).catch(async () => {
          await this.send(`❌ Goal failed to start.`)
        })
        return
      }

      // ── Chat fallback (LLM — will be slow) ────────────────────────
      await this.client.sendMessage(msg.from, '⏳ Thinking...')
      const chunks: string[] = []
      for await (const chunk of dialogueEngine.chat(text)) {
        chunks.push(chunk)
      }
      const response = chunks.join('').trim().slice(0, 1500)
      await this.client.sendMessage(msg.from, response || "I'm here.")

    } catch (err: any) {
      console.error('[WhatsApp] handleMessage error:', err?.message)
      console.error(err)
    }
  }

  // ── Outbound ────────────────────────────────────────────────────

  async send(text: string): Promise<void> {
    if (!this.ownerNumber || !this.isConnected) {
      console.log('[WhatsApp] Cannot send — not connected or owner not set')
      return
    }
    try {
      await this.client.sendMessage(this.ownerNumber, text)
      console.log(`[WhatsApp] → ${text.slice(0, 80)}${text.length > 80 ? '…' : ''}`)
    } catch (err: any) {
      console.error('[WhatsApp] Send failed:', err?.message ?? String(err))
    }
  }

  // ── Status ──────────────────────────────────────────────────────

  getStatus(): { connected: boolean; ownerSet: boolean } {
    return { connected: this.isConnected, ownerSet: !!this.ownerNumber }
  }

  /** True if auth data already exists on disk */
  static hasAuth(): boolean {
    try {
      return fs.existsSync(AUTH_DIR) && fs.readdirSync(AUTH_DIR).length > 0
    } catch {
      return false
    }
  }
}

export const whatsappBot = new WhatsAppBot()
