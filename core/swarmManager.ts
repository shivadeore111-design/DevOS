// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/swarmManager.ts — Parallel subagent orchestration with voting/merge/best.
//
// Runs N isolated subagents concurrently via Promise.allSettled, then
// aggregates results using one of three strategies:
//
//   vote   — LLM judge picks the best single answer (default)
//   merge  — Synthesise all successful answers into one
//   best   — Return ranked list of all successful results
//
// Budget: each swarm agent gets floor(parentBudget.remaining / (2 * N)), min 1, max 5.

import { spawnSubagent }          from './spawnManager'
import { getNextAvailableAPI }    from '../providers/router'
import { planWithLLM, getBudgetState } from './agentLoop'
import type { IterationBudget }   from './spawnManager'

// ── Types ─────────────────────────────────────────────────────

export type SwarmStrategy = 'vote' | 'merge' | 'best'

export interface SwarmOptions {
  task:         string
  n:            number            // number of parallel agents (2–5)
  strategy:     SwarmStrategy
  timeout:      number            // ms per agent (not total)
  parentBudget: IterationBudget
}

export interface SwarmResult {
  success:    boolean
  result?:    string
  error?:     string
  agentsRun:  number
  strategy:   SwarmStrategy
  duration:   number
}

// ── Core swarm implementation ─────────────────────────────────

/**
 * Spawns N subagents in parallel for the same task, then aggregates.
 *
 * Budget inheritance: each agent gets floor(parentBudget.remaining / (2*N)),
 * clamped to [1, 5].  Total budget consumed ≤ parentBudget.remaining / 2.
 */
export async function swarmSubagents(opts: SwarmOptions): Promise<SwarmResult> {
  const t0        = Date.now()
  const n         = Math.max(2, Math.min(opts.n, 5))
  const agentBudget = Math.max(1, Math.min(
    Math.floor(opts.parentBudget.remaining / (2 * n)),
    5,
  ))

  const agentOpts = Array.from({ length: n }, (_, i) => ({
    task:         `[Swarm agent ${i + 1}/${n}] ${opts.task}`,
    timeout:      opts.timeout,
    parentBudget: { ...opts.parentBudget, remaining: agentBudget * n },
  }))

  // Run all agents in parallel
  const settled = await Promise.allSettled(
    agentOpts.map(o => spawnSubagent(o)),
  )

  const successes = settled
    .filter((s): s is PromiseFulfilledResult<Awaited<ReturnType<typeof spawnSubagent>>> =>
      s.status === 'fulfilled' && s.value.success,
    )
    .map(s => s.value.result ?? '')
    .filter(r => r.length > 0)

  const agentsRun = settled.length

  if (!successes.length) {
    return {
      success:   false,
      error:     'All swarm agents failed',
      agentsRun,
      strategy:  opts.strategy,
      duration:  Date.now() - t0,
    }
  }

  // ── Aggregation ───────────────────────────────────────────────

  let finalResult = ''

  if (opts.strategy === 'best') {
    // Return all results ranked by length (proxy for completeness)
    const ranked = [...successes].sort((a, b) => b.length - a.length)
    finalResult = ranked
      .map((r, i) => `### Agent ${i + 1}\n${r}`)
      .join('\n\n---\n\n')
  } else if (opts.strategy === 'merge') {
    // Ask an LLM to synthesise
    finalResult = await aggregateWithLLM(
      opts.task,
      successes,
      'merge',
    ) ?? successes.join('\n\n---\n\n')
  } else {
    // vote — pick the single best answer
    if (successes.length === 1) {
      finalResult = successes[0]
    } else {
      finalResult = await aggregateWithLLM(
        opts.task,
        successes,
        'vote',
      ) ?? successes[0]
    }
  }

  return {
    success:   true,
    result:    finalResult,
    agentsRun,
    strategy:  opts.strategy,
    duration:  Date.now() - t0,
  }
}

// ── LLM aggregation helper ────────────────────────────────────

async function aggregateWithLLM(
  originalTask: string,
  answers:      string[],
  mode:         'vote' | 'merge',
): Promise<string | null> {
  try {
    const next = getNextAvailableAPI()
    if (!next) return null

    const apiKey = next.entry.key.startsWith('env:')
      ? (process.env[next.entry.key.replace('env:', '')] ?? '')
      : next.entry.key

    const numbered = answers.map((a, i) => `### Answer ${i + 1}\n${a}`).join('\n\n')

    const prompt = mode === 'vote'
      ? `You are a judge. The original task was:\n"${originalTask}"\n\nHere are ${answers.length} candidate answers:\n\n${numbered}\n\nSelect the single best answer. Respond with only that answer — no preamble.`
      : `You are a synthesiser. The original task was:\n"${originalTask}"\n\nHere are ${answers.length} answers:\n\n${numbered}\n\nMerge them into one comprehensive answer. Respond with only the merged answer.`

    const budget = getBudgetState() ?? { current: 1, max: 10, remaining: 2 }
    const plan = await planWithLLM(
      prompt,
      [],
      apiKey,
      next.entry.model,
      next.entry.provider,
    )

    // planWithLLM returns an AgentPlan — extract text from first respond step
    if (plan?.plan?.length) {
      const firstStep = plan.plan[0]
      if (firstStep?.tool === 'respond') return firstStep?.input?.message ?? null
    }
    return null
  } catch {
    return null
  }
}
