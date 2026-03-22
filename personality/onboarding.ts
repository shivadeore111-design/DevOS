// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// personality/onboarding.ts — First-run onboarding via readline (AsyncGenerator)

import * as readline from 'readline'
import { userProfile } from './userProfile'

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise(resolve => rl.question(question, answer => resolve(answer.trim())))
}

/**
 * Runs the interactive onboarding flow.
 * Yields status strings so callers can display progress.
 * Saves answers to userProfile and marks onboardingDone = true.
 */
export async function* runOnboarding(): AsyncGenerator<string> {
  yield '🤖 Welcome to DevOS — Autonomous AI Operating System\n'
  yield 'Let me learn a bit about you before we begin.\n\n'

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  try {
    // Question 1: Name
    const name = await ask(rl, '👤 What should I call you? ')
    const displayName = name || 'Builder'

    // Question 2: Primary goal / what they are building
    const primaryGoal = await ask(
      rl,
      `🎯 What are you building, ${displayName}? (e.g. "a SaaS product", "internal tools") `,
    )

    // Question 3: Enable pilots / automation
    const pilotsAnswer = await ask(
      rl,
      '⚡ Enable autonomous pilots? (scheduled tasks that run automatically) [y/N] ',
    )
    const pilotsEnabled = pilotsAnswer.toLowerCase() === 'y' || pilotsAnswer.toLowerCase() === 'yes'

    // Save to profile
    userProfile.patch({
      name:           displayName,
      primaryGoal:    primaryGoal || undefined,
      pilotsEnabled,
      onboardingDone: true,
    })

    yield `\n✅ Profile saved. Welcome aboard, ${displayName}!\n`

    if (pilotsEnabled) {
      yield '⚡ Pilots enabled — DevOS will run background tasks automatically.\n'
    } else {
      yield '🔒 Pilots disabled — you can enable them later with: devos profile pilots on\n'
    }

    yield '\nType your first goal to get started. Example:\n'
    yield '  devos goal "Build a REST API for a todo app in TypeScript"\n\n'

  } finally {
    rl.close()
  }
}
