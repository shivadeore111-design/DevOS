// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// ============================================================
// runner.ts — DevOS Runner (Agent Lifecycle)
// Claim → Execute (via TaskGraph) → Handle success/failure
// ============================================================

import { DevOSTask }       from "./task";
import { taskStore }       from "./taskStore";
import { taskQueue }       from "./taskQueue";
import { eventBus as dashboardBus } from "../dashboard/events";
import { workspaceManager }         from "../devos/runtime/workspaceManager";
import { resourceManager }          from "../devos/runtime/resourceManager";
import { stateSnapshot }            from "../devos/runtime/stateSnapshot";
import { eventBus }                 from "./eventBus";
import { taskGraphBuilder }         from "./taskGraph";
import { createGraphExecutor }      from "./graphExecutor";
import { DevOSEngine }              from "../executor/engine";

export interface ExecutionEngine {
  execute(plan: any):                   Promise<{ success: boolean; output?: any; error?: string }>;
  executeOne?(action: any, ws?: string): Promise<{ success: boolean; output?: any; error?: string }>;
}

interface RunnerOptions {
  agentId:        string;
  engine:         ExecutionEngine;
  pollIntervalMs?: number;
}

export class Runner {
  private agentId:        string;
  private engine:         ExecutionEngine;
  private pollIntervalMs: number;
  private running = false;

  constructor(opts: RunnerOptions) {
    this.agentId        = opts.agentId;
    this.engine         = opts.engine;
    this.pollIntervalMs = opts.pollIntervalMs ?? 2000;
  }

  // ── CLI Mode: one goal, exit ──────────────────────────────

  async runOnce(goal: string, plan?: any): Promise<DevOSTask> {
    console.log(`\n[Runner:${this.agentId}] CLI — "${goal}"`);

    const task = taskQueue.create({ goal, priority: "high", plan });

    // Emit goal_received on both buses
    eventBus.emit("goal_received", { goal, taskId: task.id, agentId: this.agentId });
    dashboardBus.emit({
      type:      "goal_received",
      taskId:    task.id,
      agentId:   this.agentId,
      payload:   { goal, plan },
      timestamp: new Date().toISOString(),
    });

    // Create isolated workspace for this task
    await workspaceManager.create(task.id);

    // Begin resource tracking
    resourceManager.startTracking(task.id);

    // Allow the task store's persist() to flush before claiming.
    await this.sleep(150);

    // Retry claim up to 3 times with 100 ms between attempts.
    let claimed: DevOSTask | undefined;
    for (let attempt = 1; attempt <= 3; attempt++) {
      claimed = taskStore.claim(task.id, this.agentId);
      if (claimed) break;
      console.warn(`[Runner:${this.agentId}] Claim attempt ${attempt}/3 failed for ${task.id} — retrying…`);
      await this.sleep(100);
    }

    if (!claimed) {
      resourceManager.stopTracking(task.id);
      throw new Error(`[Runner] Failed to claim task ${task.id} after 3 attempts`);
    }

    await this.executeTask(claimed);
    return taskStore.get(task.id)!;
  }

  // ── Daemon Mode: poll continuously ───────────────────────

  startDaemon(): void {
    if (this.running) return;
    this.running = true;
    console.log(`[Runner:${this.agentId}] 🤖 Daemon started (poll: ${this.pollIntervalMs}ms)`);
    this.poll();
  }

  stopDaemon(): void {
    this.running = false;
    console.log(`[Runner:${this.agentId}] Daemon stopped.`);
  }

  private async poll(): Promise<void> {
    while (this.running) {
      const task = taskStore.claimNext(this.agentId);
      if (task) {
        await workspaceManager.create(task.id);
        resourceManager.startTracking(task.id);
        await this.executeTask(task);
      } else {
        await this.sleep(this.pollIntervalMs);
      }
    }
  }

  // ── Core execution ────────────────────────────────────────

  private async executeTask(task: DevOSTask): Promise<void> {
    const now = new Date().toISOString();
    task.status = "running";
    task.logs.push({ timestamp: now, level: "info", message: `Execution started by ${this.agentId}` });
    taskStore.save(task);

    console.log(`[Runner:${this.agentId}] ▶ ${task.id}: "${task.goal}"`);

    try {
      const plan          = task.plan ?? { summary: task.goal, actions: [] };
      const workspacePath = workspaceManager.get(task.id);

      // Emit plan_created (dashboard bus)
      dashboardBus.emit({
        type:      "plan_created",
        taskId:    task.id,
        agentId:   this.agentId,
        payload:   { plan },
        timestamp: new Date().toISOString(),
      });

      // ── Build task graph from plan ───────────────────────
      const graph = taskGraphBuilder.fromPlan(task.id, plan);
      console.log(`[Runner:${this.agentId}] TaskGraph: ${graph.nodes.size} nodes`);

      // ── Persist snapshot (for resume-on-crash) ───────────
      await stateSnapshot.save(task.id, graph, workspacePath);

      // ── Choose execution path ────────────────────────────
      let success: boolean;
      let output:  any;
      let errorMsg: string | undefined;

      if (this.engine instanceof DevOSEngine) {
        // Graph path: parallel execution via GraphExecutor
        const graphExecutor = createGraphExecutor(
          (action: any, wp: string) => (this.engine as DevOSEngine).executeOne(action, wp)
        );
        const graphResult = await graphExecutor.execute(graph, workspacePath);
        success  = graphResult.success;
        output   = {
          nodesCompleted: graphResult.nodesCompleted,
          nodesFailed:    graphResult.nodesFailed,
          totalNodes:     graphResult.totalNodes,
          durationMs:     graphResult.durationMs,
          results:        Object.fromEntries(graphResult.results),
          errors:         Object.fromEntries(graphResult.errors),
        };
        errorMsg = graphResult.success ? undefined : `${graphResult.nodesFailed} node(s) failed`;
      } else {
        // Fallback: linear execution through engine interface
        const result = await this.engine.execute(plan);
        success  = result.success;
        output   = result.output;
        errorMsg = result.error;
      }

      if (success) {
        taskQueue.complete(task.id, output);
        eventBus.emit("task_completed", { taskId: task.id, goal: task.goal, output });
        dashboardBus.emit({
          type:      "goal_completed",
          taskId:    task.id,
          agentId:   this.agentId,
          payload:   { goal: task.goal, output },
          timestamp: new Date().toISOString(),
        });
        resourceManager.stopTracking(task.id);
        // Clean up snapshot on success
        await stateSnapshot.delete(task.id);

      } else {
        taskQueue.fail(task.id, errorMsg ?? "Engine returned failure.", "Engine indicated failure");
        eventBus.emit("task_failed", { taskId: task.id, goal: task.goal, error: errorMsg });
        dashboardBus.emit({
          type:      "goal_failed",
          taskId:    task.id,
          agentId:   this.agentId,
          payload:   { goal: task.goal, error: errorMsg },
          timestamp: new Date().toISOString(),
        });
        resourceManager.stopTracking(task.id);

        const latest = taskStore.get(task.id);
        if (latest?.status === "failed") {
          taskQueue.escalate(task.id, "critical", `Retries exhausted: ${errorMsg}`);
        }
      }

    } catch (err: any) {
      const msg = err?.message ?? String(err);
      console.error(`[Runner:${this.agentId}] Exception on ${task.id}: ${msg}`);

      taskQueue.fail(task.id, msg, "Unhandled exception");
      eventBus.emit("task_failed", { taskId: task.id, goal: task.goal, error: msg });
      dashboardBus.emit({
        type:      "goal_failed",
        taskId:    task.id,
        agentId:   this.agentId,
        payload:   { goal: task.goal, error: msg },
        timestamp: new Date().toISOString(),
      });
      resourceManager.stopTracking(task.id);

      const latest = taskStore.get(task.id);
      if (latest?.status === "failed") {
        taskQueue.escalate(task.id, "critical", `Exception: ${msg}`);
      }
    }
  }

  private sleep(ms: number) {
    return new Promise<void>(r => setTimeout(r, ms));
  }
}
