// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/heartbeat.ts — Per-goal liveness monitor with limit enforcement

import { resourceManager } from "../devos/runtime/resourceManager"
import { budgetManager }   from "../control/budgetManager"
import { emergencyStop }   from "../control/emergencyStop"
import { eventBus }        from "./eventBus"

const DEFAULT_INTERVAL_MS = 5_000

export class Heartbeat {
  private timers = new Map<string, ReturnType<typeof setInterval>>()

  // ── Start / stop ─────────────────────────────────────────

  start(goalId: string, intervalMs = DEFAULT_INTERVAL_MS): void {
    if (this.timers.has(goalId)) return   // already running

    const timer = setInterval(() => this.tick(goalId), intervalMs)
    // Allow Node to exit even if heartbeat is still running
    if (timer.unref) timer.unref()
    this.timers.set(goalId, timer)
    console.log(`[Heartbeat] Started for ${goalId} (every ${intervalMs}ms)`)
  }

  stop(goalId: string): void {
    const timer = this.timers.get(goalId)
    if (!timer) return
    clearInterval(timer)
    this.timers.delete(goalId)
    console.log(`[Heartbeat] Stopped for ${goalId}`)
  }

  stopAll(): void {
    for (const goalId of this.timers.keys()) {
      this.stop(goalId)
    }
  }

  // ── Tick ─────────────────────────────────────────────────

  private tick(goalId: string): void {
    const runtimeMs = resourceManager.getRuntimeMs(goalId)
    let   stopped   = false

    // Resource limit check
    const resCheck = resourceManager.checkLimits(goalId)
    if (resCheck.exceeded) {
      console.warn(`[Heartbeat] Resource limit exceeded for ${goalId}: ${resCheck.reason}`)
      emergencyStop.stop(goalId).catch(() => {})
      this.stop(goalId)
      stopped = true
    }

    // Budget limit check
    if (!stopped) {
      const budCheck = budgetManager.canContinue(goalId)
      if (!budCheck.allowed) {
        console.warn(`[Heartbeat] Budget limit exceeded for ${goalId}: ${budCheck.reason}`)
        emergencyStop.stop(goalId).catch(() => {})
        this.stop(goalId)
        stopped = true
      }
    }

    // Emit heartbeat event
    eventBus.emit("heartbeat", {
      goalId,
      runtimeMs,
      status: stopped ? "stopped" : "alive",
    })
  }
}

export const heartbeat = new Heartbeat()
