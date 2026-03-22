"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookTrigger = exports.WebhookTrigger = void 0;
// core/triggers/webhookTrigger.ts — HTTP server that exposes DevOS to external
//   webhooks. Each registered path maps to a DevOS goal.
const http_1 = __importDefault(require("http"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const eventBus_1 = require("../eventBus");
const WEBHOOKS_FILE = path_1.default.join(process.cwd(), "config", "webhooks.json");
const DEFAULT_PORT = 3001;
class WebhookTrigger {
    constructor() {
        this.registrations = new Map();
        this.server = null;
        this._load();
    }
    // ── Public API ─────────────────────────────────────────────
    /**
     * Register a webhook endpoint.
     * @param webhookPath  URL path, e.g. "/webhook/deploy"
     * @param goal         DevOS goal to emit when this path is POSTed
     * @param secret       Optional shared secret validated via X-Webhook-Secret header
     */
    register(webhookPath, goal, secret) {
        const normalised = webhookPath.startsWith("/") ? webhookPath : `/${webhookPath}`;
        const entry = { path: normalised, goal };
        if (secret)
            entry.secret = secret;
        this.registrations.set(normalised, entry);
        this._persist();
        console.log(`[WebhookTrigger] Registered ${normalised} → "${goal}"`);
    }
    /** List all registered webhooks. */
    list() {
        return Array.from(this.registrations.values());
    }
    /** Start the HTTP server. Safe to call multiple times. */
    start(port = DEFAULT_PORT) {
        if (this.server)
            return;
        this.server = http_1.default.createServer((req, res) => this._handleRequest(req, res));
        this.server.listen(port, () => {
            console.log(`[WebhookTrigger] Listening on port ${port}`);
        });
        this.server.on("error", (err) => {
            if (err.code === "EADDRINUSE") {
                console.warn(`[WebhookTrigger] Port ${port} in use — webhook server not started`);
            }
            else {
                console.error(`[WebhookTrigger] Server error: ${err.message}`);
            }
        });
    }
    /** Stop the HTTP server. */
    stop() {
        if (!this.server)
            return;
        this.server.close(() => {
            console.log("[WebhookTrigger] Server stopped");
        });
        this.server = null;
    }
    // ── Request Handler ───────────────────────────────────────
    _handleRequest(req, res) {
        const urlPath = req.url?.split("?")[0] ?? "/";
        // Only accept POST
        if (req.method !== "POST") {
            res.writeHead(405, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Method Not Allowed" }));
            return;
        }
        const registration = this.registrations.get(urlPath);
        if (!registration) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Webhook not registered" }));
            return;
        }
        // Secret validation
        if (registration.secret) {
            const provided = req.headers["x-webhook-secret"];
            if (provided !== registration.secret) {
                res.writeHead(403, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Invalid secret" }));
                return;
            }
        }
        // Read body
        let body = "";
        req.on("data", (chunk) => { body += chunk.toString(); });
        req.on("end", () => {
            let payload = {};
            try {
                payload = JSON.parse(body);
            }
            catch { /* treat non-JSON body as empty */ }
            console.log(`[WebhookTrigger] 🔔 Received POST ${urlPath} → "${registration.goal}"`);
            eventBus_1.eventBus.emit("webhook_triggered", {
                path: urlPath,
                goal: registration.goal,
                payload,
            });
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ received: true }));
        });
        req.on("error", (err) => {
            console.error(`[WebhookTrigger] Request read error: ${err.message}`);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal error" }));
        });
    }
    // ── Persistence ───────────────────────────────────────────
    _load() {
        try {
            if (!fs_1.default.existsSync(WEBHOOKS_FILE))
                return;
            const raw = fs_1.default.readFileSync(WEBHOOKS_FILE, "utf-8");
            const data = JSON.parse(raw);
            for (const r of data) {
                this.registrations.set(r.path, r);
            }
            console.log(`[WebhookTrigger] Loaded ${this.registrations.size} registration(s) from disk`);
        }
        catch {
            /* start fresh */
        }
    }
    _persist() {
        try {
            fs_1.default.mkdirSync(path_1.default.dirname(WEBHOOKS_FILE), { recursive: true });
            fs_1.default.writeFileSync(WEBHOOKS_FILE, JSON.stringify(Array.from(this.registrations.values()), null, 2), "utf-8");
        }
        catch (err) {
            console.warn(`[WebhookTrigger] Could not persist registrations: ${err.message}`);
        }
    }
}
exports.WebhookTrigger = WebhookTrigger;
exports.webhookTrigger = new WebhookTrigger();
