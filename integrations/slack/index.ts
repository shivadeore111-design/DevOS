// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// integrations/slack/index.ts — Slack Incoming Webhook client (pure Node.js).

import https from "https"
import fs    from "fs"
import path  from "path"
import url   from "url"

const INTEGRATIONS_FILE = path.join(process.cwd(), "config", "integrations.json")
const TIMEOUT_MS        = 10_000

function loadWebhookUrl(): string {
  if (process.env.SLACK_WEBHOOK_URL) return process.env.SLACK_WEBHOOK_URL
  try {
    const cfg = JSON.parse(fs.readFileSync(INTEGRATIONS_FILE, "utf-8"))
    return cfg?.slack?.webhookUrl ?? ""
  } catch {
    return ""
  }
}

function loadDefaultChannel(): string {
  try {
    const cfg = JSON.parse(fs.readFileSync(INTEGRATIONS_FILE, "utf-8"))
    return cfg?.slack?.defaultChannel ?? "#devos-alerts"
  } catch {
    return "#devos-alerts"
  }
}

function loadNotificationConfig(): Record<string, boolean> {
  try {
    const cfg = JSON.parse(fs.readFileSync(INTEGRATIONS_FILE, "utf-8"))
    return cfg?.notifications ?? {}
  } catch {
    return {}
  }
}

function postToSlack(webhookUrl: string, payload: object): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!webhookUrl) {
      // Silently skip if not configured
      resolve()
      return
    }

    const body    = JSON.stringify(payload)
    const parsed  = url.parse(webhookUrl)
    const options: https.RequestOptions = {
      hostname: parsed.hostname ?? "",
      port:     443,
      path:     parsed.path   ?? "/",
      method:   "POST",
      headers:  {
        "Content-Type":   "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: TIMEOUT_MS,
    }

    const req = https.request(options, res => {
      res.resume()
      res.on("end", () => resolve())
      res.on("error", reject)
    })

    req.on("timeout", () => { req.destroy(); reject(new Error("Slack request timed out")) })
    req.on("error",   reject)
    req.write(body)
    req.end()
  })
}

export class SlackIntegration {

  private get webhookUrl():      string { return loadWebhookUrl() }
  private get defaultChannel():  string { return loadDefaultChannel() }
  get notificationConfig(): Record<string, boolean> { return loadNotificationConfig() }

  /** Send a plain-text message. */
  async send(message: string, channel?: string): Promise<void> {
    const payload: Record<string, string> = { text: message }
    if (channel ?? this.defaultChannel) {
      payload.channel = channel ?? this.defaultChannel
    }
    try {
      await postToSlack(this.webhookUrl, payload)
    } catch (err: any) {
      console.warn(`[Slack] send failed: ${err.message}`)
    }
  }

  /** Send a Block Kit message. */
  async sendRich(blocks: any[]): Promise<void> {
    try {
      await postToSlack(this.webhookUrl, { blocks, channel: this.defaultChannel })
    } catch (err: any) {
      console.warn(`[Slack] sendRich failed: ${err.message}`)
    }
  }

  /**
   * Send a formatted goal completion / failure notification.
   * Respects notification config; silently skips if disabled or webhook not set.
   */
  async notify(
    goalId:  string,
    status:  "completed" | "failed",
    summary: string,
  ): Promise<void> {
    const cfg = this.notificationConfig
    if (status === "completed" && !cfg.onGoalComplete) return
    if (status === "failed"    && !cfg.onGoalFailed)   return

    const icon    = status === "completed" ? "✅" : "❌"
    const label   = status === "completed" ? "Goal Completed" : "Goal Failed"
    const message =
      `${icon} *DevOS — ${label}*\n` +
      `• Goal ID: \`${goalId}\`\n` +
      `• ${summary}`

    await this.send(message)
  }
}

export const slack = new SlackIntegration()
