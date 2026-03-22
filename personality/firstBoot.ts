// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// personality/firstBoot.ts — First-run onboarding (max 3 questions)
//
// Asks 3 focused questions, saves UserProfile, marks onboardingDone = true.
// Never runs again after completion.
// Works both in CLI (readline) and as a chat API generator (yields strings).

import * as readline from 'readline'
import { userProfile } from './userProfile'

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise(resolve => rl.question(question, answer => resolve(answer.trim())))
}

class FirstBoot {

  /**
   * Run the onboarding flow.
   * Yields status strings for streaming to the caller.
   * Saves profile and marks onboardingDone = true.
   * Max 3 questions — respects the user's time.
   */
  async *run(): AsyncGenerator<string> {
    yield 'Welcome to DevOS — your autonomous AI operating system.\n'
    yield 'Quick setup — three questions.\n\n'

    const rl = readline.createInterface({
      input:  process.stdin,
      output: process.stdout,
    })

    try {
      // Q1: Name
      const rawName = await ask(rl, '1/ What should I call you? ')
      const name    = rawName || 'Builder'
      yield `\n`

      // Q2: What are they building
      const buildingAnswer = await ask(
        rl,
        `2/ What are you building, ${name}? (e.g. "a SaaS product", "internal tooling", "an AI agent") `,
      )
      yield `\n`

      // Q3: Enable autonomous pilots
      const pilotsAnswer  = await ask(
        rl,
        '3/ Enable autonomous pilots? Scheduled tasks that run in the background. [y/N] ',
      )
      const pilotsEnabled = /^y(es)?$/i.test(pilotsAnswer.trim())
      yield `\n`

      // ── Save profile ──────────────────────────────────────────────────
      userProfile.patch({
        name,
        primaryGoal:    buildingAnswer || undefined,
        pilotsEnabled,
        onboardingDone: true,
      })

      yield `Setup done. Welcome aboard, ${name}.\n`
      if (pilotsEnabled) {
        yield `Pilots are on — I'll run background tasks automatically.\n`
      }
      yield `\nTell me what to build and I'll get started.\n\n`

    } finally {
      rl.close()
    }
  }

  /** True if first-boot has already been completed */
  isDone(): boolean {
    return !userProfile.isFirstRun()
  }

  /** Reset onboarding (for testing or re-setup) */
  reset(): void {
    userProfile.patch({ onboardingDone: false, name: undefined })
  }
}

export const firstBoot = new FirstBoot()
