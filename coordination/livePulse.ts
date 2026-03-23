// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// coordination/livePulse.ts — Real-time agent pulse / activity log.
//
// NOTE: This is the sandbox stub. The full WebSocket-based
// implementation lives at C:\Users\shiva\DevOS\coordination\livePulse.ts.
// This stub satisfies all imports from setupWizard.ts and is type-safe.

class LivePulse {
  act(agent: string, message: string): void {
    console.log(`[${agent}] ${message}`)
  }

  done(agent: string, message: string): void {
    console.log(`[${agent}] ✓ ${message}`)
  }

  error(agent: string, message: string): void {
    console.error(`[${agent}] ✗ ${message}`)
  }

  warn(agent: string, message: string): void {
    console.warn(`[${agent}] ⚠ ${message}`)
  }

  info(agent: string, message: string): void {
    console.log(`[${agent}] ℹ ${message}`)
  }
}

export const livePulse = new LivePulse()
