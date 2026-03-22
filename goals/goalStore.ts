// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// goals/goalStore.ts — Persistent store for Goals, Projects, Tasks

import * as fs   from 'fs'
import * as path from 'path'
import crypto    from 'crypto'
import { Goal, GoalStatus, Project, ProjectStatus, Task, TaskStatus } from './types'

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`
}

function now(): Date {
  return new Date()
}

export class GoalStore {
  private goalsPath:    string
  private projectsPath: string
  private tasksPath:    string

  private goals:    Map<string, Goal>    = new Map()
  private projects: Map<string, Project> = new Map()
  private tasks:    Map<string, Task>    = new Map()

  constructor() {
    const ws         = path.join(process.cwd(), 'workspace')
    this.goalsPath    = path.join(ws, 'goals.json')
    this.projectsPath = path.join(ws, 'goal_projects.json')
    this.tasksPath    = path.join(ws, 'goal_tasks.json')
    fs.mkdirSync(ws, { recursive: true })
    this.load()
  }

  // ── Persistence ───────────────────────────────────────────

  private load(): void {
    this.goals    = this.readMap<Goal>(this.goalsPath)
    this.projects = this.readMap<Project>(this.projectsPath)
    this.tasks    = this.readMap<Task>(this.tasksPath)
  }

  private readMap<T>(filePath: string): Map<string, T> {
    try {
      if (!fs.existsSync(filePath)) return new Map()
      const raw  = fs.readFileSync(filePath, 'utf-8')
      const obj  = JSON.parse(raw) as Record<string, T>
      return new Map(Object.entries(obj))
    } catch {
      return new Map()
    }
  }

  private saveGoals(): void    { this.writeMap(this.goalsPath,    this.goals) }
  private saveProjects(): void { this.writeMap(this.projectsPath, this.projects) }
  private saveTasks(): void    { this.writeMap(this.tasksPath,    this.tasks) }

  private writeMap<T>(filePath: string, map: Map<string, T>): void {
    const obj: Record<string, T> = {}
    for (const [k, v] of map) obj[k] = v
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 2))
  }

  // ── Goals ─────────────────────────────────────────────────

  createGoal(title: string, description: string): Goal {
    const goal: Goal = {
      id:          makeId('goal'),
      title,
      description,
      status:      'pending',
      projects:    [],
      createdAt:   now(),
      updatedAt:   now(),
      metadata:    {},
    }
    this.goals.set(goal.id, goal)
    this.saveGoals()
    return goal
  }

  getGoal(id: string): Goal | null {
    return this.goals.get(id) ?? null
  }

  listGoals(status?: GoalStatus): Goal[] {
    const all = Array.from(this.goals.values())
    return status ? all.filter(g => g.status === status) : all
  }

  updateGoal(id: string, updates: Partial<Goal>): void {
    const goal = this.goals.get(id)
    if (!goal) return
    Object.assign(goal, updates, { updatedAt: now() })
    this.goals.set(id, goal)
    this.saveGoals()
  }

  // ── Projects ──────────────────────────────────────────────

  createProject(
    goalId:      string,
    title:       string,
    description: string,
    order:       number,
  ): Project {
    const project: Project = {
      id:          makeId('proj'),
      goalId,
      title,
      description,
      status:      'pending',
      tasks:       [],
      order,
      createdAt:   now(),
    }
    this.projects.set(project.id, project)
    this.saveProjects()

    // Register project id on parent goal
    const goal = this.goals.get(goalId)
    if (goal) {
      goal.projects.push(project.id)
      goal.updatedAt = now()
      this.goals.set(goalId, goal)
      this.saveGoals()
    }

    return project
  }

  getProject(id: string): Project | null {
    return this.projects.get(id) ?? null
  }

  listProjects(goalId: string): Project[] {
    return Array.from(this.projects.values())
      .filter(p => p.goalId === goalId)
      .sort((a, b) => a.order - b.order)
  }

  updateProject(id: string, updates: Partial<Project>): void {
    const project = this.projects.get(id)
    if (!project) return
    Object.assign(project, updates)
    this.projects.set(id, project)
    this.saveProjects()
  }

  // ── Tasks ─────────────────────────────────────────────────

  createTask(
    projectId:   string,
    goalId:      string,
    title:       string,
    description: string,
    deps:        string[] = [],
  ): Task {
    const task: Task = {
      id:           makeId('task'),
      projectId,
      goalId,
      title,
      description,
      status:       'pending',
      dependencies: deps,
      priority:     5,
      createdAt:    now(),
      retryCount:   0,
      maxRetries:   1,
    }
    this.tasks.set(task.id, task)
    this.saveTasks()

    // Register task id on parent project
    const project = this.projects.get(projectId)
    if (project) {
      project.tasks.push(task.id)
      this.projects.set(projectId, project)
      this.saveProjects()
    }

    return task
  }

  getTask(id: string): Task | null {
    return this.tasks.get(id) ?? null
  }

  listTasks(projectId: string): Task[] {
    return Array.from(this.tasks.values())
      .filter(t => t.projectId === projectId)
  }

  /** Tasks where all dependency tasks are completed */
  listReadyTasks(projectId: string): Task[] {
    const projectTasks = this.listTasks(projectId)
    return projectTasks.filter(task => {
      if (task.status !== 'pending') return false
      return task.dependencies.every(depId => {
        const dep = this.tasks.get(depId)
        return dep?.status === 'completed'
      })
    })
  }

  updateTask(id: string, updates: Partial<Task>): void {
    const task = this.tasks.get(id)
    if (!task) return
    Object.assign(task, updates)
    this.tasks.set(id, task)
    this.saveTasks()
  }
}

export const goalStore = new GoalStore()
