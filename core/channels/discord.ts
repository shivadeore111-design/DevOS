// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/channels/discord.ts — Discord channel adapter.
//
// Config (env vars):
//   DISCORD_BOT_TOKEN           — required; adapter stays disabled if absent
//   DISCORD_ALLOWED_GUILDS      — optional comma-separated guild IDs
//   DISCORD_ALLOWED_CHANNELS    — optional comma-separated channel IDs
//
// Features:
//   - Responds to direct messages and guild messages
//   - Slash commands: /aiden <prompt>  /aiden-help
//   - Allowlist enforcement for guilds and channels
//   - Ignores messages from other bots (no bot loops)
//   - Graceful degradation: missing token → disabled, no crash

import {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  TextChannel,
  DMChannel,
  type Interaction,
  type Message,
} from 'discord.js'
import { gateway } from '../gateway'
import type { ChannelAdapter } from './adapter'

export class DiscordAdapter implements ChannelAdapter {
  readonly name = 'discord'

  private client:          Client | null = null
  private token:           string
  private allowedGuilds:   Set<string>
  private allowedChannels: Set<string>
  private healthy          = false

  constructor() {
    this.token           = process.env.DISCORD_BOT_TOKEN          ?? ''
    const rawGuilds      = process.env.DISCORD_ALLOWED_GUILDS     ?? ''
    const rawChannels    = process.env.DISCORD_ALLOWED_CHANNELS   ?? ''
    this.allowedGuilds   = rawGuilds    ? new Set(rawGuilds.split(',').map(s => s.trim()).filter(Boolean))    : new Set()
    this.allowedChannels = rawChannels  ? new Set(rawChannels.split(',').map(s => s.trim()).filter(Boolean))  : new Set()
  }

  // ── Lifecycle ──────────────────────────────────────────────

  async start(): Promise<void> {
    if (!this.token) {
      console.log('[Discord] Disabled — set DISCORD_BOT_TOKEN to enable')
      return
    }

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
    })

    this.client.once(Events.ClientReady, async (c) => {
      console.log(`[Discord] Connected as ${c.user.tag}`)
      this.healthy = true
      // Register outbound delivery so gateway.deliver() and broadcast() work
      gateway.registerChannel('discord', async (msg) => {
        return this.deliverToChannel(msg.channelId, msg.text)
      })
      // Register slash commands globally (takes ~1h to propagate on first run)
      await this.registerSlashCommands(c.user.id).catch((e: Error) =>
        console.warn('[Discord] Slash command registration failed:', e.message),
      )
    })

    this.client.on(Events.MessageCreate, async (message: Message) => {
      if (!this.shouldHandle(message.author.id, message.guildId, message.channelId, message.author.bot)) return

      try {
        await (message.channel as TextChannel).sendTyping?.()
      } catch {}

      const response = await this.processMessage(message.channelId, message.author.id, message.content)
      await message.reply(response.substring(0, 2000)).catch((e: Error) =>
        console.error('[Discord] Reply error:', e.message),
      )
    })

    this.client.on(Events.InteractionCreate, async (interaction: Interaction) => {
      if (!interaction.isChatInputCommand()) return

      const guildId   = interaction.guildId
      const channelId = interaction.channelId
      const userId    = interaction.user.id

      // Allowlist check
      if (this.allowedGuilds.size > 0 && guildId && !this.allowedGuilds.has(guildId)) {
        await interaction.reply({ content: '⚠️ This server is not authorized.', ephemeral: true })
        return
      }
      if (this.allowedChannels.size > 0 && !this.allowedChannels.has(channelId)) {
        await interaction.reply({ content: '⚠️ This channel is not authorized.', ephemeral: true })
        return
      }

      if (interaction.commandName === 'aiden') {
        const prompt = interaction.options.getString('prompt', true)
        await interaction.deferReply()
        const response = await this.processMessage(channelId, userId, prompt)
        await interaction.editReply(response.substring(0, 2000)).catch((e: Error) =>
          console.error('[Discord] editReply error:', e.message),
        )
      } else if (interaction.commandName === 'aiden-help') {
        await interaction.reply({
          content: '**Aiden** — your local AI assistant\n\n`/aiden <prompt>` — ask anything\n`/aiden-help` — show this message',
          ephemeral: true,
        })
      }
    })

    try {
      await this.client.login(this.token)
    } catch (e: any) {
      console.error('[Discord] Login failed:', e.message)
      this.healthy = false
    }
  }

  async stop(): Promise<void> {
    this.healthy = false
    if (this.client) {
      gateway.unregisterChannel('discord')
      await this.client.destroy()
      this.client = null
    }
    console.log('[Discord] Disconnected')
  }

  async send(channelId: string, message: string): Promise<void> {
    await this.deliverToChannel(channelId, message)
  }

  isHealthy(): boolean { return this.healthy }

  // ── Helpers ────────────────────────────────────────────────

  private shouldHandle(
    authorId:  string,
    guildId:   string | null,
    channelId: string,
    isBot:     boolean,
  ): boolean {
    if (isBot) return false
    if (this.allowedGuilds.size > 0 && guildId && !this.allowedGuilds.has(guildId))    return false
    if (this.allowedChannels.size > 0 && !this.allowedChannels.has(channelId)) return false
    return true
  }

  private async processMessage(channelId: string, userId: string, text: string): Promise<string> {
    try {
      return await gateway.routeMessage({
        channel:   'discord',
        channelId,
        userId,
        text,
        timestamp: Date.now(),
      })
    } catch (e: any) {
      console.error('[Discord] routeMessage error:', e.message)
      return '❌ Something went wrong. Try again.'
    }
  }

  private async deliverToChannel(channelId: string, text: string): Promise<boolean> {
    try {
      const ch = this.client?.channels.cache.get(channelId)
      if (ch && (ch instanceof TextChannel || ch instanceof DMChannel)) {
        await ch.send(text.substring(0, 2000))
        return true
      }
      return false
    } catch (e: any) {
      console.error('[Discord] Delivery error:', e.message)
      return false
    }
  }

  private async registerSlashCommands(appId: string): Promise<void> {
    const rest = new REST({ version: '10' }).setToken(this.token)
    const commands = [
      new SlashCommandBuilder()
        .setName('aiden')
        .setDescription('Ask Aiden anything')
        .addStringOption(opt =>
          opt.setName('prompt').setDescription('Your message to Aiden').setRequired(true),
        )
        .toJSON(),
      new SlashCommandBuilder()
        .setName('aiden-help')
        .setDescription('Show Aiden capabilities')
        .toJSON(),
    ]
    await rest.put(Routes.applicationCommands(appId), { body: commands })
    console.log('[Discord] Slash commands registered globally')
  }
}
