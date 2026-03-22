// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/heartbeat.ts — Per-goal liveness monitor with limit enforcement

import { resourceManager } from "../devos/runtime/resourceManager"
import { budgetManager }   from "../control/budgetManager"
import { emergencyStop }   from "../control/emergencyStop"
import { eventBus }        from "./eventBus"
import { taskPulse }       from "./taskPulse"

const DEFAULT_INTERVAL_MS = 5_000
const TASKPULSE_EVERY     = 60    // ticks: 60 × 5s = 5 minutes

export class Heartbeat {
  private timers    = new Map<string, ReturnType<typeof setInterval>>()
  private tickCount = new Map<string, number>()   // per-goal tick counter

  // ── Start / stop ─────────────────────────────────────────

  start(goalId: string, intervalMs = DEFAULT_INTERVAL_MS): void {
    if (this.timers.has(goalId)) return   // already running

    this.tickCount.set(goalId, 0)
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
    this.tickCount.delete(goalId)
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

    // ── TaskPulse: check every TASKPULSE_EVERY ticks (5 minutes) ──
    const count = (this.tickCount.get(goalId) ?? 0) + 1
    this.tickCount.set(goalId, count)
    if (count % TASKPULSE_EVERY === 0) {
      taskPulse.processTasks().catch((err: Error) => {
        console.error(`[Heartbeat] TaskPulse error: ${err.message}`)
      })
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
