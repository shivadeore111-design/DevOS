"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.goalGovernor = exports.GoalGovernor = void 0;
const LOOP_THRESHOLD = 3; // same summary N times → looping
const SIMILARITY_CHARS = 60; // prefix used for "identical goal" check
class GoalGovernor {
    constructor() {
        this.active = new Map();
    }
    // ── Registration ────────────────────────────────────────
    register(goalId, goal) {
        this.active.set(goalId, { goalId, goal, planHistory: [] });
        console.log(`[GoalGovernor] Registered: ${goalId} — "${goal.slice(0, 60)}"`);
    }
    unregister(goalId) {
        this.active.delete(goalId);
        console.log(`[GoalGovernor] Unregistered: ${goalId}`);
    }
    // ── Loop detection ──────────────────────────────────────
    checkLoop(goalId, planSummary) {
        const entry = this.active.get(goalId);
        if (!entry)
            return { looping: false };
        entry.planHistory.push(planSummary);
        // Keep a rolling window of the last 10 plans
        if (entry.planHistory.length > 10) {
            entry.planHistory.shift();
        }
        // Count how many of the last N plans are identical to the current one
        const matchCount = entry.planHistory.filter(s => s === planSummary).length;
        if (matchCount >= LOOP_THRESHOLD) {
            return {
                looping: true,
                reason: `Same plan summary seen ${matchCount} times for goal ${goalId}`,
            };
        }
        return { looping: false };
    }
    // ── Duplicate detection ─────────────────────────────────
    checkSimilarActive(goal) {
        const normalised = goal.trim().toLowerCase().slice(0, SIMILARITY_CHARS);
        for (const entry of this.active.values()) {
            const existing = entry.goal.trim().toLowerCase().slice(0, SIMILARITY_CHARS);
            if (existing === normalised) {
                return { duplicate: true, existingId: entry.goalId };
            }
        }
        return { duplicate: false };
    }
    // ── Diagnostics ─────────────────────────────────────────
    listActive() {
        return Array.from(this.active.values()).map(e => ({
            goalId: e.goalId,
            goal: e.goal,
        }));
    }
}
exports.GoalGovernor = GoalGovernor;
exports.goalGovernor = new GoalGovernor();
