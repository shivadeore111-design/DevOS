// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/multiGoalValidator.ts — Phase 1: Multi-goal coverage validator.
//
// After the responder finishes, this checks whether every goal that the
// planner decomposed was actually addressed in the final reply.  Uses
// keyword-overlap heuristics — no LLM, no new dependencies.
//
// Usage:
//   const { covered, missed } = validateMultiGoalCoverage(userMsg, reply, plan.goals)
//   if (!covered) { /* second-pass or log */ }

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GoalCoverageResult {
  /** True when every goal has sufficient keyword coverage in the response. */
  covered: boolean
  /** Goals that were NOT adequately addressed. */
  missed: string[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Stop-words to exclude from keyword matching
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'with', 'this', 'that', 'from', 'have',
  'will', 'was', 'what', 'how', 'when', 'why', 'who', 'can', 'you',
  'your', 'some', 'into', 'also', 'then', 'than', 'been', 'more',
  'they', 'them', 'its', 'our', 'their', 'does', 'did', 'just', 'but',
])

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w))
}

// Coverage threshold: a goal is "covered" when ≥40% of its keywords appear
// in the response. This is intentionally lenient — the LLM often rephrases.
const COVERAGE_THRESHOLD = 0.4

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Check whether `response` covers all items in `goals`.
 *
 * @param _userMessage - Original user message (reserved for future LLM upgrade)
 * @param response     - Full assistant reply to validate
 * @param goals        - Goal phrases from AgentPlan.goals
 */
export function validateMultiGoalCoverage(
  _userMessage: string,
  response:     string,
  goals:        string[],
): GoalCoverageResult {
  if (!goals || goals.length === 0) {
    return { covered: true, missed: [] }
  }

  const responseLower = response.toLowerCase()
  const missed: string[] = []

  for (const goal of goals) {
    const keywords = extractKeywords(goal)
    if (keywords.length === 0) continue   // nothing to check

    const hits = keywords.filter(kw => responseLower.includes(kw)).length
    const ratio = hits / keywords.length

    if (ratio < COVERAGE_THRESHOLD) {
      missed.push(goal)
    }
  }

  return { covered: missed.length === 0, missed }
}
