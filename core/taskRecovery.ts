// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/taskRecovery.ts — On-startup crash recovery.
// Finds tasks stuck in 'running' state (from a prior crash/restart)
// and re-executes them from the first incomplete step.

import { taskStateManager, TaskState } from './taskState'
import { livePulse }                    from '../coordination/livePulse'
import path                             from 'path'
import fs                               from 'fs'

export async function recoverTasks(): Promise<void> {
  const running = taskStateManager.getRunningTasks()

  if (running.length === 0) {
    console.log('[Recovery] No interrupted tasks found')
    return
  }

  console.log(`[Recovery] Found ${running.length} interrupted task(s) — recovering...`)

  for (const state of running) {
    try {
      await recoverSingleTask(state)
    } catch (e: any) {
      console.error(`[Recovery] Failed to recover task ${state.id}: ${e.message}`)
      taskStateManager.fail(state, `Recovery failed: ${e.message}`)
    }
  }
}

async function recoverSingleTask(state: TaskState): Promise<void> {
  console.log(`[Recovery] Recovering task ${state.id}: "${state.goal.slice(0, 50)}"`)

  // Check that the plan file still exists
  if (state.planId) {
    const planPath = path.join(process.cwd(), 'workspace', 'tasks', state.id, 'plan.json')
    if (!fs.existsSync(planPath)) {
      console.warn(`[Recovery] Plan missing for ${state.id} — marking failed`)
      taskStateManager.fail(state, 'Plan file missing on recovery')
      return
    }
  }

  const resumeFrom = taskStateManager.getResumePoint(state)
  console.log(`[Recovery] Task ${state.id} resuming from step ${resumeFrom}/${state.totalSteps}`)

  if (resumeFrom >= state.totalSteps) {
    console.log(`[Recovery] Task ${state.id} already complete — marking done`)
    taskStateManager.complete(state)
    return
  }

  // Dynamic imports to avoid circular dep issues
  try {
    const { executePlan } = await import('./agentLoop')

    // Load the saved plan.json
    const planPath  = path.join(process.cwd(), 'workspace', 'tasks', state.id, 'plan.json')
    const savedPlan = JSON.parse(fs.readFileSync(planPath, 'utf-8')) as any

    // Reconstruct a minimal AgentPlan from persisted data
    const agentPlan = {
      goal:               state.goal,
      requires_execution: true,
      plan: (savedPlan.phases || [])
        .flatMap((p: any, phaseIdx: number) =>
          (p.tools || []).map((tool: string, toolIdx: number) => ({
            step:        phaseIdx * 10 + toolIdx + 1,
            tool,
            input:       {},
            description: `Recovered: ${tool}`,
          })),
        ),
      planId:       state.planId,
      workspaceDir: path.join(process.cwd(), 'workspace', 'tasks', state.id),
      phases:       savedPlan.phases,
    }

    // Filter out steps with no actionable input — recovered steps built from
    // phase metadata alone have input:{} which most tools cannot act on.
    // If nothing valid remains, the task's work is already on disk — mark done.
    const validSteps = agentPlan.plan.filter(
      (s: any) => s.input && Object.keys(s.input).length > 0,
    )
    if (validSteps.length === 0) {
      console.log(`[Recovery] Task ${state.id} — no recoverable steps with inputs, marking complete`)
      taskStateManager.complete(state)
      return
    }
    agentPlan.plan = validSteps

    livePulse.act('Aiden', `Recovering task: ${state.goal.slice(0, 40)}`)

    await executePlan(
      agentPlan,
      (step, result) => {
        // No SSE stream available on recovery — log to console only
        console.log(`[Recovery] Step ${step.step}: ${step.tool} — ${result.success ? '✓' : '✗'}`)
      },
      (phase) => {
        console.log(`[Recovery] Phase: ${phase.title}`)
      },
      state, // pass existing state so completed steps are skipped
    )

    taskStateManager.complete(state)
    console.log(`[Recovery] Task ${state.id} completed successfully`)

  } catch (e: any) {
    console.error(`[Recovery] Execution failed for ${state.id}: ${e.message}`)
    taskStateManager.fail(state, e.message)
  }
}
