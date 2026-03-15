"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.goalExecutor = exports.GoalExecutor = void 0;
// goals/goalExecutor.ts — Executes Goal→Project→Task hierarchy via Runner
const path = __importStar(require("path"));
const runner_1 = require("../core/runner");
const engine_1 = require("../executor/engine");
const eventBus_1 = require("../core/eventBus");
const goalStore_1 = require("./goalStore");
class GoalExecutor {
    constructor() {
        /** Goals currently paused (goalId set) */
        this.paused = new Set();
    }
    makeRunner(agentId) {
        const ws = path.join(process.cwd(), 'workspace', 'sandbox');
        const engine = new engine_1.DevOSEngine(ws, false);
        return new runner_1.Runner({ agentId, engine });
    }
    /** Execute a single task description via the Runner */
    async runTask(task, goalTitle, goalDescription, projectTitle) {
        try {
            const runner = this.makeRunner(`goal-exec-${task.id}`);
            const goalContext = `Goal: ${goalTitle}
Description: ${goalDescription}
Project: ${projectTitle}
Task: ${task.title}
Instructions: ${task.description}

Execute this specific task as part of the larger goal. Use file_write, shell_exec, or other appropriate actions.`;
            const devTask = await runner.runOnce(goalContext);
            if (devTask.status === 'completed') {
                return { success: true, result: JSON.stringify(devTask.output ?? devTask.result ?? 'done') };
            }
            return { success: false, error: devTask.error ?? 'Task runner returned failure' };
        }
        catch (err) {
            return { success: false, error: err?.message ?? String(err) };
        }
    }
    async execute(goalId) {
        const goal = goalStore_1.goalStore.getGoal(goalId);
        if (!goal)
            throw new Error(`[GoalExecutor] Goal not found: ${goalId}`);
        console.log(`[GoalExecutor] 🚀 Executing goal: ${goal.title}`);
        const projects = goalStore_1.goalStore.listProjects(goalId);
        let goalFailed = false;
        for (const project of projects) {
            if (this.paused.has(goalId)) {
                console.log(`[GoalExecutor] ⏸  Goal paused: ${goal.title}`);
                goalStore_1.goalStore.updateGoal(goalId, { status: 'paused' });
                return;
            }
            goalStore_1.goalStore.updateProject(project.id, { status: 'active' });
            // Execute all ready tasks in the project (loop until none left)
            let iterations = 0;
            while (true) {
                if (this.paused.has(goalId))
                    break;
                const readyTasks = goalStore_1.goalStore.listReadyTasks(project.id);
                if (readyTasks.length === 0)
                    break;
                if (iterations++ > 1000) {
                    console.warn('[GoalExecutor] ⚠️  Max iterations reached');
                    break;
                }
                for (const task of readyTasks) {
                    if (this.paused.has(goalId))
                        break;
                    goalStore_1.goalStore.updateTask(task.id, { status: 'active' });
                    console.log(`[GoalExecutor]   ▶ Task: ${task.title}`);
                    let attempt = await this.runTask(task, goal.title, goal.description, project.title);
                    if (!attempt.success && task.retryCount < task.maxRetries) {
                        console.warn(`[GoalExecutor]   🔄 Retrying task: ${task.title}`);
                        goalStore_1.goalStore.updateTask(task.id, { retryCount: task.retryCount + 1 });
                        attempt = await this.runTask(task, goal.title, goal.description, project.title);
                    }
                    if (attempt.success) {
                        goalStore_1.goalStore.updateTask(task.id, {
                            status: 'completed',
                            result: attempt.result,
                            completedAt: new Date(),
                        });
                        eventBus_1.eventBus.emit('task_completed', { taskId: task.id, goalId, title: task.title });
                        console.log(`[GoalExecutor]   ✅ ${task.title}`);
                    }
                    else {
                        goalStore_1.goalStore.updateTask(task.id, {
                            status: 'failed',
                            error: attempt.error,
                        });
                        eventBus_1.eventBus.emit('task_failed', { taskId: task.id, goalId, title: task.title, error: attempt.error });
                        console.error(`[GoalExecutor]   ❌ ${task.title}: ${attempt.error}`);
                        goalFailed = true;
                    }
                }
            }
            // Determine project completion
            const allTasks = goalStore_1.goalStore.listTasks(project.id);
            const projectFailed = allTasks.some(t => t.status === 'failed');
            goalStore_1.goalStore.updateProject(project.id, {
                status: projectFailed ? 'failed' : 'completed',
                completedAt: projectFailed ? undefined : new Date(),
            });
        }
        if (goalFailed) {
            goalStore_1.goalStore.updateGoal(goalId, { status: 'failed', updatedAt: new Date() });
            eventBus_1.eventBus.emit('goal_failed', { goalId, title: goal.title });
            console.error(`[GoalExecutor] ❌ Goal failed: ${goal.title}`);
        }
        else {
            goalStore_1.goalStore.updateGoal(goalId, {
                status: 'completed',
                completedAt: new Date(),
                updatedAt: new Date(),
            });
            eventBus_1.eventBus.emit('goal_completed', { goalId, title: goal.title });
            console.log(`[GoalExecutor] ✅ Goal complete: ${goal.title}`);
        }
    }
    pause(goalId) {
        this.paused.add(goalId);
        console.log(`[GoalExecutor] ⏸  Paused: ${goalId}`);
    }
    async resume(goalId) {
        this.paused.delete(goalId);
        const goal = goalStore_1.goalStore.getGoal(goalId);
        if (goal?.status === 'paused') {
            goalStore_1.goalStore.updateGoal(goalId, { status: 'active' });
        }
        console.log(`[GoalExecutor] ▶️  Resuming: ${goalId}`);
        await this.execute(goalId);
    }
}
exports.GoalExecutor = GoalExecutor;
exports.goalExecutor = new GoalExecutor();
