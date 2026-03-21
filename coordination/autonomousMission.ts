// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// coordination/autonomousMission.ts — Main mission orchestrator

import * as crypto       from 'crypto'
import * as fs           from 'fs'
import * as path         from 'path'
import { agentExecutor } from '../agents/agentExecutor'
import { AgentRole }     from '../agents/types'
import { eventBus }      from '../core/eventBus'
import { taskBus }       from './taskBus'
import { missionState, Mission, MissionType } from './missionState'
import { missionTodo, TodoItem }              from './missionTodo'
import { contextCompressor }                  from './contextCompressor'
import { guardrails }                         from './guardrails'
import { humanInTheLoop }                     from './humanInTheLoop'
import { liveThinking }                       from './liveThinking'
import { missionCanvas }                      from './missionCanvas'
import { agentDen }                           from '../agents/agentDen'

const VALID_ROLES: AgentRole[] = [
  'ceo', 'cto', 'software-engineer', 'frontend-developer', 'backend-developer',
  'devops-engineer', 'qa-engineer', 'security-engineer', 'data-scientist', 'ml-engineer',
  'product-manager', 'project-manager', 'ux-designer', 'technical-writer', 'researcher',
  'legal-advisor', 'finance-analyst', 'marketing-strategist', 'sales-agent', 'customer-support',
  'hr-manager', 'database-admin', 'api-specialist', 'cloud-architect', 'mobile-developer',
  'content-creator', 'seo-specialist', 'business-analyst', 'blockchain-developer', 'system-architect',
]

function toRole(raw: string): AgentRole {
  const lower = raw.toLowerCase() as AgentRole
  return VALID_ROLES.includes(lower) ? lower : 'software-engineer'
}

function detectMissionType(goal: string): MissionType {
  const g = goal.toLowerCase()
  if (g.includes('build') || g.includes('create') || g.includes('implement')) return 'build'
  if (g.includes('research') || g.includes('find') || g.includes('analyse') || g.includes('analyze')) return 'research'
  if (g.includes('automate') || g.includes('script') || g.includes('workflow')) return 'automate'
  if (g.includes('monitor') || g.includes('watch') || g.includes('alert')) return 'monitor'
  return 'personal'
}

// ── MissionLog helpers ─────────────────────────────────────────

function missionLogPath(missionId: string): string {
  return path.join(agentDen.getCEOMissionDir(missionId), 'missionlog.md')
}

function createMissionLog(
  missionId: string,
  goal:      string,
  tasks:     Array<{ title: string; agent: string }>,
): void {
  const lines = [
    `# Mission Log: ${goal}`,
    `**ID:** ${missionId}`,
    `**Started:** ${new Date().toISOString()}`,
    '',
    '## Tasks',
    ...tasks.map(t => `- [ ] [${t.agent}] ${t.title}`),
    '',
    '## Notes',
  ]
  fs.writeFileSync(missionLogPath(missionId), lines.join('\n'), 'utf-8')
  console.log(`[MissionLog] 📝 Created for mission ${missionId.slice(0, 8)}`)
}

function tickMissionLog(missionId: string, taskTitle: string, success: boolean): void {
  const logPath = missionLogPath(missionId)
  if (!fs.existsSync(logPath)) return
  try {
    const lines   = fs.readFileSync(logPath, 'utf-8').split('\n')
    const updated = lines.map(line => {
      if (line.includes(`] ${taskTitle}`) && line.includes('- [ ]')) {
        return success
          ? line.replace('- [ ]', '- [x]') + ' ✅'
          : line.replace('- [ ]', '- [~]') + ' ❌'
      }
      return line
    })
    fs.writeFileSync(logPath, updated.join('\n'), 'utf-8')
  } catch { /* non-fatal */ }
}

function readMissionLog(missionId: string): string {
  const logPath = missionLogPath(missionId)
  if (!fs.existsSync(logPath)) return ''
  try { return fs.readFileSync(logPath, 'utf-8') } catch { return '' }
}

// ── AutonomousMission class ────────────────────────────────────

class AutonomousMission {
  private paused   = new Set<string>()
  private cancelled = new Set<string>()

  async startMission(
    goal: string,
    description: string,
    options: { missionType?: MissionType } = {},
  ): Promise<Mission> {
    const missionId   = crypto.randomUUID()
    const missionType = options.missionType ?? detectMissionType(goal)
    const startedAt   = new Date().toISOString()

    console.log(`[Mission] 🚀 Starting mission: "${goal}"`)
    console.log(`[Mission]    ID: ${missionId}`)

    // ── Step 1: CEO decomposes goal ─────────────────────────
    liveThinking.think('ceo', `Decomposing: ${goal.slice(0, 60)}`, missionId)

    const ceoDecomposeTask = {
      id:          `ceo-decompose-${missionId}`,
      title:       'Decompose goal into tasks',
      description: `Break this into 3-6 tasks. Respond with ONLY valid JSON (no markdown, no code fences):
{ "tasks": [ { "title": "...", "agent": "engineer|researcher|operator|ceo", "priority": 1|2|3, "isDangerous": false } ] }

Goal: ${goal}
Description: ${description}`,
    }

    let parsedTasks: Array<{ title: string; agent: string; priority: 1|2|3; isDangerous: boolean }> = []

    try {
      const ceoResponse = await agentExecutor.assign('ceo', ceoDecomposeTask, goal, missionId)

      // Extract JSON from response
      const jsonMatch = ceoResponse.match(/\{[\s\S]*"tasks"[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (Array.isArray(parsed?.tasks)) {
          parsedTasks = parsed.tasks.filter((t: any) => t?.title)
        }
      }
    } catch (err: any) {
      console.warn(`[Mission] CEO decompose failed: ${err?.message} — using fallback single task`)
    }

    // Fallback if CEO didn't produce valid JSON
    if (parsedTasks.length === 0) {
      parsedTasks = [{ title: goal, agent: 'engineer', priority: 1, isDangerous: false }]
    }

    // ── Step 2: Enqueue tasks ────────────────────────────────
    const todoItems: TodoItem[] = parsedTasks.map(t => ({
      title: t.title,
      agent: t.agent,
      done:  false,
    }))

    taskBus.enqueue(
      missionId,
      parsedTasks.map(t => ({
        missionId,
        title:       t.title,
        description: t.title,
        assignedTo:  toRole(t.agent),
        priority:    t.priority ?? 2,
        isDangerous: t.isDangerous ?? false,
      })),
    )

    // ── Step 3: Create TODO file ─────────────────────────────
    missionTodo.createTodo(missionId, goal, todoItems)

    // ── Step 3a: Create MissionCanvas and MissionLog ──────────
    missionCanvas.create(missionId, goal)

    // CEO writes the initial plan to canvas
    try {
      missionCanvas.write(missionId, {
        author:  'ceo',
        type:    'plan',
        content: `Tasks: ${parsedTasks.map(t => t.title).join(' | ')}`,
        tags:    ['decompose'],
      })
    } catch { /* non-fatal */ }

    createMissionLog(missionId, goal, parsedTasks)

    // ── Step 4: Persist initial mission state ────────────────
    const mission: Mission = {
      id:          missionId,
      goal,
      description,
      type:        missionType,
      status:      'active',
      tasksTotal:  parsedTasks.length,
      tasksDone:   0,
      tasksFailed: 0,
      tokensUsed:  0,
      loopCount:   0,
      startedAt,
      options,
    }
    missionState.saveMission(mission)

    // ── Step 5: Execution loop ───────────────────────────────
    let loopCount  = 0
    let tasksDone  = 0
    let tasksFailed = 0

    while (true) {
      // Check if cancelled
      if (this.cancelled.has(missionId)) {
        console.log(`[Mission] 🚫 Mission cancelled: ${missionId}`)
        missionState.updateMission(missionId, { status: 'cancelled' })
        break
      }

      // Check if paused
      if (this.paused.has(missionId)) {
        console.log(`[Mission] ⏸  Mission paused: ${missionId}`)
        missionState.updateMission(missionId, { status: 'paused' })
        break
      }

      // Guardrail: loop limit
      const loopCheck = guardrails.checkLoopLimit(missionId, loopCount)
      if (!loopCheck.ok) {
        console.warn(`[Mission] ⚠️  Loop limit: ${loopCheck.reason}`)
        missionState.updateMission(missionId, { status: 'failed', loopCount })
        break
      }

      // Guardrail: mission timeout
      const timeoutCheck = guardrails.checkMissionTimeout(startedAt)
      if (!timeoutCheck.ok) {
        console.warn(`[Mission] ⚠️  Mission timed out`)
        missionState.updateMission(missionId, { status: 'failed', loopCount })
        break
      }

      // Get next task
      const task = taskBus.getNext(missionId)
      if (!task) {
        console.log(`[Mission] ✅ All tasks complete`)
        break
      }

      // Claim task
      taskBus.claim(task.id, task.assignedTo)
      console.log(`[Mission]   ▶ [${task.assignedTo}] ${task.title}`)

      // Human approval for dangerous tasks
      if (task.isDangerous) {
        const approved = await humanInTheLoop.requestApproval(
          task.title,
          `Task marked as dangerous in mission: ${goal}`,
          task.id,
        )
        if (!approved) {
          console.warn(`[Mission]   ❌ Dangerous task rejected: ${task.title}`)
          taskBus.fail(task.id, 'Rejected by human-in-the-loop')
          tasksFailed++
          missionState.updateMission(missionId, { tasksFailed, loopCount: ++loopCount })
          continue
        }
      }

      // Signal acting
      liveThinking.act(task.assignedTo, `Starting: ${task.title}`, missionId)

      // Build context with current TODO + MissionCanvas + MissionLog (for CEO)
      const todoContext   = missionTodo.readTodo(missionId)
      const canvasContext = missionCanvas.getFullContext(missionId)
      const logContext    = task.assignedTo === 'ceo' ? readMissionLog(missionId) : ''

      const taskContext = [
        canvasContext ? canvasContext : '',
        logContext    ? `\n=== MISSION LOG ===\n${logContext}\n=== END LOG ===` : '',
        `\nCurrent todo:\n${todoContext}`,
        `\nNext task: ${task.description}`,
      ].filter(Boolean).join('\n').trim()

      // Execute task via assigned agent
      const execTask = {
        id:          task.id,
        title:       task.title,
        description: task.description,
      }

      let taskResult = ''
      let taskSuccess = true

      try {
        taskResult  = await agentExecutor.assign(toRole(task.assignedTo), execTask, taskContext, missionId)
      } catch (err: any) {
        taskResult  = err?.message ?? String(err)
        taskSuccess = false
      }

      // Compress context if long
      await contextCompressor.compress([taskResult])

      // Tick TODO file
      missionTodo.tickTask(missionId, task.title)

      // Tick MissionLog
      tickMissionLog(missionId, task.title, taskSuccess)

      // MissionCanvas: CEO writes a decision after each task round
      if (task.assignedTo === 'ceo' && taskSuccess) {
        try {
          missionCanvas.write(missionId, {
            author:  'ceo',
            type:    'decision',
            content: taskResult.slice(0, 400),
            tags:    [task.id],
          })
        } catch { /* non-fatal */ }
      }

      // Update task in bus
      if (taskSuccess) {
        taskBus.complete(task.id, taskResult)
        tasksDone++
        liveThinking.done(task.assignedTo, `Completed: ${task.title}`, missionId)
      } else {
        taskBus.fail(task.id, taskResult)
        tasksFailed++
        liveThinking.error(task.assignedTo, taskResult, missionId)
      }

      loopCount++
      missionState.updateMission(missionId, { tasksDone, tasksFailed, loopCount })

      // Stop if nothing pending
      if (taskBus.getPending(missionId).length === 0) break
    }

    // ── Step 6: Finalise mission ─────────────────────────────
    const finalStatus = this.cancelled.has(missionId) ? 'cancelled'
      : this.paused.has(missionId)    ? 'paused'
      : tasksFailed > 0 && tasksDone === 0 ? 'failed'
      : 'complete'

    missionState.updateMission(missionId, {
      status:      finalStatus,
      completedAt: new Date().toISOString(),
      tasksDone,
      tasksFailed,
      loopCount,
    })

    if (finalStatus === 'complete') {
      eventBus.emit('mission:complete', { missionId, goal })
      console.log(`[Mission] 🎉 Mission complete: "${goal}" (${tasksDone} tasks)`)
    }

    return missionState.loadMission(missionId)!
  }

  pauseMission(id: string): void {
    this.paused.add(id)
    missionState.updateMission(id, { status: 'paused' })
    console.log(`[Mission] ⏸  Paused: ${id}`)
  }

  async resumeMission(id: string): Promise<void> {
    this.paused.delete(id)
    const mission = missionState.loadMission(id)
    if (!mission) {
      console.warn(`[Mission] Resume: mission not found: ${id}`)
      return
    }
    missionState.updateMission(id, { status: 'active' })
    console.log(`[Mission] ▶️  Resuming: ${id}`)
    await this.startMission(mission.goal, mission.description, mission.options)
  }

  cancelMission(id: string): void {
    this.cancelled.add(id)
    missionState.updateMission(id, { status: 'cancelled' })
    console.log(`[Mission] 🚫 Cancelled: ${id}`)
  }
}

export const autonomousMission = new AutonomousMission()
