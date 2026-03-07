// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// ============================================================
// taskQueue.ts — DevOS State Transition Layer
// Handles: create, complete, fail, escalate
// Does NOT manage persistence — delegates to taskStore
// ============================================================

import { v4 as uuidv4 } from "uuid";
import { DevOSTask, Priority, EscalationLevel } from "./task";
import { taskStore } from "./taskStore";

interface CreateTaskOptions {
  goal: string;
  priority?: Priority;
  dependsOn?: string[];
  maxRetries?: number;
  plan?: any;
}

export class TaskQueue {

  create(opts: CreateTaskOptions): DevOSTask {
    const now  = new Date().toISOString();
    const deps = opts.dependsOn ?? [];

    const task: DevOSTask = {
      id:          uuidv4(),
      goal:        opts.goal,
      status:      "queued",
      priority:    opts.priority ?? "normal",
      escalation:  "none",
      dependsOn:   deps,
      blockedBy:   [...deps],
      plan:        opts.plan,
      result:      undefined,
      lastError:   undefined,
      retryReason: undefined,
      retryCount:  0,
      maxRetries:  opts.maxRetries ?? 3,
      logs: [{
        timestamp: now,
        level: "info",
        message: `Task created: "${opts.goal}"`,
      }],
      createdAt: now,
      updatedAt: now,
    };

    taskStore.save(task);
    console.log(`[TaskQueue] Created ${task.id}: "${task.goal}"`);
    return task;
  }

  complete(taskId: string, result: any): DevOSTask {
    const task = this.getOrThrow(taskId);
    const now  = new Date().toISOString();

    task.status      = "completed";
    task.result      = result;
    task.completedAt = now;
    task.logs.push({ timestamp: now, level: "info", message: "Task completed successfully." });

    // Unblock dependents
    for (const t of taskStore.getAll()) {
      if (t.blockedBy.includes(taskId)) {
        t.blockedBy = t.blockedBy.filter(id => id !== taskId);
        taskStore.save(t);
      }
    }

    taskStore.save(task);
    console.log(`[TaskQueue] ✅ Completed ${taskId}`);
    return task;
  }

  fail(taskId: string, error: string, retryReason?: string): DevOSTask {
    const task = this.getOrThrow(taskId);
    const now  = new Date().toISOString();

    task.lastError   = error;
    task.retryReason = retryReason;
    task.retryCount += 1;

    task.logs.push({
      timestamp: now,
      level: "error",
      message: `Failed (attempt ${task.retryCount}/${task.maxRetries}): ${error}`,
    });

    if (task.retryCount < task.maxRetries) {
      task.status = "queued";
      task.logs.push({ timestamp: now, level: "warn", message: `Re-queued for retry. Reason: ${retryReason ?? "unspecified"}` });
    } else {
      task.status = "failed";
      task.logs.push({ timestamp: now, level: "error", message: `Max retries (${task.maxRetries}) exhausted.` });
    }

    taskStore.save(task);
    console.log(`[TaskQueue] ❌ Failed ${taskId} (retry ${task.retryCount}/${task.maxRetries})`);
    return task;
  }

  escalate(taskId: string, level: EscalationLevel, reason: string): DevOSTask {
    const task = this.getOrThrow(taskId);
    const now  = new Date().toISOString();

    task.status     = "escalated";
    task.escalation = level;
    task.logs.push({ timestamp: now, level: "warn", message: `Escalated [${level}]: ${reason}` });

    taskStore.save(task);
    console.log(`[TaskQueue] ⚠️  Escalated ${taskId} → ${level}`);
    return task;
  }

  getByStatus(status: DevOSTask["status"]): DevOSTask[] {
    return taskStore.getAll().filter(t => t.status === status);
  }

  private getOrThrow(id: string): DevOSTask {
    const t = taskStore.get(id);
    if (!t) throw new Error(`[TaskQueue] Task not found: ${id}`);
    return t;
  }
}

export const taskQueue = new TaskQueue();
