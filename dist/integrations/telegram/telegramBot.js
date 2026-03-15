"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.telegramBot = exports.TelegramBot = void 0;
// integrations/telegram/telegramBot.ts — Telegram bot with streaming edit pattern
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function loadConfig() {
    const configPath = path.join(process.cwd(), 'config/integrations.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return config.telegram || {};
}
class TelegramBot {
    constructor() {
        this.bot = null;
        this.config = {};
    }
    async start() {
        this.config = loadConfig();
        if (!this.config.enabled || !this.config.botToken) {
            console.log('[TelegramBot] Disabled — set enabled:true and botToken in config/integrations.json');
            return;
        }
        const TelegramBotAPI = require('node-telegram-bot-api');
        this.bot = new TelegramBotAPI(this.config.botToken, { polling: true });
        console.log('[TelegramBot] ✅ Started — polling for messages');
        this.bot.onText(/\/start/, async (msg) => {
            const chatId = msg.chat.id;
            if (!this.isAllowed(msg.from?.id)) {
                return this.bot.sendMessage(chatId, 'This DevOS instance is private.');
            }
            this.bot.sendMessage(chatId, 'DevOS is running. What do you need?\n\nCommands:\n/status — what\'s running\n/briefing — morning summary\n/help — all commands');
        });
        this.bot.onText(/\/status/, async (msg) => {
            if (!this.isAllowed(msg.from?.id))
                return;
            try {
                const { goalStore } = await Promise.resolve().then(() => __importStar(require('../../goals/goalStore')));
                const { missionState } = await Promise.resolve().then(() => __importStar(require('../../coordination/missionState')));
                const active = goalStore.listGoals('active').length;
                const missions = missionState.listMissions().filter((m) => m.status === 'active').length;
                this.bot.sendMessage(msg.chat.id, `DevOS Status\n\nActive goals: ${active}\nActive missions: ${missions}\nAPI: http://127.0.0.1:4200`);
            }
            catch {
                this.bot.sendMessage(msg.chat.id, 'Status unavailable.');
            }
        });
        this.bot.onText(/\/briefing/, async (msg) => {
            if (!this.isAllowed(msg.from?.id))
                return;
            try {
                const { morningBriefing } = await Promise.resolve().then(() => __importStar(require('../../personal/morningBriefing')));
                const briefing = await morningBriefing.generate();
                this.bot.sendMessage(msg.chat.id, briefing);
            }
            catch {
                this.bot.sendMessage(msg.chat.id, 'Briefing unavailable.');
            }
        });
        this.bot.onText(/\/stop (.+)/, async (msg, match) => {
            if (!this.isAllowed(msg.from?.id))
                return;
            try {
                const { autonomousMission } = await Promise.resolve().then(() => __importStar(require('../../coordination/autonomousMission')));
                await autonomousMission.cancelMission(match[1]);
                this.bot.sendMessage(msg.chat.id, `Mission ${match[1]} cancelled.`);
            }
            catch {
                this.bot.sendMessage(msg.chat.id, 'Could not cancel mission.');
            }
        });
        this.bot.onText(/\/help/, (msg) => {
            this.bot.sendMessage(msg.chat.id, 'DevOS Commands:\n/status — what\'s running\n/briefing — morning summary\n/stop <id> — cancel mission\n/help — this list\n\nOr just send a message to chat with DevOS.');
        });
        // Handle regular messages — stream via sequential edits
        this.bot.on('message', async (msg) => {
            if (msg.text?.startsWith('/'))
                return;
            if (!this.isAllowed(msg.from?.id))
                return;
            const chatId = msg.chat.id;
            // Send initial placeholder
            const sent = await this.bot.sendMessage(chatId, 'DevOS is thinking...');
            const messageId = sent.message_id;
            try {
                const { dialogueEngine } = await Promise.resolve().then(() => __importStar(require('../../personality/dialogueEngine')));
                let accumulated = '';
                let lastEdit = Date.now();
                for await (const token of dialogueEngine.chat(msg.text)) {
                    accumulated += token;
                    // Edit every 300ms to avoid Telegram rate limits
                    if (Date.now() - lastEdit > 300) {
                        try {
                            await this.bot.editMessageText(accumulated + '▌', { chat_id: chatId, message_id: messageId });
                            lastEdit = Date.now();
                        }
                        catch { /* ignore edit-too-similar errors */ }
                    }
                }
                // Final edit without cursor
                await this.bot.editMessageText(accumulated || 'Done.', { chat_id: chatId, message_id: messageId });
            }
            catch (e) {
                this.bot.editMessageText('Error: ' + (e?.message ?? String(e)), { chat_id: chatId, message_id: messageId }).catch(() => { });
            }
        });
        // Handle inline keyboard callback queries (approval buttons)
        this.bot.on('callback_query', async (query) => {
            const { telegramApproval } = await Promise.resolve().then(() => __importStar(require('./telegramApproval')));
            telegramApproval.handleCallbackQuery(query);
            this.bot.answerCallbackQuery(query.id);
        });
    }
    stop() {
        if (this.bot)
            this.bot.stopPolling();
    }
    getBot() {
        return this.bot;
    }
    isAllowed(userId) {
        if (!userId)
            return false;
        if (!this.config.allowedUserIds?.length)
            return true; // open if no restrictions set
        return this.config.allowedUserIds.includes(userId);
    }
    getPrimaryChatId() {
        return this.config.allowedUserIds?.[0] || null;
    }
}
exports.TelegramBot = TelegramBot;
exports.telegramBot = new TelegramBot();
