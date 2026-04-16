// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/planResponseRepair.ts — Phase 1 of Prompt 10.
//
// When the planner LLM returns plain text instead of JSON,
// this module tries four escalating repairs before giving up.
// Prevents wasting 30-90 seconds on retries for valid answers.

export interface PlanRepairResult {
  plan:          any | null
  repaired:      boolean
  directAnswer?: string
}

/**
 * Salvage a non-JSON planner response:
 *   1. Direct JSON parse (already valid)
 *   2. Extract from ```json ... ``` fences
 *   3. Extract first {...} block
 *   4. Treat plain-text as a direct-answer plan
 */
export function repairPlanResponse(raw: string): PlanRepairResult {
  if (!raw || raw.trim().length === 0) {
    return { plan: null, repaired: false }
  }

  // Try 1: direct JSON parse
  try {
    const plan = JSON.parse(raw.trim())
    return { plan, repaired: false }
  } catch {}

  // Try 2: extract from ```json ... ``` fences (already done by caller's regex,
  // but replicated here so this function is self-contained)
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) {
    try {
      const plan = JSON.parse(fenceMatch[1].trim())
      return { plan, repaired: true }
    } catch {}
  }

  // Try 3: extract first {...} block
  const firstBrace = raw.indexOf('{')
  const lastBrace  = raw.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      const plan = JSON.parse(raw.slice(firstBrace, lastBrace + 1))
      return { plan, repaired: true }
    } catch {}
  }

  // Try 4: if the model answered directly (no JSON at all),
  // wrap as a direct-answer plan so the executor can return it immediately.
  // Heuristic: >10 chars, not an error message, not too long.
  const trimmed          = raw.trim()
  const looksLikeAnswer  =
    trimmed.length > 10 &&
    trimmed.length < 4000 &&
    !/^(error|failed|cannot|unable)/i.test(trimmed)

  if (looksLikeAnswer) {
    const directPlan = {
      goal:               trimmed.slice(0, 80),
      requires_execution: false,
      plan:               [],
      phases:             [],
      direct_response:    trimmed,
      reasoning:          'Model provided direct answer without structured plan',
    }
    return { plan: directPlan, repaired: true, directAnswer: trimmed }
  }

  return { plan: null, repaired: false }
}
