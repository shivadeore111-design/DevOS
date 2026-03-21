// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/graphExecutor.ts — Parallel DAG executor for TaskGraphs

import { TaskGraph, TaskNode, taskGraphBuilder } from "./taskGraph"
import { eventBus }                              from "./eventBus"

export interface GraphExecutionResult {
  goalId:         string
  success:        boolean
  nodesCompleted: number
  nodesFailed:    number
  totalNodes:     number
  results:        Map<string, any>
  errors:         Map<string, string>
  durationMs:     number
}

type ExecuteActionFn = (action: any, workspacePath: string) => Promise<{ success: boolean; output?: any; error?: string }>

export class GraphExecutor {
  private executeAction: ExecuteActionFn

  constructor(executeAction: ExecuteActionFn) {
    this.executeAction = executeAction
  }

  async execute(graph: TaskGraph, workspacePath: string): Promise<GraphExecutionResult> {
    const startMs  = Date.now()
    const results  = new Map<string, any>()
    const errors   = new Map<string, string>()

    console.log(`\n[GraphExecutor] Executing graph for goal "${graph.goalId}" (${graph.nodes.size} nodes)`)

    // ── 0-node guard: never mark an empty graph as success ─────────────────
    if (graph.nodes.size === 0) {
      const msg = 'Empty graph — task translation failed'
      console.error(`[GraphExecutor] ❌ ${msg}`)
      errors.set('__empty__', msg)
      return {
        goalId:         graph.goalId,
        success:        false,
        nodesCompleted: 0,
        nodesFailed:    0,
        totalNodes:     0,
        results,
        errors,
        durationMs:     Date.now() - startMs,
      }
    }

    // ── Main execution loop ────────────────────────────────────
    let iterations = 0
    const MAX_ITER  = graph.nodes.size * 4  // safety guard against infinite loops

    while (!taskGraphBuilder.isComplete(graph) && iterations < MAX_ITER) {
      iterations++

      const ready = taskGraphBuilder.getReady(graph)

      // If nothing is ready but graph isn't complete → we're stuck (likely due to failures)
      if (ready.length === 0) {
        // Mark remaining pending nodes as skipped
        for (const node of taskGraphBuilder.getByStatus(graph, "pending")) {
          node.status = "skipped"
          console.warn(`[GraphExecutor] Skipped (no deps available): ${node.id}`)
        }
        break
      }

      // Execute all ready nodes in parallel
      await Promise.all(ready.map(node => this.runNode(node, graph, workspacePath, results, errors)))

      // After any failure, mark dependent nodes as skipped
      this.propagateFailures(graph)
    }

    const nodesCompleted = taskGraphBuilder.getByStatus(graph, "done").length
    const nodesFailed    = taskGraphBuilder.getByStatus(graph, "failed").length
    const success        = nodesFailed === 0 && taskGraphBuilder.isComplete(graph)

    console.log(`\n[GraphExecutor] ${success ? "✅" : "❌"} ${nodesCompleted}/${graph.nodes.size} nodes completed, ${nodesFailed} failed`)

    return {
      goalId:         graph.goalId,
      success,
      nodesCompleted,
      nodesFailed,
      totalNodes:     graph.nodes.size,
      results,
      errors,
      durationMs:     Date.now() - startMs,
    }
  }

  // ── Execute a single node ──────────────────────────────────

  private async runNode(
    node:          TaskNode,
    graph:         TaskGraph,
    workspacePath: string,
    results:       Map<string, any>,
    errors:        Map<string, string>,
  ): Promise<void> {
    node.status    = "running"
    node.startedAt = new Date()
    console.log(`[GraphExecutor] ▶ ${node.id}: ${node.description}`)

    eventBus.emit("task_started", { goalId: graph.goalId, nodeId: node.id, description: node.description })

    try {
      const result  = await this.executeAction(node.action, workspacePath)
      node.result   = result.output
      node.status   = result.success ? "done" : "failed"

      if (result.success) {
        node.completedAt = new Date()
        results.set(node.id, result.output)
        console.log(`[GraphExecutor] ✅ ${node.id} done`)
        eventBus.emit("task_completed", { goalId: graph.goalId, nodeId: node.id, output: result.output })
      } else {
        node.error = result.error ?? "Action returned failure"
        errors.set(node.id, node.error)
        console.error(`[GraphExecutor] ❌ ${node.id} failed: ${node.error}`)
        eventBus.emit("task_failed", { goalId: graph.goalId, nodeId: node.id, error: node.error })
      }
    } catch (err: any) {
      const msg     = err?.message ?? String(err)
      node.status   = "failed"
      node.error    = msg
      errors.set(node.id, msg)
      console.error(`[GraphExecutor] ❌ ${node.id} threw: ${msg}`)
      eventBus.emit("task_failed", { goalId: graph.goalId, nodeId: node.id, error: msg })
    }

    node.completedAt = node.completedAt ?? new Date()
  }

  // ── Propagate failures: skip nodes that depended on a failed node ──

  private propagateFailures(graph: TaskGraph): void {
    const failed = new Set(
      taskGraphBuilder.getByStatus(graph, "failed").map(n => n.id)
    )

    let changed = true
    while (changed) {
      changed = false
      for (const node of graph.nodes.values()) {
        if (node.status !== "pending") continue
        const blockedByFailed = node.dependsOn.some(depId => failed.has(depId))
        const blockedBySkipped = node.dependsOn.some(depId => {
          const dep = graph.nodes.get(depId)
          return dep?.status === "skipped"
        })
        if (blockedByFailed || blockedBySkipped) {
          node.status = "skipped"
          failed.add(node.id)
          changed = true
          console.warn(`[GraphExecutor] Skipped (dep failed): ${node.id}`)
        }
      }
    }
  }
}

/** Factory: create a GraphExecutor with an action runner function */
export function createGraphExecutor(executeAction: ExecuteActionFn): GraphExecutor {
  return new GraphExecutor(executeAction)
}
