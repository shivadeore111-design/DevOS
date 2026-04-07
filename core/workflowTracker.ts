// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/workflowTracker.ts — Real-time agent orchestration tracker.
// Emits workflow events onto eventBus so api/server.ts can forward
// them to the dashboard via the existing /api/stream SSE channel.

import { eventBus } from './eventBus'

// ── Types ──────────────────────────────────────────────────────

export interface WorkflowNode {
  id:           string
  agent:        string        // 'aiden' | 'researcher' | 'engineer' | etc.
  label:        string        // task description
  status:       'pending' | 'active' | 'completed' | 'failed'
  startedAt?:   number
  completedAt?: number
  duration?:    number        // ms
  cost?:        number        // USD
  toolCalls:    number
  currentTool?: string        // tool running right now
  tier?:        number        // 1-4
}

export interface WorkflowEdge {
  id:        string
  from:      string
  to:        string
  label?:    string
  animated:  boolean
}

export interface WorkflowState {
  id:            string
  goal:          string
  nodes:         WorkflowNode[]
  edges:         WorkflowEdge[]
  status:        'idle' | 'active' | 'completed' | 'failed'
  totalCost:     number
  totalDuration: number
  startedAt?:    number
}

// ── State ──────────────────────────────────────────────────────

let currentWorkflow: WorkflowState | null = null

// ── Internal emit ──────────────────────────────────────────────

function emit(type: string, payload: Record<string, any>): void {
  eventBus.emit('workflow_event', { type, ...payload })
}

// ── Public API ─────────────────────────────────────────────────

export function startWorkflow(goal: string): string {
  const id = `wf_${Date.now()}`
  currentWorkflow = {
    id, goal, nodes: [], edges: [],
    status:        'active',
    totalCost:     0,
    totalDuration: 0,
    startedAt:     Date.now(),
  }
  emit('workflow:start', { workflow: currentWorkflow })
  return id
}

export function addNode(node: WorkflowNode): void {
  if (!currentWorkflow) return
  if (currentWorkflow.nodes.some(n => n.id === node.id)) return
  currentWorkflow.nodes.push(node)
  emit('workflow:node:add', { node })
}

export function updateNode(nodeId: string, update: Partial<WorkflowNode>): void {
  if (!currentWorkflow) return
  const node = currentWorkflow.nodes.find(n => n.id === nodeId)
  if (!node) return
  Object.assign(node, update)
  if (update.cost) currentWorkflow.totalCost += update.cost
  emit('workflow:node:update', { nodeId, update })
}

export function addEdge(edge: WorkflowEdge): void {
  if (!currentWorkflow) return
  if (currentWorkflow.edges.some(e => e.id === edge.id)) return
  currentWorkflow.edges.push(edge)
  emit('workflow:edge', { edge })
}

export function completeWorkflow(status: 'completed' | 'failed'): void {
  if (!currentWorkflow) return
  currentWorkflow.status = status
  currentWorkflow.totalDuration = Date.now() - (currentWorkflow.startedAt ?? 0)
  emit('workflow:complete', { workflow: currentWorkflow })
}

export function getWorkflow(): WorkflowState | null {
  return currentWorkflow
}
