// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// control/goalGovernor.ts — Detect duplicate goals and plan-level loops

interface ActiveGoal {
  goalId:       string
  goal:         string
  planHistory:  string[]   // recent plan summaries (for loop detection)
}

const LOOP_THRESHOLD      = 3   // same summary N times → looping
const SIMILARITY_CHARS    = 60  // prefix used for "identical goal" check

export class GoalGovernor {
  private active = new Map<string, ActiveGoal>()

  // ── Registration ────────────────────────────────────────

  register(goalId: string, goal: string): void {
    this.active.set(goalId, { goalId, goal, planHistory: [] })
    console.log(`[GoalGovernor] Registered: ${goalId} — "${goal.slice(0, 60)}"`)
  }

  unregister(goalId: string): void {
    this.active.delete(goalId)
    console.log(`[GoalGovernor] Unregistered: ${goalId}`)
  }

  // ── Loop detection ──────────────────────────────────────

  checkLoop(goalId: string, planSummary: string): { looping: boolean; reason?: string } {
    const entry = this.active.get(goalId)
    if (!entry) return { looping: false }

    entry.planHistory.push(planSummary)

    // Keep a rolling window of the last 10 plans
    if (entry.planHistory.length > 10) {
      entry.planHistory.shift()
    }

    // Count how many of the last N plans are identical to the current one
    const matchCount = entry.planHistory.filter(s => s === planSummary).length
    if (matchCount >= LOOP_THRESHOLD) {
      return {
        looping: true,
        reason:  `Same plan summary seen ${matchCount} times for goal ${goalId}`,
      }
    }

    return { looping: false }
  }

  // ── Duplicate detection ─────────────────────────────────

  checkSimilarActive(goal: string): { duplicate: boolean; existingId?: string } {
    const normalised = goal.trim().toLowerCase().slice(0, SIMILARITY_CHARS)

    for (const entry of this.active.values()) {
      const existing = entry.goal.trim().toLowerCase().slice(0, SIMILARITY_CHARS)
      if (existing === normalised) {
        return { duplicate: true, existingId: entry.goalId }
      }
    }

    return { duplicate: false }
  }

  // ── Diagnostics ─────────────────────────────────────────

  listActive(): Array<{ goalId: string; goal: string }> {
    return Array.from(this.active.values()).map(e => ({
      goalId: e.goalId,
      goal:   e.goal,
    }))
  }
}

export const goalGovernor = new GoalGovernor()
