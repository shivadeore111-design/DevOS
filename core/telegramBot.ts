// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/telegramBot.ts — Telegram bot integration for Aiden.
// Uses native fetch (Node 18+). No external dependencies.

export interface TelegramConfig {
  enabled:         boolean
  botToken:        string
  allowedChatIds:  string[]
  pollingInterval: number
}

// ── TelegramBot ────────────────────────────────────────────────

export class TelegramBot {
  private token:        string
  private baseUrl:      string
  private offset:       number  = 0
  private polling:      boolean = false
  private allowedChats: Set<string>

  constructor(config: TelegramConfig) {
    this.token        = config.botToken
    this.baseUrl      = `https://api.telegram.org/bot${this.token}`
    this.allowedChats = new Set(config.allowedChatIds)
  }

  // ── Send a message (auto-chunks at 4000 chars) ──────────────

  async sendMessage(chatId: string, text: string): Promise<void> {
    const chunks = this.chunkMessage(text, 4000)
    for (const chunk of chunks) {
      try {
        await fetch(`${this.baseUrl}/sendMessage`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            chat_id:    chatId,
            text:       chunk,
            parse_mode: 'Markdown',
          }),
        })
      } catch (e: any) {
        console.error('[Telegram] sendMessage error:', e.message)
      }
    }
  }

  // ── Show typing indicator ───────────────────────────────────

  async sendTyping(chatId: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/sendChatAction`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ chat_id: chatId, action: 'typing' }),
      })
    } catch {}
  }

  // ── Long-poll for updates ───────────────────────────────────

  async poll(): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/getUpdates?offset=${this.offset}&timeout=30`,
      )
      const data = await response.json() as any
      if (data.ok && data.result.length > 0) {
        this.offset = data.result[data.result.length - 1].update_id + 1
        return data.result
      }
    } catch (error: any) {
      console.error('[Telegram] Poll error:', error.message)
    }
    return []
  }

  // ── Main polling loop ───────────────────────────────────────

  async startPolling(
    onMessage: (chatId: string, text: string) => Promise<string>,
  ): Promise<void> {
    if (this.polling) return
    this.polling = true
    console.log('[Telegram] Bot started polling')

    while (this.polling) {
      const updates = await this.poll()

      for (const update of updates) {
        if (!update.message?.text) continue

        const chatId = String(update.message.chat.id)
        const text   = update.message.text

        // Security: only respond to allowed chat IDs
        // If allowedChatIds is empty, respond to everyone (first-time setup)
        if (this.allowedChats.size > 0 && !this.allowedChats.has(chatId)) {
          console.log(`[Telegram] Ignored message from unauthorized chat: ${chatId}`)
          await this.sendMessage(
            chatId,
            '⚠️ Unauthorized. Add your chat ID to Aiden Settings → Channels → Telegram.',
          )
          continue
        }

        console.log(`[Telegram] Message from ${chatId}: ${text.substring(0, 50)}`)
        await this.sendTyping(chatId)

        try {
          const response = await onMessage(chatId, text)
          await this.sendMessage(chatId, response)
        } catch (error: any) {
          console.error('[Telegram] Error processing message:', error.message)
          await this.sendMessage(
            chatId,
            '❌ Something went wrong processing your message. Try again.',
          )
        }
      }
    }
  }

  // ── Stop polling ────────────────────────────────────────────

  stop(): void {
    this.polling = false
    console.log('[Telegram] Bot stopped')
  }

  // ── Chunk long messages ─────────────────────────────────────

  private chunkMessage(text: string, maxLength: number): string[] {
    if (text.length <= maxLength) return [text]

    const chunks: string[] = []
    let remaining = text

    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining)
        break
      }

      // Prefer splitting at a newline
      let splitAt = remaining.lastIndexOf('\n', maxLength)
      if (splitAt < maxLength * 0.5) {
        // No good newline — try a space
        splitAt = remaining.lastIndexOf(' ', maxLength)
      }
      if (splitAt < maxLength * 0.5) {
        // No good split point — hard cut
        splitAt = maxLength
      }

      chunks.push(remaining.substring(0, splitAt))
      remaining = remaining.substring(splitAt).trim()
    }

    return chunks
  }
}
