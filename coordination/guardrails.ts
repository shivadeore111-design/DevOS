// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// coordination/guardrails.ts — Safety limits for long-running missions

import { eventBus } from '../core/eventBus'

const LIMITS = {
  maxLoopsPerMission:  20,
  maxTokensPerMission: 50000,
  maxRetriesPerTask:   3,
  taskTimeoutMs:       300000,   // 5 minutes
  missionTimeoutMs:    7200000,  // 2 hours
}

class Guardrails {

  checkLoopLimit(missionId: string, currentLoops: number): { ok: boolean; reason?: string } {
    if (currentLoops >= LIMITS.maxLoopsPerMission) {
      const reason = `Loop limit reached (${currentLoops}/${LIMITS.maxLoopsPerMission})`
      console.warn(`[Guardrails] ⚠️  ${reason} for mission ${missionId}`)
      eventBus.emit('mission:limit_reached', { missionId, reason })
      return { ok: false, reason }
    }
    return { ok: true }
  }

  checkTokenBudget(missionId: string, tokensUsed: number): { ok: boolean; remaining: number } {
    const remaining = LIMITS.maxTokensPerMission - tokensUsed
    if (remaining <= 0) {
      const reason = `Token budget exhausted (${tokensUsed}/${LIMITS.maxTokensPerMission})`
      console.warn(`[Guardrails] ⚠️  ${reason} for mission ${missionId}`)
      eventBus.emit('mission:limit_reached', { missionId, reason })
      return { ok: false, remaining: 0 }
    }
    return { ok: true, remaining }
  }

  checkTaskTimeout(taskStartedAt: string): { ok: boolean; elapsedMs: number } {
    const elapsedMs = Date.now() - new Date(taskStartedAt).getTime()
    if (elapsedMs >= LIMITS.taskTimeoutMs) {
      console.warn(`[Guardrails] ⚠️  Task timeout exceeded (${elapsedMs}ms)`)
      return { ok: false, elapsedMs }
    }
    return { ok: true, elapsedMs }
  }

  checkMissionTimeout(missionStartedAt: string): { ok: boolean } {
    const elapsedMs = Date.now() - new Date(missionStartedAt).getTime()
    if (elapsedMs >= LIMITS.missionTimeoutMs) {
      const reason = `Mission timeout exceeded (${Math.round(elapsedMs / 60000)}m)`
      console.warn(`[Guardrails] ⚠️  ${reason}`)
      return { ok: false }
    }
    return { ok: true }
  }

  shouldEscalate(taskId: string, retryCount: number): boolean {
    if (retryCount >= LIMITS.maxRetriesPerTask) {
      console.warn(`[Guardrails] ⚠️  Task ${taskId} hit max retries (${retryCount})`)
      return true
    }
    return false
  }
}

export const guardrails = new Guardrails()
