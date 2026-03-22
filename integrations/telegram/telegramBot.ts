// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// integrations/telegram/telegramBot.ts — LEGACY compatibility re-export
//
// Sprint 18.5 replaced this with devosBot.ts.
// All existing imports of { telegramBot } / { TelegramBot } continue to work
// unchanged — they now point to the new DevosBot implementation.

export { devosBot as telegramBot, DevosBot as TelegramBot } from './devosBot'
