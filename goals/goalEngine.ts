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

    // 2. Plan it
    await goalPlanner.plan(goal.id)

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
}

export const goalEngine = new GoalEngine()
