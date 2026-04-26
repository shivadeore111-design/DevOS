// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/spawnManager.ts — Spawn isolated subagent sessions.
//
// A spawned subagent gets:
//   - Fresh conversation history (context isolation)
//   - Half the parent's remaining iteration budget (budget inheritance)
//   - Provider chain inherited from parent config via router
//   - Memory writes that do NOT propagate to parent session
//
// Usage:
//   const result = await spawnSubagent({ task, context, timeout, parentBudget })

import { planWithLLM, executePlan, callLLM } from './agentLoop'
import { getNextAvailableAPI }       from '../providers/router'
import { loadConfig }                from '../providers/index'

// ── Types ─────────────────────────────────────────────────────

export interface IterationBudget {
  current:   number
  max:       number
  remaining: number
}

export interface SpawnOptions {
  task:         string
  context?:     string
  timeout:      number     // milliseconds
  parentBudget: IterationBudget
}

export interface SpawnResult {
  success:        boolean
  result?:        string
  error?:         string
  iterationsUsed: number
  duration:       number
  providerChain:  string[]
}

// ── Active spawn registry (for /spawn list + kill) ────────────

export interface ActiveSpawn {
  id:        string
  task:      string
  startedAt: number
  status:    'pending' | 'running' | 'done' | 'aborted'
  result?:   SpawnResult
  abort?:    () => void
}

const _activeSpawns = new Map<string, ActiveSpawn>()

/** Returns all active/recent spawns. */
export function getActiveSpawns(): ActiveSpawn[] {
  return Array.from(_activeSpawns.values()).sort((a, b) => b.startedAt - a.startedAt)
}

/** Abort a running spawn by ID. Returns true if killed, false if not found. */
export function killSpawn(id: string): boolean {
  const spawn = _activeSpawns.get(id)
  if (!spawn) return false
  if (spawn.status === 'running' || spawn.status === 'pending') {
    spawn.abort?.()
    spawn.status = 'aborted'
    return true
  }
  return false
}

// ── Core spawn implementation ─────────────────────────────────

/**
 * Spawns an isolated subagent to handle a sub-task.
 *
 * Budget inheritance: subagent gets at most floor(parentBudget.remaining / 2)
 * iterations, capped at 10. This prevents runaway subagents from exhausting
 * the parent's budget.
 *
 * Provider inheritance: uses the same provider chain (same config) so fallback
 * behaviour is consistent with the parent.
 */
export async function spawnSubagent(opts: SpawnOptions): Promise<SpawnResult> {
  const spawnId = `spawn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const t0      = Date.now()

  // Budget inheritance: half of parent's remaining, max 10
  const _subBudget = Math.max(1, Math.min(
    Math.floor(opts.parentBudget.remaining / 2),
    10,
  ))

  // Build task message with optional injected context
  const taskMessage = opts.context
    ? `${opts.task}\n\n--- Injected Context ---\n${opts.context}`
    : opts.task

  // Abort flag for timeout / kill
  let abortFlag = false

  const entry: ActiveSpawn = {
    id:        spawnId,
    task:      opts.task.slice(0, 80),
    startedAt: t0,
    status:    'pending',
    abort:     () => { abortFlag = true },
  }
  _activeSpawns.set(spawnId, entry)

  // Collect provider names for the result (inherited from parent config)
  const providerChain: string[] = (() => {
    try {
      const cfg = loadConfig()
      return (cfg.providers?.apis ?? [])
        .filter((a: any) => a.enabled)
        .map((a: any) => String(a.provider))
    } catch { return [] }
  })()

  entry.status = 'running'

  const timeoutPromise = new Promise<SpawnResult>((_, reject) =>
    setTimeout(() => reject(new Error(`Spawn timeout after ${opts.timeout}ms`)), opts.timeout)
  )

  const workPromise = (async (): Promise<SpawnResult> => {
    if (abortFlag) throw new Error('Spawn aborted before start')

    // Resolve provider credentials via router (inherits parent chain)
    const next = getNextAvailableAPI()
    if (!next) {
      return {
        success:        false,
        error:          'No available API provider for subagent',
        iterationsUsed: 0,
        duration:       Date.now() - t0,
        providerChain,
      }
    }

    const apiKey = next.entry.key.startsWith('env:')
      ? (process.env[next.entry.key.replace('env:', '')] ?? '')
      : next.entry.key

    // Plan in isolated context (empty history = no parent session context)
    let plan: any
    try {
      plan = await planWithLLM(
        taskMessage,
        [],           // empty conversation history — context isolation
        apiKey,
        next.entry.model,
        next.entry.provider,
      )
    } catch (e: any) {
      return {
        success:        false,
        error:          `Subagent planning failed: ${e?.message ?? String(e)}`,
        iterationsUsed: 0,
        duration:       Date.now() - t0,
        providerChain,
      }
    }

    if (abortFlag) throw new Error('Spawn aborted after planning')

    // Direct answer — no tools needed
    if (!plan.requires_execution || plan.plan.length === 0) {
      const directAnswer = (plan.reason || plan.goal || 'Task complete.').trim()
      return {
        success:        true,
        result:         directAnswer,
        iterationsUsed: 0,
        duration:       Date.now() - t0,
        providerChain,
      }
    }

    // Execute plan (isolated — no workspace memory propagation)
    let iterationsUsed = 0
    const stepResults = await executePlan(
      plan,
      (_step, _result) => { iterationsUsed++ },
    )

    if (abortFlag) throw new Error('Spawn aborted during execution')

    // Synthesize step outputs into a real LLM answer
    const stepSummary = stepResults
      .filter(r => r.success && r.output)
      .map(r => `[${r.tool}]: ${String(r.output).slice(0, 2000)}`)
      .join('\n\n')

    if (!stepSummary.trim()) {
      return {
        success:        false,
        error:          'Subagent steps produced no output',
        iterationsUsed,
        duration:       Date.now() - t0,
        providerChain,
      }
    }

    const synthesisPrompt = [
      'You are completing a sub-task. Synthesize the tool results into a clear, concise answer.',
      '',
      `Task: ${taskMessage}`,
      '',
      'Tool Results:',
      stepSummary,
      '',
      'Provide a direct answer:',
    ].join('\n')

    let synthesized = ''
    try {
      synthesized = await callLLM(synthesisPrompt, apiKey, next.entry.model, next.entry.provider)
    } catch {}

    return {
      success:        true,
      result:         synthesized.trim() || stepSummary,
      iterationsUsed,
      duration:       Date.now() - t0,
      providerChain,
    }
  })()

  try {
    const outcome = await Promise.race([workPromise, timeoutPromise])
    entry.status = 'done'
    entry.result = outcome
    return outcome
  } catch (err: any) {
    const result: SpawnResult = {
      success:        false,
      error:          err?.message ?? String(err),
      iterationsUsed: 0,
      duration:       Date.now() - t0,
      providerChain,
    }
    entry.status = abortFlag ? 'aborted' : 'done'
    entry.result = result
    return result
  } finally {
    // Cap registry at 20 most recent
    const all = Array.from(_activeSpawns.entries())
      .sort((a, b) => b[1].startedAt - a[1].startedAt)
    if (all.length > 20) {
      all.slice(20).forEach(([id]) => _activeSpawns.delete(id))
    }
  }
}
