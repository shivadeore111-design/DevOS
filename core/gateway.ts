// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/gateway.ts — Unified channel router.
// All inbound messages (dashboard, Telegram, API, future channels)
// are routed through a single processor so they share the same
// memory, context, and tool pipeline.

import { sessionRouter } from './sessionRouter'

// ── Types ──────────────────────────────────────────────────────

export type ChannelType =
  | 'dashboard'
  | 'telegram'
  | 'discord'
  | 'slack'
  | 'whatsapp'
  | 'signal'
  | 'sms'
  | 'imessage'
  | 'email'
  | 'api'
  | 'tui'

export interface IncomingMessage {
  channel:      ChannelType
  channelId:    string          // chat ID, user ID, etc.
  userId:       string          // unique user identifier
  text:         string
  attachments?: string[]
  timestamp:    number
  replyTo?:     string          // message ID being replied to
  sessionId?:   string          // stable cross-channel session ID (set by routeMessage)
}

export interface OutgoingMessage {
  channel:   ChannelType
  channelId: string
  text:      string
  metadata?: {
    toolsUsed?: string[]
    cost?:      number
    duration?:  number
  }
}

export type MessageHandler  = (message: IncomingMessage) => Promise<string>
export type DeliveryHandler = (message: OutgoingMessage) => Promise<boolean>

// ── Gateway class ──────────────────────────────────────────────

class Gateway {
  private handlers:         Map<ChannelType, DeliveryHandler> = new Map()
  private messageProcessor: MessageHandler | null             = null
  private activeChannels:   Set<ChannelType>                  = new Set()

  // ── Register the central message processor (Aiden's brain) ───

  setProcessor(handler: MessageHandler): void {
    this.messageProcessor = handler
  }

  // ── Register a channel's outbound delivery method ─────────────

  registerChannel(channel: ChannelType, deliveryHandler: DeliveryHandler): void {
    this.handlers.set(channel, deliveryHandler)
    this.activeChannels.add(channel)
    console.log(`[Gateway] Channel registered: ${channel}`)
  }

  // ── Unregister a channel ──────────────────────────────────────

  unregisterChannel(channel: ChannelType): void {
    this.handlers.delete(channel)
    this.activeChannels.delete(channel)
    console.log(`[Gateway] Channel unregistered: ${channel}`)
  }

  // ── Route an incoming message through Aiden ───────────────────

  async routeMessage(message: IncomingMessage): Promise<string> {
    if (!this.messageProcessor) {
      throw new Error('No message processor registered')
    }

    // Resolve stable cross-channel session and attach sessionId
    const session        = sessionRouter.getSession(message.userId, message.channel)
    session.messageCount++
    message.sessionId    = session.sessionId

    console.log(
      `[Gateway] ${message.channel}:${message.channelId} ` +
      `[${session.sessionId}] → "${message.text.substring(0, 60)}"`,
    )

    const start = Date.now()

    try {
      let response = await this.messageProcessor(message)
      const duration = Date.now() - start

      console.log(
        `[Gateway] Response ready (${duration}ms) → ${message.channel}`,
      )

      // Hint on Telegram first message: conversation continues on desktop
      if (message.channel === 'telegram' && session.messageCount === 1) {
        response += '\n\n_Tip: Continue this conversation on your desktop dashboard with full context._'
      }

      return response
    } catch (error) {
      console.error(`[Gateway] Processing failed:`, error)
      return 'Something went wrong processing your message. Try again.'
    }
  }

  // ── Deliver a message to a specific channel ───────────────────

  async deliver(message: OutgoingMessage): Promise<boolean> {
    const handler = this.handlers.get(message.channel)
    if (!handler) {
      console.log(`[Gateway] No handler for channel: ${message.channel}`)
      return false
    }

    try {
      return await handler(message)
    } catch (error) {
      console.error(`[Gateway] Delivery failed to ${message.channel}:`, error)
      return false
    }
  }

  // ── Broadcast to all active channels ─────────────────────────

  async broadcast(text: string, exclude?: ChannelType): Promise<void> {
    for (const channel of this.activeChannels) {
      if (channel === exclude) continue
      await this.deliver({ channel, channelId: 'broadcast', text })
    }
  }

  // ── Channel status list ────────────────────────────────────────

  getStatus(): Array<{ channel: ChannelType; active: boolean }> {
    const allChannels: ChannelType[] = [
      'dashboard', 'telegram', 'discord', 'slack', 'whatsapp', 'signal', 'sms', 'imessage', 'email', 'api',
    ]
    return allChannels.map(ch => ({
      channel: ch,
      active:  this.activeChannels.has(ch),
    }))
  }
}

export const gateway = new Gateway()
