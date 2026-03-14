// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// agents/types.ts — Agent Layer type definitions

export type AgentRole   = 'ceo' | 'engineer' | 'researcher' | 'operator'
export type AgentStatus = 'idle' | 'thinking' | 'executing' | 'waiting' | 'error'

export interface Agent {
  id: string
  role: AgentRole
  name: string
  description: string
  systemPrompt: string
  tools: string[]
  budget: number            // max tokens per task
  status: AgentStatus
  currentTaskId?: string
  completedTasks: number
  failedTasks: number
  createdAt: Date
  lastActiveAt?: Date
}

export interface AgentMessage {
  id: string
  fromAgent: AgentRole | 'user'
  toAgent: AgentRole | 'all' | 'user'
  content: string
  taskId?: string
  goalId?: string
  timestamp: Date
  type: 'instruction' | 'result' | 'question' | 'approval_request' | 'status'
}
