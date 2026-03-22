// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// goals/goalExecutor.ts — Executes Goal→Project→Task hierarchy via Runner

import * as path              from 'path'
import * as os                from 'os'
import { Runner }             from '../core/runner'
import { DevOSEngine }        from '../executor/engine'
import { eventBus }           from '../core/eventBus'
import { goalStore }          from './goalStore'
import { Task, Goal }         from './types'
import { liveThinking }             from '../coordination/liveThinking'
import { livePulse }               from '../coordination/livePulse'
import { persistentMemory }         from '../memory/persistentMemory'
import { analyzeFailureAndRetry }   from '../core/smartRetry'
import { asyncExecutor }            from '../executor/asyncExecutor'

// ── DevOS Report helper ───────────────────────────────────────
function fireReport(goalId: string, goalTitle: string, finalStatus: string,
                    completedTasks: number, totalTasks: number, startMs: number): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const reportSkill = require('../skills/devos-report/index.js') as { run: (o: any) => { htmlPath: string; summary: string } }
    const result = reportSkill.run({
      goalId,
      type:           'goal',
      goalTitle,
      tasksCompleted: completedTasks,
      totalTasks,
      filesCreated:   [],        // best-effort — could wire file tracking later
      actions:        [],
      duration:       Date.now() - startMs,
      status:         finalStatus,
    })
    console.log(`[DevOSReport] Report: ${result.htmlPath}`)
    // Open in browser (fire-and-forget, ignore errors on headless envs)
    import('open').then(({ default: open }) => open(result.htmlPath)).catch(() => {})
  } catch { /* non-fatal */ }
}

export class GoalExecutor {
  /** Goals currently paused (goalId set) */
  private paused = new Set<string>()

  private makeRunner(agentId: string): Runner {
    const ws     = path.join(process.cwd(), 'workspace', 'sandbox')
    const engine = new DevOSEngine(ws, false)
    return new Runner({ agentId, engine, autoApprove: true })
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

      const IS_WIN  = process.platform === 'win32'
      const DESKTOP = path.join(os.homedir(), 'Desktop')

      const goalContext = `SYSTEM: ${IS_WIN ? 'Windows' : process.platform}
Desktop: ${DESKTOP}
Home: ${os.homedir()}
${IS_WIN ? 'Use Windows cmd commands. NEVER use Linux commands.' : ''}
Goal: ${goalTitle}
Description: ${goalDescription}
Project: ${projectTitle}
Task: ${task.title}
Instructions: ${task.description}

Execute using file_write or shell_exec with correct ${IS_WIN ? 'Windows' : 'Linux'} commands.`

      const devTask = await runner.runOnce(goalContext)
      if (devTask.status === 'completed') {
        return { success: true, result: JSON.stringify((devTask as any).output ?? devTask.result ?? 'done') }
      }
      return { success: false, error: (devTask as any).error ?? 'Task runner returned failure' }
    } catch (err: any) {
      return { success: false, error: err?.message ?? String(err) }
    }
  }

  /**
   * Execute a single task with smart retry logic.
   * Extracted so it can be called in parallel from runParallelLimited.
   */
  private async executeOneTask(
    initialTask: Task,
    goal:        Goal,
    projectTitle: string,
  ): Promise<void> {
    let task = initialTask

    goalStore.updateTask(task.id, { status: 'active' })
    console.log(`[GoalExecutor]   ▶ Task: ${task.title}`)
    liveThinking.think('Engineer', `Starting: ${task.title}`, task.goalId)

    let attempt = await this.runTask(task, goal.title, goal.description, projectTitle)

    // Smart retry: on failure, ask the LLM what went wrong and try a
    // different approach — rather than blindly re-running the same action.
    while (!attempt.success && task.retryCount < task.maxRetries) {
      console.log(`[GoalExecutor] 🧠 Analyzing failure for smart retry...`)

      const retryResult = await analyzeFailureAndRetry({
        taskTitle:       task.title,
        taskDescription: task.description,
        goalTitle:       goal.title,
        previousError:   attempt.error ?? 'unknown error',
        previousAction:  JSON.stringify((attempt as any).actions ?? []),
        attemptNumber:   task.retryCount + 1,
      })

      const updatedDescription =
        `${task.description}\n\nPREVIOUS ATTEMPT FAILED: ${attempt.error}\n` +
        `NEW APPROACH: Use ${retryResult.newAction} with: ${retryResult.newCommand}`

      task = {
        ...task,
        description:        updatedDescription,
        _smartRetryCommand: retryResult.newCommand,
        _smartRetryAction:  retryResult.newAction,
      } as typeof task

      goalStore.updateTask(task.id, { retryCount: task.retryCount + 1 })
      console.log(`[GoalExecutor] 🔄 Smart retry ${task.retryCount}: ${retryResult.reasoning}`)
      attempt = await this.runTask(task, goal.title, goal.description, projectTitle)
    }

    if (attempt.success) {
      goalStore.updateTask(task.id, {
        status:      'completed',
        result:      attempt.result,
        completedAt: new Date(),
      })
      eventBus.emit('task_completed', { taskId: task.id, goalId: task.goalId, title: task.title })
      liveThinking.done('Engineer', `Done: ${task.title}`, task.goalId)
      console.log(`[GoalExecutor]   ✅ ${task.title}`)
    } else {
      goalStore.updateTask(task.id, {
        status: 'failed',
        error:  attempt.error,
      })
      eventBus.emit('task_failed', { taskId: task.id, goalId: task.goalId, title: task.title, error: attempt.error })
      liveThinking.error('Engineer', `Failed: ${task.title} — ${attempt.error}`, task.goalId)
      console.error(`[GoalExecutor]   ❌ ${task.title}: ${attempt.error}`)
    }
  }

  async execute(goalId: string): Promise<void> {
    const goal    = goalStore.getGoal(goalId)
    if (!goal) throw new Error(`[GoalExecutor] Goal not found: ${goalId}`)
    const startMs = Date.now()

    console.log(`[GoalExecutor] 🚀 Executing goal: ${goal.title}`)
    liveThinking.act('CEO', `Goal started: ${goal.title}`, goalId)
    livePulse.act('ceo', `Goal started: ${goal.title}`, goalId)
    eventBus.emit('goal_started' as any, { goalId, title: goal.title })

    const projects = goalStore.listProjects(goalId)

    for (const project of projects) {
      if (this.paused.has(goalId)) {
        console.log(`[GoalExecutor] ⏸  Goal paused: ${goal.title}`)
        goalStore.updateGoal(goalId, { status: 'paused' })
        return
      }

      goalStore.updateProject(project.id, { status: 'active' })

      // Execute all ready tasks in waves; each wave runs up to 3 in parallel.
      // After each wave, newly unblocked tasks (dependencies satisfied) are re-checked.
      let iterations = 0
      while (true) {
        if (this.paused.has(goalId)) break

        const readyTasks = goalStore.listReadyTasks(project.id)
        if (readyTasks.length === 0) break
        if (iterations++ > 1000) { console.warn('[GoalExecutor] ⚠️  Max iterations reached'); break }

        console.log(`[GoalExecutor] ⚡ Running ${readyTasks.length} task(s) in parallel (max 3) — project: ${project.title}`)

        // Run ready tasks in parallel — limit 3 concurrent via asyncExecutor
        await asyncExecutor.runParallelLimited(
          readyTasks
            .filter(() => !this.paused.has(goalId))
            .map(task => () => this.executeOneTask(task, goal, project.title)),
          3,
        )
      }

      // Determine project completion — only fail if majority of tasks failed
      const allTasks        = goalStore.listTasks(project.id)
      const projCompleted   = allTasks.filter(t => t.status === 'completed').length
      const projFailed      = allTasks.filter(t => t.status === 'failed').length
      const projTotal       = allTasks.length
      const projFailRate    = projTotal > 0 ? projFailed / projTotal : 0
      const projectFailed   = projFailRate > 0.5
      goalStore.updateProject(project.id, {
        status:      projectFailed ? 'failed' : 'completed',
        completedAt: projectFailed ? undefined : new Date(),
      })
      if (projectFailed) {
        console.warn(`[GoalExecutor] ⚠️  Project "${project.title}" failed (${projFailed}/${projTotal} tasks failed)`)
      }
    }

    // Recount across all projects for final status decision
    const allProjects    = goalStore.listProjects(goalId)
    const allTasks       = allProjects.flatMap(p => goalStore.listTasks(p.id))
    const completedTasks = allTasks.filter(t => t.status === 'completed').length
    const failedTasks    = allTasks.filter(t => t.status === 'failed').length
    const totalTasks     = allTasks.length

    const successRate  = totalTasks > 0 ? completedTasks / totalTasks : 1
    const finalStatus  = successRate >= 0.5 ? 'completed' : 'failed'

    goalStore.updateGoal(goalId, {
      status:      finalStatus,
      completedAt: new Date(),
      updatedAt:   new Date(),
      result:      `${completedTasks}/${totalTasks} tasks completed`,
    })

    eventBus.emit(finalStatus === 'completed' ? 'goal_completed' : 'goal_failed' as any, {
      goalId, title: goal.title, result: `${completedTasks}/${totalTasks} tasks completed`
    })

    // Record to persistent memory for cross-session history
    await persistentMemory.recordGoal(goalId, goal.title, goal.description, finalStatus, totalTasks, completedTasks)

    console.log(`[GoalExecutor] ${finalStatus === 'completed' ? '✅' : '❌'} Goal ${finalStatus}: ${goal.title} (${completedTasks}/${totalTasks} tasks)`)

    // ── Generate HTML report (fire-and-forget) ─────────────
    fireReport(goalId, goal.title, finalStatus, completedTasks, totalTasks, startMs)
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
