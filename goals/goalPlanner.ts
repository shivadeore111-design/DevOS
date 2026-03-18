// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// goals/goalPlanner.ts — LLM-powered goal decomposition into projects + tasks

import * as os   from 'os'
import * as path from 'path'
import { callOllama }                        from '../llm/ollama'
import { goalStore }                         from './goalStore'
import { Task }                              from './types'
import { getPlanningModel, getCodingModel }  from '../core/autoModelSelector'

interface RawTask {
  title:        string
  description:  string
  priority:     number
  dependencies: string[]   // titles of dependency tasks within the same project
}

interface RawProject {
  title:       string
  description: string
  order:       number
  tasks:       RawTask[]
}

interface PlanResponse {
  projects: RawProject[]
}

function extractJSON(raw: string): string {
  // Strip markdown code fences if present
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  // Find first { … } block
  const start = raw.indexOf('{')
  const end   = raw.lastIndexOf('}')
  if (start !== -1 && end !== -1) return raw.slice(start, end + 1)
  return raw.trim()
}

export class GoalPlanner {

  async plan(goalId: string): Promise<void> {
    const goal = goalStore.getGoal(goalId)
    if (!goal) throw new Error(`[GoalPlanner] Goal not found: ${goalId}`)

    goalStore.updateGoal(goalId, { status: 'planning' })

    const WIN_CONTEXT = process.platform === 'win32' ? `
CRITICAL SYSTEM RULES - READ FIRST:
Platform: Windows
Desktop: ${path.join(os.homedir(), 'Desktop')}
Home: ${os.homedir()}
Temp: ${os.tmpdir()}

WINDOWS COMMANDS ONLY. NEVER USE LINUX COMMANDS.
Allowed: echo, mkdir, copy, move, del, dir, type, cd, powershell
Forbidden: touch, mkdir -p, ls, cat, cp, mv, rm, chmod

File paths use backslashes: C:\\Users\\shiva\\Desktop\\file.txt
Create file: echo content > "C:\\path\\file.txt"
Create folder: mkdir "C:\\path\\folder"
Desktop path: ${path.join(os.homedir(), 'Desktop')}
` : `Platform: ${process.platform}\nHome: ${os.homedir()}\n`

    const prompt = `${WIN_CONTEXT}

You are a project planner. Break this goal into projects and tasks.
Goal: ${goal.title} — ${goal.description}

Return JSON only:
{
  "projects": [
    {
      "title": "Research",
      "description": "...",
      "order": 1,
      "tasks": [
        { "title": "...", "description": "...", "priority": 8, "dependencies": [] }
      ]
    }
  ]
}`

    const raw  = await callOllama(prompt, undefined, getPlanningModel())
    const json = extractJSON(raw)

    let plan: PlanResponse
    try {
      plan = JSON.parse(json) as PlanResponse
    } catch (err) {
      console.error(`[GoalPlanner] Failed to parse LLM response: ${json.slice(0, 200)}`)
      throw new Error(`[GoalPlanner] Invalid JSON from LLM: ${String(err)}`)
    }

    if (!Array.isArray(plan.projects) || plan.projects.length === 0) {
      throw new Error('[GoalPlanner] LLM returned no projects')
    }

    let totalTasks = 0

    for (const rawProj of plan.projects) {
      const project = goalStore.createProject(
        goalId,
        rawProj.title        ?? 'Unnamed project',
        rawProj.description  ?? '',
        rawProj.order        ?? 1,
      )

      // First pass: create all tasks and build title→id map
      const titleToId = new Map<string, string>()
      const createdTasks: Task[] = []

      for (const rawTask of (rawProj.tasks ?? [])) {
        const task = goalStore.createTask(
          project.id,
          goalId,
          rawTask.title       ?? 'Unnamed task',
          rawTask.description ?? '',
          [],   // deps wired below
        )
        if (rawTask.priority && typeof rawTask.priority === 'number') {
          goalStore.updateTask(task.id, { priority: rawTask.priority })
        }
        titleToId.set(rawTask.title, task.id)
        createdTasks.push(task)
        totalTasks++
      }

      // Second pass: wire dependencies by title → id
      for (let i = 0; i < createdTasks.length; i++) {
        const rawTask = rawProj.tasks[i]
        const deps    = (rawTask.dependencies ?? []) as string[]
        if (deps.length > 0) {
          const depIds = deps
            .map((d: string) => titleToId.get(d))
            .filter((id): id is string => !!id)
          goalStore.updateTask(createdTasks[i].id, { dependencies: depIds })
        }
      }
    }

    goalStore.updateGoal(goalId, { status: 'active' })
    console.log(`[GoalPlanner] ✅ Planned: ${plan.projects.length} projects, ${totalTasks} tasks`)
  }

  /** Replan a failed goal — keep completed tasks, reset only failed/pending ones */
  async replan(goalId: string): Promise<void> {
    const goal = goalStore.getGoal(goalId)
    if (!goal) throw new Error(`[GoalPlanner] Goal not found: ${goalId}`)

    // Reset failed tasks to pending so they can be retried
    for (const projectId of goal.projects) {
      const tasks = goalStore.listTasks(projectId)
      for (const task of tasks) {
        if (task.status === 'failed' || task.status === 'pending') {
          goalStore.updateTask(task.id, { status: 'pending', retryCount: 0, error: undefined })
        }
      }
      // Reset project status if needed
      const project = goalStore.getProject(projectId)
      if (project?.status === 'failed') {
        goalStore.updateProject(projectId, { status: 'pending' })
      }
    }

    goalStore.updateGoal(goalId, { status: 'active' })
    console.log(`[GoalPlanner] ♻️  Replanned goal: ${goal.title}`)
  }
}

export const goalPlanner = new GoalPlanner()
