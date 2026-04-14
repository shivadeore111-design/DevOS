// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/parallelExecutor.ts — Types and constants for parallel
// step execution.  The actual grouping and dispatch live in
// agentLoop.ts (buildDependencyGroups + Promise.allSettled block)
// which already implements the full parallel pipeline.
//
// This module exports:
//   • ParallelGroup   — typed representation of a step batch
//   • MAX_PARALLEL    — hard cap per batch (prevents exhaustion)
//   • chunkSteps      — split an oversized group into safe chunks
//   • hasParallelism  — quick predicate for logging

import type { ToolStep } from './agentLoop'

// ── Constants ──────────────────────────────────────────────────

/** Hard cap on simultaneous tool calls per batch. */
export const MAX_PARALLEL = 3

// ── Types ──────────────────────────────────────────────────────

/**
 * A batch of steps that can be dispatched together.
 * `parallel` is true when the batch contains more than one step.
 */
export interface ParallelGroup {
  steps:     ToolStep[]
  parallel:  boolean    // true  → run with Promise.allSettled
  groupSize: number     // how many steps were originally in this group
}

// ── Utilities ──────────────────────────────────────────────────

/**
 * Split `steps` into sub-arrays of at most MAX_PARALLEL entries.
 * Used by agentLoop when a batch exceeds the safety limit.
 */
export function chunkSteps(steps: ToolStep[], maxSize: number = MAX_PARALLEL): ToolStep[][] {
  const chunks: ToolStep[][] = []
  for (let i = 0; i < steps.length; i += maxSize) {
    chunks.push(steps.slice(i, i + maxSize))
  }
  return chunks
}

/**
 * Returns true if any group in the provided list contains more
 * than one step — useful for conditional logging at the call site.
 */
export function hasParallelism(groups: ToolStep[][]): boolean {
  return groups.some(g => g.length > 1)
}

/**
 * Converts a raw `ToolStep[][]` (output of buildDependencyGroups)
 * into typed `ParallelGroup[]` for downstream consumers.
 */
export function toParallelGroups(groups: ToolStep[][]): ParallelGroup[] {
  return groups.map(steps => ({
    steps,
    parallel:  steps.length > 1,
    groupSize: steps.length,
  }))
}
