"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.slack = exports.SlackIntegration = void 0;
// integrations/slack/index.ts — Slack Incoming Webhook client (pure Node.js).
const https_1 = __importDefault(require("https"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const url_1 = __importDefault(require("url"));
const INTEGRATIONS_FILE = path_1.default.join(process.cwd(), "config", "integrations.json");
const TIMEOUT_MS = 10000;
function loadWebhookUrl() {
    if (process.env.SLACK_WEBHOOK_URL)
        return process.env.SLACK_WEBHOOK_URL;
    try {
        const cfg = JSON.parse(fs_1.default.readFileSync(INTEGRATIONS_FILE, "utf-8"));
        return cfg?.slack?.webhookUrl ?? "";
    }
    catch {
        return "";
    }
}
function loadDefaultChannel() {
    try {
        const cfg = JSON.parse(fs_1.default.readFileSync(INTEGRATIONS_FILE, "utf-8"));
        return cfg?.slack?.defaultChannel ?? "#devos-alerts";
    }
    catch {
        return "#devos-alerts";
    }
}
function loadNotificationConfig() {
    try {
        const cfg = JSON.parse(fs_1.default.readFileSync(INTEGRATIONS_FILE, "utf-8"));
        return cfg?.notifications ?? {};
    }
    catch {
        return {};
    }
}
function postToSlack(webhookUrl, payload) {
    return new Promise((resolve, reject) => {
        if (!webhookUrl) {
            // Silently skip if not configured
            resolve();
            return;
        }
        const body = JSON.stringify(payload);
        const parsed = url_1.default.parse(webhookUrl);
        const options = {
            hostname: parsed.hostname ?? "",
            port: 443,
            path: parsed.path ?? "/",
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body),
            },
            timeout: TIMEOUT_MS,
        };
        const req = https_1.default.request(options, res => {
            res.resume();
            res.on("end", () => resolve());
            res.on("error", reject);
        });
        req.on("timeout", () => { req.destroy(); reject(new Error("Slack request timed out")); });
        req.on("error", reject);
        req.write(body);
        req.end();
    });
}
class SlackIntegration {
    get webhookUrl() { return loadWebhookUrl(); }
    get defaultChannel() { return loadDefaultChannel(); }
    get notificationConfig() { return loadNotificationConfig(); }
    /** Send a plain-text message. */
    async send(message, channel) {
        const payload = { text: message };
        if (channel ?? this.defaultChannel) {
            payload.channel = channel ?? this.defaultChannel;
        }
        try {
            await postToSlack(this.webhookUrl, payload);
        }
        catch (err) {
            console.warn(`[Slack] send failed: ${err.message}`);
        }
    }
    /** Send a Block Kit message. */
    async sendRich(blocks) {
        try {
            await postToSlack(this.webhookUrl, { blocks, channel: this.defaultChannel });
        }
        catch (err) {
            console.warn(`[Slack] sendRich failed: ${err.message}`);
        }
    }
    /**
     * Send a formatted goal completion / failure notification.
     * Respects notification config; silently skips if disabled or webhook not set.
     */
    async notify(goalId, status, summary) {
        const cfg = this.notificationConfig;
        if (status === "completed" && !cfg.onGoalComplete)
            return;
        if (status === "failed" && !cfg.onGoalFailed)
            return;
        const icon = status === "completed" ? "✅" : "❌";
        const label = status === "completed" ? "Goal Completed" : "Goal Failed";
        const message = `${icon} *DevOS — ${label}*\n` +
            `• Goal ID: \`${goalId}\`\n` +
            `• ${summary}`;
        await this.send(message);
    }
}
exports.SlackIntegration = SlackIntegration;
exports.slack = new SlackIntegration();
