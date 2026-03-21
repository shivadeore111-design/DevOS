// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// agents/coordinationLoop.ts — Autonomous multi-agent coordination engine

import { goalEngine }    from '../goals/goalEngine'
import { goalStore }     from '../goals/goalStore'
import { agentExecutor } from './agentExecutor'
import { agentMessenger } from './agentMessenger'
import { AgentRole }     from './types'

export class CoordinationLoop {
  private running = false

  async start(goalId: string): Promise<void> {
    this.running = true
    console.log(`[CoordinationLoop] 🔄 Starting for goal: ${goalId}`)

    const { goal, projects, tasks } = await goalEngine.getStatus(goalId)

    // Phase 1: CEO plans
    agentMessenger.send(
      'user', 'ceo',
      `Execute this goal: ${goal.title} — ${goal.description}`,
      'instruction', goalId,
    )
    const ceoResult = await agentExecutor.assign(
      'ceo',
      { id: goalId, title: 'Plan goal', description: goal.description },
      goal.title,
    )
    agentMessenger.send('ceo', 'all', ceoResult, 'result', goalId)

    // Phase 2: Execute projects in order — assign to right agent by type
    for (const project of projects) {
      if (!this.running) break

      goalStore.updateProject(project.id, { status: 'active' })

      const role           = this.pickAgent(project.title)
      const projectTasks   = goalStore.listReadyTasks(project.id)

      for (const task of projectTasks) {
        if (!this.running) break

        agentMessenger.send(
          'ceo', role,
          `Handle this task: ${task.title}`,
          'instruction', task.id,
        )

        const result = await agentExecutor.assign(role, task, goal.title)
        goalStore.updateTask(task.id, { status: 'completed', result, completedAt: new Date() })
        agentMessenger.send(role, 'ceo', result, 'result', task.id)
      }

      goalStore.updateProject(project.id, { status: 'completed', completedAt: new Date() })
    }

    // Phase 3: CEO evaluates
    const finalStatus    = await goalEngine.getStatus(goalId)
    const completedCount = finalStatus.tasks.filter(t => t.status === 'completed').length
    agentMessenger.send(
      'ceo', 'user',
      `Goal complete. ${completedCount}/${finalStatus.tasks.length} tasks done.`,
      'result', goalId,
    )

    goalStore.updateGoal(goalId, { status: 'completed', completedAt: new Date() })
    console.log(`[CoordinationLoop] ✅ Goal completed: ${goal.title}`)
  }

  stop(): void {
    this.running = false
    console.log(`[CoordinationLoop] ⏹ Stopped`)
  }

  private pickAgent(projectTitle: string): AgentRole {
    const t = projectTitle.toLowerCase()
    if (t.includes('research') || t.includes('analyz') || t.includes('market'))    return 'researcher'
    if (t.includes('deploy')   || t.includes('infra')  || t.includes('server'))    return 'devops-engineer'
    if (t.includes('build')    || t.includes('code')   || t.includes('implement') ||
        t.includes('test'))                                                          return 'software-engineer'
    return 'software-engineer'  // default
  }
}

export const coordinationLoop = new CoordinationLoop()
