// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/agentLoop.ts — Observe → Plan → Act → Reflect execution loop

import crypto                           from "crypto"
import { AgentSession, sessionManager } from "./sessionManager"
import { eventBus }                     from "./eventBus"
import { goalGovernor }                 from "../control/goalGovernor"
import { emergencyStop }                from "../control/emergencyStop"
import { generatePlan }                 from "./planner_v2"
import { taskGraphBuilder }             from "./taskGraph"
import { createGraphExecutor }          from "./graphExecutor"
import { DevOSEngine }                  from "../executor/engine"

export interface LoopContext {
  session:        AgentSession
  iteration:      number
  maxIterations:  number
  lastResult:     any
  shouldContinue: boolean
}

const DEFAULT_MAX_ITERATIONS = 10

export class AgentLoop {
  private running = new Map<string, LoopContext>()

  // ── Main loop ────────────────────────────────────────────

  async run(
    goal:          string,
    sessionId:     string,
    maxIterations: number = DEFAULT_MAX_ITERATIONS,
  ): Promise<void> {
    const session = sessionManager.get(sessionId)
    if (!session) {
      console.error(`[AgentLoop] Session not found: ${sessionId}`)
      return
    }

    const ctx: LoopContext = {
      session,
      iteration:      0,
      maxIterations,
      lastResult:     null,
      shouldContinue: true,
    }
    this.running.set(sessionId, ctx)

    // SHA-256 plan hash ring — stores last 5 plan hashes for loop detection
    const planHashRing = new Set<string>()

    eventBus.emit("loop_started", { sessionId, goal, maxIterations })
    console.log(`[AgentLoop] Starting loop for "${goal}" — max ${maxIterations} iterations`)

    const workspace = session.workspacePath
    const engine    = new DevOSEngine(workspace)

    while (ctx.shouldContinue && ctx.iteration < ctx.maxIterations) {
      ctx.iteration++

      // ── Emergency stop check ───────────────────────────
      if (emergencyStop.isStopRequested(sessionId)) {
        console.log(`[AgentLoop] Emergency stop requested — halting loop`)
        ctx.shouldContinue = false
        break
      }

      console.log(`\n[AgentLoop] ── Iteration ${ctx.iteration}/${maxIterations} ──`)
      eventBus.emit("loop_iteration", { sessionId, iteration: ctx.iteration, goal })

      // ── OBSERVE ────────────────────────────────────────
      const observedContext = this.observe(ctx)

      // ── PLAN ───────────────────────────────────────────
      let plan: any
      try {
        plan = await generatePlan(observedContext.enrichedGoal)

        // Loop detection
        const loopCheck = goalGovernor.checkLoop(sessionId, plan.summary ?? observedContext.enrichedGoal)
        if (loopCheck.looping) {
          console.warn(`[AgentLoop] Loop detected: ${loopCheck.reason} — stopping`)
          sessionManager.addHistory(sessionId, "agent", `Loop detected: ${loopCheck.reason}`)
          ctx.shouldContinue = false
          break
        }

        // SHA-256 plan hash guard — detect repeated identical action sequences
        const planHash = crypto
          .createHash("sha256")
          .update(JSON.stringify(plan.actions ?? []))
          .digest("hex")

        if (planHashRing.has(planHash)) {
          console.warn(`[AgentLoop] 🔄 Loop detected — breaking (plan hash repeated)`)
          sessionManager.addHistory(sessionId, "agent", "Loop detected: identical plan generated twice")
          ctx.shouldContinue = false
          break
        }

        // Keep only the last 5 hashes
        planHashRing.add(planHash)
        if (planHashRing.size > 5) {
          const oldest = planHashRing.values().next().value as string
          planHashRing.delete(oldest)
        }
      } catch (err: any) {
        console.error(`[AgentLoop] Plan generation failed: ${err.message}`)
        sessionManager.addHistory(sessionId, "agent", `Plan failed: ${err.message}`)
        break
      }

      // ── ACT ────────────────────────────────────────────
      let success  = false
      let actError: string | undefined

      try {
        const graph    = taskGraphBuilder.fromPlan(sessionId, plan)
        const executor = createGraphExecutor(
          (action: any, wp: string) => engine.executeOne(action, wp, sessionId)
        )
        const result   = await executor.execute(graph, workspace)
        success        = result.success
        ctx.lastResult = result
        actError       = result.success ? undefined : `${result.nodesFailed} node(s) failed`
      } catch (err: any) {
        actError       = (err as Error).message
        ctx.lastResult = { success: false, error: actError }
      }

      // ── REFLECT ────────────────────────────────────────
      const reflection = this.reflect(ctx, success, actError)
      sessionManager.addHistory(sessionId, "agent", reflection.summary)

      if (reflection.goalComplete) {
        console.log(`[AgentLoop] ✅ Goal appears complete after iteration ${ctx.iteration}`)
        ctx.shouldContinue = false
      } else if (!success) {
        console.log(`[AgentLoop] ❌ Iteration ${ctx.iteration} failed: ${actError}`)
        // Continue — next iteration will re-plan with updated context
      }
    }

    // ── Loop finished ──────────────────────────────────────
    const finalStatus =
      emergencyStop.isStopRequested(sessionId) ? "stopped"
      : ctx.iteration >= ctx.maxIterations     ? "max_iterations"
      : "completed"

    console.log(`\n[AgentLoop] Loop ended — reason: ${finalStatus} (${ctx.iteration} iterations)`)
    eventBus.emit("loop_completed", { sessionId, goal, iterations: ctx.iteration, finalStatus })

    this.running.delete(sessionId)
  }

  // ── Control ───────────────────────────────────────────────

  stop(sessionId: string): void {
    const ctx = this.running.get(sessionId)
    if (ctx) {
      ctx.shouldContinue = false
      console.log(`[AgentLoop] Stop requested for session: ${sessionId}`)
      eventBus.emit("loop_stopped", { sessionId })
    }
  }

  isRunning(sessionId: string): boolean {
    return this.running.has(sessionId)
  }

  // ── Private: Observe ──────────────────────────────────────

  private observe(ctx: LoopContext): { enrichedGoal: string } {
    const { session, lastResult, iteration } = ctx
    const recentHistory = session.history
      .slice(-5)
      .map(h => `${h.role}: ${h.content}`)
      .join("\n")

    let enrichedGoal = session.goal

    if (iteration > 1 && lastResult) {
      const resultNote = lastResult.success
        ? `(Previous attempt completed ${lastResult.nodesCompleted ?? "some"} actions.)`
        : `(Previous attempt failed. Retry and fix.)`
      enrichedGoal = `${session.goal} ${resultNote}`
    }

    if (recentHistory) {
      enrichedGoal += `\n\nContext:\n${recentHistory}`
    }

    return { enrichedGoal }
  }

  // ── Private: Reflect ──────────────────────────────────────

  private reflect(
    ctx:      LoopContext,
    success:  boolean,
    error?:   string,
  ): { summary: string; goalComplete: boolean } {
    const { iteration, lastResult } = ctx

    if (success) {
      const nodesCompleted = lastResult?.nodesCompleted ?? 0
      const totalNodes     = lastResult?.totalNodes     ?? 0
      const summary        = `Iteration ${iteration}: completed ${nodesCompleted}/${totalNodes} actions successfully.`
      // Goal complete heuristic: all nodes finished cleanly
      const goalComplete   = nodesCompleted > 0 && nodesCompleted === totalNodes
      return { summary, goalComplete }
    }

    const summary = `Iteration ${iteration}: failed — ${error ?? "unknown error"}`
    return { summary, goalComplete: false }
  }
}

export const agentLoop = new AgentLoop()
