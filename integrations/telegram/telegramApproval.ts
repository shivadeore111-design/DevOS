// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// integrations/telegram/telegramApproval.ts — LEGACY compatibility re-export
//
// Sprint 18.5 renamed this to botGate.ts.
// Existing imports of { telegramApproval } / { TelegramApproval } keep working.

export { botGate as telegramApproval, BotGate as TelegramApproval } from './botGate'
