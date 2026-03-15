// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// goals/goalExecutor.ts — Executes Goal→Project→Task hierarchy via Runner

import * as path         from 'path'
import { Runner }        from '../core/runner'
import { DevOSEngine }   from '../executor/engine'
import { eventBus }      from '../core/eventBus'
import { goalStore }     from './goalStore'
import { Task }          from './types'

export class GoalExecutor {
  /** Goals currently paused (goalId set) */
  private paused = new Set<string>()

  private makeRunner(agentId: string): Runner {
    const ws     = path.join(process.cwd(), 'workspace', 'sandbox')
    const engine = new DevOSEngine(ws, false)
    return new Runner({ agentId, engine })
  }

  /** Execute a single task description via the Runner */
  private async runTask(
    task: Task,
    goalTitle: string,
    goalDescription: string,
    projectTitle: string,
  ): Promise<{ success: boolean; result?: string; error?: string }> {
    try {
      const runner = this.makeRunner(`goal-exec-${task.id}`)

      const goalContext = `Goal: ${goalTitle}
Description: ${goalDescription}
Project: ${projectTitle}
Task: ${task.title}
Instructions: ${task.description}

Execute this specific task as part of the larger goal. Use file_write, shell_exec, or other appropriate actions.`

      const devTask = await runner.runOnce(goalContext)
      if (devTask.status === 'completed') {
        return { success: true, result: JSON.stringify((devTask as any).output ?? devTask.result ?? 'done') }
      }
      return { success: false, error: (devTask as any).error ?? 'Task runner returned failure' }
    } catch (err: any) {
      return { success: false, error: err?.message ?? String(err) }
    }
  }

  async execute(goalId: string): Promise<void> {
    const goal = goalStore.getGoal(goalId)
    if (!goal) throw new Error(`[GoalExecutor] Goal not found: ${goalId}`)

    console.log(`[GoalExecutor] 🚀 Executing goal: ${goal.title}`)

    const projects = goalStore.listProjects(goalId)
    let   goalFailed = false

    for (const project of projects) {
      if (this.paused.has(goalId)) {
        console.log(`[GoalExecutor] ⏸  Goal paused: ${goal.title}`)
        goalStore.updateGoal(goalId, { status: 'paused' })
        return
      }

      goalStore.updateProject(project.id, { status: 'active' })

      // Execute all ready tasks in the project (loop until none left)
      let iterations = 0
      while (true) {
        if (this.paused.has(goalId)) break

        const readyTasks = goalStore.listReadyTasks(project.id)
        if (readyTasks.length === 0) break
        if (iterations++ > 1000) { console.warn('[GoalExecutor] ⚠️  Max iterations reached'); break }

        for (const task of readyTasks) {
          if (this.paused.has(goalId)) break

          goalStore.updateTask(task.id, { status: 'active' })
          console.log(`[GoalExecutor]   ▶ Task: ${task.title}`)

          let attempt = await this.runTask(task, goal.title, goal.description, project.title)

          if (!attempt.success && task.retryCount < task.maxRetries) {
            console.warn(`[GoalExecutor]   🔄 Retrying task: ${task.title}`)
            goalStore.updateTask(task.id, { retryCount: task.retryCount + 1 })
            attempt = await this.runTask(task, goal.title, goal.description, project.title)
          }

          if (attempt.success) {
            goalStore.updateTask(task.id, {
              status:      'completed',
              result:      attempt.result,
              completedAt: new Date(),
            })
            eventBus.emit('task_completed', { taskId: task.id, goalId, title: task.title })
            console.log(`[GoalExecutor]   ✅ ${task.title}`)
          } else {
            goalStore.updateTask(task.id, {
              status: 'failed',
              error:  attempt.error,
            })
            eventBus.emit('task_failed', { taskId: task.id, goalId, title: task.title, error: attempt.error })
            console.error(`[GoalExecutor]   ❌ ${task.title}: ${attempt.error}`)
            goalFailed = true
          }
        }
      }

      // Determine project completion
      const allTasks     = goalStore.listTasks(project.id)
      const projectFailed = allTasks.some(t => t.status === 'failed')
      goalStore.updateProject(project.id, {
        status:      projectFailed ? 'failed' : 'completed',
        completedAt: projectFailed ? undefined : new Date(),
      })
    }

    if (goalFailed) {
      goalStore.updateGoal(goalId, { status: 'failed', updatedAt: new Date() })
      eventBus.emit('goal_failed', { goalId, title: goal.title })
      console.error(`[GoalExecutor] ❌ Goal failed: ${goal.title}`)
    } else {
      goalStore.updateGoal(goalId, {
        status:      'completed',
        completedAt: new Date(),
        updatedAt:   new Date(),
      })
      eventBus.emit('goal_completed', { goalId, title: goal.title })
      console.log(`[GoalExecutor] ✅ Goal complete: ${goal.title}`)
    }
  }

  pause(goalId: string): void {
    this.paused.add(goalId)
    console.log(`[GoalExecutor] ⏸  Paused: ${goalId}`)
  }

  async resume(goalId: string): Promise<void> {
    this.paused.delete(goalId)
    const goal = goalStore.getGoal(goalId)
    if (goal?.status === 'paused') {
      goalStore.updateGoal(goalId, { status: 'active' })
    }
    console.log(`[GoalExecutor] ▶️  Resuming: ${goalId}`)
    await this.execute(goalId)
  }
}

export const goalExecutor = new GoalExecutor()
