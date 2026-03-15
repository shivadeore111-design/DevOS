"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskQueue = exports.TaskQueue = void 0;
// ============================================================
// taskQueue.ts — DevOS State Transition Layer
// Handles: create, complete, fail, escalate
// Does NOT manage persistence — delegates to taskStore
// ============================================================
const uuid_1 = require("uuid");
const taskStore_1 = require("./taskStore");
class TaskQueue {
    create(opts) {
        const now = new Date().toISOString();
        const deps = opts.dependsOn ?? [];
        const task = {
            id: (0, uuid_1.v4)(),
            goal: opts.goal,
            status: "queued",
            priority: opts.priority ?? "normal",
            escalation: "none",
            dependsOn: deps,
            blockedBy: [...deps],
            plan: opts.plan,
            result: undefined,
            lastError: undefined,
            retryReason: undefined,
            retryCount: 0,
            maxRetries: opts.maxRetries ?? 3,
            logs: [{
                    timestamp: now,
                    level: "info",
                    message: `Task created: "${opts.goal}"`,
                }],
            createdAt: now,
            updatedAt: now,
        };
        taskStore_1.taskStore.save(task);
        console.log(`[TaskQueue] Created ${task.id}: "${task.goal}"`);
        return task;
    }
    complete(taskId, result) {
        const task = this.getOrThrow(taskId);
        const now = new Date().toISOString();
        task.status = "completed";
        task.result = result;
        task.completedAt = now;
        task.logs.push({ timestamp: now, level: "info", message: "Task completed successfully." });
        // Unblock dependents
        for (const t of taskStore_1.taskStore.getAll()) {
            if (t.blockedBy.includes(taskId)) {
                t.blockedBy = t.blockedBy.filter(id => id !== taskId);
                taskStore_1.taskStore.save(t);
            }
        }
        taskStore_1.taskStore.save(task);
        console.log(`[TaskQueue] ✅ Completed ${taskId}`);
        return task;
    }
    fail(taskId, error, retryReason) {
        const task = this.getOrThrow(taskId);
        const now = new Date().toISOString();
        task.lastError = error;
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
        }
        else {
            task.status = "failed";
            task.logs.push({ timestamp: now, level: "error", message: `Max retries (${task.maxRetries}) exhausted.` });
        }
        taskStore_1.taskStore.save(task);
        console.log(`[TaskQueue] ❌ Failed ${taskId} (retry ${task.retryCount}/${task.maxRetries})`);
        return task;
    }
    escalate(taskId, level, reason) {
        const task = this.getOrThrow(taskId);
        const now = new Date().toISOString();
        task.status = "escalated";
        task.escalation = level;
        task.logs.push({ timestamp: now, level: "warn", message: `Escalated [${level}]: ${reason}` });
        taskStore_1.taskStore.save(task);
        console.log(`[TaskQueue] ⚠️  Escalated ${taskId} → ${level}`);
        return task;
    }
    getByStatus(status) {
        return taskStore_1.taskStore.getAll().filter(t => t.status === status);
    }
    getOrThrow(id) {
        const t = taskStore_1.taskStore.get(id);
        if (!t)
            throw new Error(`[TaskQueue] Task not found: ${id}`);
        return t;
    }
}
exports.TaskQueue = TaskQueue;
exports.taskQueue = new TaskQueue();
