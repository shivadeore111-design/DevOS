// ============================================================
// integrations/discord/discordBot.ts — Discord bot integration
// Commands: status, help, goals, hi/hello + goal execution + chat fallback
// Goal notifications via eventBus
// ============================================================

import { Client, GatewayIntentBits, Message, Events } from 'discord.js'
import { dialogueEngine }   from '../../personality/dialogueEngine'
import { goalEngine }       from '../../goals/goalEngine'
import { persistentMemory } from '../../memory/persistentMemory'
import { eventBus }         from '../../core/eventBus'

const BUILD_KEYWORDS = ['build', 'create', 'make', 'generate', 'write', 'deploy', 'fix', 'run']

class DiscordBot {
  private client:          Client
  private notifyChannelId: string | null = null
  private isConnected = false

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
    })
  }

  async start(token: string, notifyChannelId?: string): Promise<void> {
    this.notifyChannelId = notifyChannelId ?? null

    // ── Ready ────────────────────────────────────────────────
    this.client.once(Events.ClientReady, async (c) => {
      this.isConnected = true
      console.log(`[Discord] ✅ Logged in as ${c.user.tag}`)
      if (this.notifyChannelId) {
        await this.sendToChannel(this.notifyChannelId, '⚡ DevOS online.')
      }
    })

    // ── Incoming messages ────────────────────────────────────
    this.client.on(Events.MessageCreate, async (msg: Message) => {
      if (msg.author.bot)      return
      if (!msg.content.trim()) return

      const text  = msg.content.trim()
      const lower = text.toLowerCase()
      console.log(`[Discord] ← ${msg.author.username}: ${text}`)

      try {
        if (['status', 'ping', 's'].includes(lower)) {
          const stats = await persistentMemory.getStats()
          await msg.reply(`⚡ DevOS online\n📊 ${stats.totalGoals} goals | ${stats.totalFacts} facts`)
          return
        }

        if (['help', 'h'].includes(lower)) {
          await msg.reply(
            'DevOS commands:\n' +
            '`status` — system info\n' +
            '`goals` — recent history\n' +
            'Or send any goal to execute it.'
          )
          return
        }

        if (['goals', 'g'].includes(lower)) {
          const goals = await persistentMemory.getRecentGoals(5)
          const list  = goals.length
            ? goals.map((g: any) => `${g.status === 'completed' ? '✅' : '❌'} ${g.title}`).join('\n')
            : 'No goals yet.'
          await msg.reply(list)
          return
        }

        if (['hi', 'hello', 'hey'].includes(lower)) {
          const name = await persistentMemory.getFact('user', 'name') || 'there'
          await msg.reply(`Hey ${name}! DevOS here. What do you want to build?`)
          return
        }

        if (BUILD_KEYWORDS.some(k => lower.includes(k))) {
          await msg.reply(`⚡ Starting: "${text.slice(0, 50)}" — I'll update you when done.`)
          goalEngine.run(text.slice(0, 60), text).catch(async () => {
            await msg.reply('❌ Goal failed to start.')
          })
          return
        }

        // Chat fallback via Ollama
        await msg.reply('⏳')
        const chunks: string[] = []
        for await (const chunk of dialogueEngine.chat(text)) chunks.push(chunk)
        await msg.reply(chunks.join('').trim().slice(0, 2000) || "I'm here.")

      } catch (err: any) {
        console.error('[Discord] Error:', err?.message)
      }
    })

    // ── Goal notifications ───────────────────────────────────
    eventBus.on('goal_completed', async (data: any) => {
      if (this.notifyChannelId) {
        await this.sendToChannel(
          this.notifyChannelId,
          `✅ Done: ${data.title || data.goalId}`
        )
      }
    })

    eventBus.on('goal_failed', async (data: any) => {
      if (this.notifyChannelId) {
        await this.sendToChannel(
          this.notifyChannelId,
          `❌ Failed: ${data.title || data.goalId}`
        )
      }
    })

    await this.client.login(token)
  }

  async sendToChannel(channelId: string, text: string): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(channelId)
      if (channel?.isTextBased()) {
        await (channel as any).send(text)
      }
    } catch (err: any) {
      console.error('[Discord] Send failed:', err?.message)
    }
  }

  getStatus(): { connected: boolean } {
    return { connected: this.isConnected }
  }
}

export const discordBot = new DiscordBot()
