// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// bin/npx-init.ts — Entry point for `npx devos` / first-run bootstrap.
//
// Sprint 24: Setup wizard runs as FIRST step before coreBoot, so every
// new user gets hardware detection + model selection on their first run.

import { isSetupComplete, runSetupWizard } from '../core/setupWizard'

async function main(): Promise<void> {
  // ── Step 1: First-boot setup (Sprint 24) ──────────────────
  // Runs on every fresh machine; skipped immediately if already complete.
  if (!isSetupComplete()) {
    await runSetupWizard()
  }

  // ── Step 2: Core boot (full DevOS initialisation) ─────────
  // coreBoot() is defined in the full host implementation.
  // Importing dynamically so this file compiles in the sandbox
  // without the full module graph.
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — coreBoot is only available in the full host implementation
    const { coreBoot } = await import('../core/coreBoot')
    await coreBoot()
  } catch (err: any) {
    // coreBoot not available in sandbox — this is expected
    if (process.env.NODE_ENV !== 'test') {
      console.error(`[npx-init] coreBoot unavailable: ${err?.message}`)
    }
  }
}

main().catch(err => {
  console.error('[npx-init] Fatal:', err)
  process.exit(1)
})
