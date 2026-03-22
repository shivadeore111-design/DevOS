// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// goals/types.ts — Goal Engine type definitions

export type GoalStatus = 'pending' | 'planning' | 'active' | 'completed' | 'failed' | 'paused'
export type ProjectStatus = 'pending' | 'active' | 'completed' | 'failed'
export type TaskStatus = 'pending' | 'active' | 'completed' | 'failed' | 'skipped'

/** High-level goal category — used for routing, reporting, and skill selection */
export type GoalType =
  | 'build'
  | 'research'
  | 'fix'
  | 'deploy'
  | 'automate'
  | 'monitor'
  | 'personal'

export interface Goal {
  id: string
  title: string
  description: string
  type?: GoalType
  status: GoalStatus
  projects: string[]        // project ids
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
  result?: string
  /** Set when planner confidence < 0.7 — a clarifying question to ask the user */
  clarification?: string
  metadata: Record<string, any>
}

export interface Project {
  id: string
  goalId: string
  title: string
  description: string
  status: ProjectStatus
  tasks: string[]           // task ids
  assignedAgent?: string
  order: number
  createdAt: Date
  completedAt?: Date
}

export interface Task {
  id: string
  projectId: string
  goalId: string
  title: string
  description: string
  status: TaskStatus
  dependencies: string[]    // task ids that must complete first
  assignedAgent?: string
  priority: number          // 1-10
  result?: string
  error?: string
  createdAt: Date
  completedAt?: Date
  retryCount: number
  maxRetries: number
}
