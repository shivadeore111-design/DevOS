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
import { missionCanvas }  from '../coordination/missionCanvas'
import { memoryLayers }   from '../memory/memoryLayers'

// ── CoordinationResult ────────────────────────────────────────

export interface CoordinationResult {
  missionId:  string
  goal:       string
  summary:    string
  rounds:     number
  success:    boolean
}

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

  // ── run() — Sprint 14: standalone mission loop ───────────────
  //
  // Creates its own missionId + canvas, runs up to 5 CEO→agent rounds,
  // parses CEO assignments, writes final summary to memoryLayers.

  async run(goal: string, description: string): Promise<CoordinationResult> {
    const missionId = `mission_${Date.now()}`
    missionCanvas.create(missionId, goal)

    console.log(`[CoordinationLoop] 🚀 Mission ${missionId} — "${goal}"`)

    let summary  = ''
    let roundNum = 0
    const MAX_ROUNDS = 5

    for (let round = 0; round < MAX_ROUNDS; round++) {
      roundNum = round + 1
      console.log(`[CoordinationLoop] 🔄 Round ${roundNum}/${MAX_ROUNDS}`)

      // ── CEO plans assignments ──────────────────────────────
      const ceoPrompt =
        `Goal: ${goal}\n` +
        `Description: ${description}\n\n` +
        `Round ${roundNum} of ${MAX_ROUNDS}. ` +
        `Plan the agent assignments needed. ` +
        `For each assignment, output a line: ASSIGN: <role> | <task description>\n` +
        `Valid roles: ceo, software-engineer, frontend-developer, backend-developer, ` +
        `devops-engineer, qa-engineer, researcher, marketing-strategist, ux-designer\n` +
        `If the goal is complete, output: STATUS: complete`

      const ceoResult = await agentExecutor.execute('ceo', ceoPrompt, missionId)
      agentMessenger.send('ceo', 'all', ceoResult.output.slice(0, 200), 'result')

      // ── Check for completion signal ────────────────────────
      if (/STATUS:\s*complete/i.test(ceoResult.output)) {
        console.log(`[CoordinationLoop] ✅ CEO declared mission complete (round ${roundNum})`)
        summary = ceoResult.output
        break
      }

      // ── Parse ASSIGN: <role> | <task> directives ──────────
      const assignPattern = /ASSIGN:\s*([a-z-]+)\s*\|\s*(.+)/gi
      const assignments: Array<{ role: string; task: string }> = []
      let m: RegExpExecArray | null
      while ((m = assignPattern.exec(ceoResult.output)) !== null) {
        assignments.push({ role: m[1].trim().toLowerCase(), task: m[2].trim() })
      }

      if (assignments.length === 0) {
        console.log(`[CoordinationLoop] ⚠️  No assignments parsed in round ${roundNum}; continuing`)
        summary = ceoResult.output
        // Still continue — CEO may not have used the format precisely
      }

      // ── Execute each assigned agent ────────────────────────
      for (const { role, task } of assignments) {
        if (!this.running) break
        console.log(`[CoordinationLoop]   ▶ ${role}: ${task.slice(0, 60)}`)
        const result = await agentExecutor.execute(role as AgentRole, task, missionId)
        agentMessenger.send(
          role as AgentRole, 'ceo',
          result.output.slice(0, 200),
          'result',
        )
      }

      summary = ceoResult.output
    }

    // ── Write final summary to memoryLayers ──────────────────
    const finalSummary = `Mission complete: ${goal}\nRounds: ${roundNum}\nSummary: ${summary.slice(0, 300)}`
    await memoryLayers.write(finalSummary, ['mission', 'completed'])

    console.log(`[CoordinationLoop] 🏁 Mission ${missionId} done in ${roundNum} round(s)`)

    return {
      missionId,
      goal,
      summary:  summary.slice(0, 500),
      rounds:   roundNum,
      success:  true,
    }
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
