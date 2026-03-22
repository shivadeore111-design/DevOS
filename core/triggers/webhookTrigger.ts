// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/triggers/webhookTrigger.ts — HTTP server that exposes DevOS to external
//   webhooks. Each registered path maps to a DevOS goal.

import http  from "http"
import fs    from "fs"
import path  from "path"
import { eventBus } from "../eventBus"

const WEBHOOKS_FILE = path.join(process.cwd(), "config", "webhooks.json")
const DEFAULT_PORT  = 3001

export interface WebhookRegistration {
  path:   string   // e.g. "/webhook/deploy"
  goal:   string
  secret?: string  // if set, X-Webhook-Secret header must match
}

export class WebhookTrigger {

  private registrations: Map<string, WebhookRegistration> = new Map()
  private server: http.Server | null = null

  constructor() {
    this._load()
  }

  // ── Public API ─────────────────────────────────────────────

  /**
   * Register a webhook endpoint.
   * @param webhookPath  URL path, e.g. "/webhook/deploy"
   * @param goal         DevOS goal to emit when this path is POSTed
   * @param secret       Optional shared secret validated via X-Webhook-Secret header
   */
  register(webhookPath: string, goal: string, secret?: string): void {
    const normalised = webhookPath.startsWith("/") ? webhookPath : `/${webhookPath}`
    const entry: WebhookRegistration = { path: normalised, goal }
    if (secret) entry.secret = secret
    this.registrations.set(normalised, entry)
    this._persist()
    console.log(`[WebhookTrigger] Registered ${normalised} → "${goal}"`)
  }

  /** List all registered webhooks. */
  list(): WebhookRegistration[] {
    return Array.from(this.registrations.values())
  }

  /** Start the HTTP server. Safe to call multiple times. */
  start(port: number = DEFAULT_PORT): void {
    if (this.server) return

    this.server = http.createServer((req, res) => this._handleRequest(req, res))
    this.server.listen(port, () => {
      console.log(`[WebhookTrigger] Listening on port ${port}`)
    })
    this.server.on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        console.warn(`[WebhookTrigger] Port ${port} in use — webhook server not started`)
      } else {
        console.error(`[WebhookTrigger] Server error: ${err.message}`)
      }
    })
  }

  /** Stop the HTTP server. */
  stop(): void {
    if (!this.server) return
    this.server.close(() => {
      console.log("[WebhookTrigger] Server stopped")
    })
    this.server = null
  }

  // ── Request Handler ───────────────────────────────────────

  private _handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const urlPath = req.url?.split("?")[0] ?? "/"

    // Only accept POST
    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Method Not Allowed" }))
      return
    }

    const registration = this.registrations.get(urlPath)
    if (!registration) {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Webhook not registered" }))
      return
    }

    // Secret validation
    if (registration.secret) {
      const provided = req.headers["x-webhook-secret"]
      if (provided !== registration.secret) {
        res.writeHead(403, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "Invalid secret" }))
        return
      }
    }

    // Read body
    let body = ""
    req.on("data", (chunk: Buffer) => { body += chunk.toString() })
    req.on("end",  () => {
      let payload: any = {}
      try { payload = JSON.parse(body) } catch { /* treat non-JSON body as empty */ }

      console.log(`[WebhookTrigger] 🔔 Received POST ${urlPath} → "${registration.goal}"`)
      eventBus.emit("webhook_triggered", {
        path:    urlPath,
        goal:    registration.goal,
        payload,
      })

      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ received: true }))
    })

    req.on("error", (err: Error) => {
      console.error(`[WebhookTrigger] Request read error: ${err.message}`)
      res.writeHead(500, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Internal error" }))
    })
  }

  // ── Persistence ───────────────────────────────────────────

  private _load(): void {
    try {
      if (!fs.existsSync(WEBHOOKS_FILE)) return
      const raw  = fs.readFileSync(WEBHOOKS_FILE, "utf-8")
      const data = JSON.parse(raw) as WebhookRegistration[]
      for (const r of data) {
        this.registrations.set(r.path, r)
      }
      console.log(`[WebhookTrigger] Loaded ${this.registrations.size} registration(s) from disk`)
    } catch {
      /* start fresh */
    }
  }

  private _persist(): void {
    try {
      fs.mkdirSync(path.dirname(WEBHOOKS_FILE), { recursive: true })
      fs.writeFileSync(
        WEBHOOKS_FILE,
        JSON.stringify(Array.from(this.registrations.values()), null, 2),
        "utf-8"
      )
    } catch (err: any) {
      console.warn(`[WebhookTrigger] Could not persist registrations: ${err.message}`)
    }
  }
}

export const webhookTrigger = new WebhookTrigger()
