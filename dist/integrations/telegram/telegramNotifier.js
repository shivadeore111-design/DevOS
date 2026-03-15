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
exports.telegramNotifier = exports.TelegramNotifier = void 0;
// integrations/telegram/telegramNotifier.ts — Event-driven push notifications via Telegram
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const eventBus_1 = require("../../core/eventBus");
const telegramBot_1 = require("./telegramBot");
function loadConfig() {
    const configPath = path.join(process.cwd(), 'config/integrations.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return config.telegram || {};
}
class TelegramNotifier {
    constructor() {
        this.config = {};
    }
    start() {
        this.config = loadConfig();
        if (!this.config.enabled)
            return;
        eventBus_1.eventBus.on('goal:completed', (data) => {
            if (!this.config.notifyOnGoalComplete)
                return;
            this.notify(`✅ ${data.title || 'Goal'} finished.${data.result ? ' ' + String(data.result).slice(0, 80) : ''}`);
        });
        eventBus_1.eventBus.on('goal:failed', (data) => {
            this.notify(`❌ ${data.title || 'Goal'} failed.${data.error ? ' ' + String(data.error).slice(0, 80) : ''} Reply with goal ID to retry.`);
        });
        eventBus_1.eventBus.on('mission:complete', (data) => {
            if (!this.config.notifyOnMissionComplete)
                return;
            this.notify(`🚀 Mission complete: ${data.goal || data.missionId}`);
        });
        eventBus_1.eventBus.on('mission:limit_reached', (data) => {
            this.notify(`⚠️ Mission hit a limit: ${data.reason || 'unknown'}. Open dashboard to review.`);
        });
        eventBus_1.eventBus.on('pilot_completed', (data) => {
            if (!this.config.notifyOnPilotComplete)
                return;
            this.notify(`🔍 ${data.pilotId || 'Pilot'} completed a run.`);
        });
        eventBus_1.eventBus.on('devos_proactive', (data) => {
            if (data.message)
                this.notify(data.message);
        });
        eventBus_1.eventBus.on('approval_required', async (data) => {
            if (!this.config.requireApprovalForDangerous)
                return;
            const { telegramApproval } = await Promise.resolve().then(() => __importStar(require('./telegramApproval')));
            telegramApproval.requestViaBot(data.actionDescription, data.taskId);
        });
        console.log('[TelegramNotifier] ✅ Listening for events');
    }
    async notify(message) {
        const chatId = telegramBot_1.telegramBot.getPrimaryChatId();
        if (!chatId)
            return;
        const bot = telegramBot_1.telegramBot.getBot();
        if (!bot)
            return;
        try {
            await bot.sendMessage(chatId, message);
        }
        catch (e) {
            console.error('[TelegramNotifier] Failed to send:', e?.message ?? String(e));
        }
    }
}
exports.TelegramNotifier = TelegramNotifier;
exports.telegramNotifier = new TelegramNotifier();
