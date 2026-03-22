// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// goals/goalEngine.ts — Main Goal Engine orchestrator

import { goalStore }    from './goalStore'
import { goalPlanner }  from './goalPlanner'
import { goalExecutor } from './goalExecutor'
import { Goal, GoalStatus, Project, Task } from './types'

export class GoalEngine {

  async run(title: string, description: string): Promise<Goal> {
    // 1. Create goal
    const goal = goalStore.createGoal(title, description)
    console.log(`[GoalEngine] 🎯 New goal: ${title} (${goal.id})`)

    // 2. Plan it (may set status to 'paused' if confidence < 0.7)
    await goalPlanner.plan(goal.id)

    // Check whether planner paused the goal for clarification
    const afterPlan = goalStore.getGoal(goal.id)!
    if (afterPlan.status === 'paused') {
      console.log(`[GoalEngine] ⏸  Goal needs clarification before execution.`)
      if (afterPlan.clarification) {
        console.log(`[GoalEngine] ❓ ${afterPlan.clarification}`)
      }
      return afterPlan
    }

    // 3. Execute it
    await goalExecutor.execute(goal.id)

    // 4. Return final goal state
    return goalStore.getGoal(goal.id)!
  }

  async list(status?: GoalStatus): Promise<Goal[]> {
    return goalStore.listGoals(status)
  }

  async getStatus(goalId: string): Promise<{ goal: Goal; projects: Project[]; tasks: Task[] }> {
    const goal     = goalStore.getGoal(goalId)!
    const projects = goalStore.listProjects(goalId)
    const tasks    = projects.flatMap(p => goalStore.listTasks(p.id))
    return { goal, projects, tasks }
  }

  /**
   * Pause an actively running goal.
   * Signals the executor to stop after the current task wave completes.
   */
  async pause(goalId: string): Promise<void> {
    const goal = goalStore.getGoal(goalId)
    if (!goal) throw new Error(`[GoalEngine] Goal not found: ${goalId}`)
    goalExecutor.pause(goalId)
    goalStore.updateGoal(goalId, { status: 'paused' })
    console.log(`[GoalEngine] ⏸  Paused goal: ${goal.title}`)
  }

  /**
   * Resume a paused goal — re-enters the executor from where it left off.
   * Returns immediately; execution continues asynchronously.
   */
  async resume(goalId: string): Promise<void> {
    const goal = goalStore.getGoal(goalId)
    if (!goal) throw new Error(`[GoalEngine] Goal not found: ${goalId}`)
    goalExecutor.resume(goalId).catch((err: any) =>
      console.error(`[GoalEngine] Resume error: ${err?.message ?? err}`)
    )
    console.log(`[GoalEngine] ▶️  Resuming goal: ${goal.title}`)
  }

  /**
   * Replan a failed/paused goal — resets failed tasks and re-runs from the
   * beginning of each incomplete project.
   */
  async replan(goalId: string): Promise<void> {
    const goal = goalStore.getGoal(goalId)
    if (!goal) throw new Error(`[GoalEngine] Goal not found: ${goalId}`)
    await goalPlanner.replan(goalId)
    goalExecutor.resume(goalId).catch((err: any) =>
      console.error(`[GoalEngine] Replan resume error: ${err?.message ?? err}`)
    )
    console.log(`[GoalEngine] ♻️  Replanned and resuming: ${goal.title}`)
  }
}

export const goalEngine = new GoalEngine()
