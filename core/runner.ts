// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// ============================================================
// runner.ts — DevOS Runner (Agent Lifecycle)
// Claim → Execute → Handle success/failure → Update state
// ============================================================

import { DevOSTask } from "./task";
import { taskStore } from "./taskStore";
import { taskQueue } from "./taskQueue";

export interface ExecutionEngine {
  execute(plan: any): Promise<{ success: boolean; output?: any; error?: string }>;
}

interface RunnerOptions {
  agentId: string;
  engine: ExecutionEngine;
  pollIntervalMs?: number;
}

export class Runner {
  private agentId: string;
  private engine: ExecutionEngine;
  private pollIntervalMs: number;
  private running = false;

  constructor(opts: RunnerOptions) {
    this.agentId       = opts.agentId;
    this.engine        = opts.engine;
    this.pollIntervalMs = opts.pollIntervalMs ?? 2000;
  }

  // ── CLI Mode: one goal, exit ──────────────────────────────

  async runOnce(goal: string, plan?: any): Promise<DevOSTask> {
    console.log(`\n[Runner:${this.agentId}] CLI — "${goal}"`);

    const task = taskQueue.create({ goal, priority: "high", plan });

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
      const plan   = task.plan ?? { summary: task.goal, actions: [] };
      const result = await this.engine.execute(plan);

      if (result.success) {
        taskQueue.complete(task.id, result.output);
      } else {
        taskQueue.fail(task.id, result.error ?? "Engine returned failure.", "Engine indicated failure");
        const latest = taskStore.get(task.id);
        if (latest?.status === "failed") {
          taskQueue.escalate(task.id, "critical", `Retries exhausted: ${result.error}`);
        }
      }
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      console.error(`[Runner:${this.agentId}] Exception on ${task.id}: ${msg}`);
      taskQueue.fail(task.id, msg, "Unhandled exception");
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
