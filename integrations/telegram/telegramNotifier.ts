// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// integrations/telegram/telegramNotifier.ts — LEGACY compatibility re-export
//
// Sprint 18.5 renamed this to botNotifier.ts.
// Existing imports of { telegramNotifier } / { TelegramNotifier } keep working.

export { botNotifier as telegramNotifier, BotNotifier as TelegramNotifier } from './botNotifier'
