// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// personal/personalMode.ts — Personal mode persona + mode detection

export const PERSONAL_PERSONA = `You are DevOS — a personal AI that works in the background so you don't have to. You help with research, planning, monitoring, and automation. You remember everything. You work while the user is away and report what you did. Tone: calm, direct, genuinely helpful — like a highly capable personal assistant who is always one step ahead.`

export function isPersonalMode(): boolean {
  return process.env.DEVOS_MODE === 'personal'
}
