"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskStateManager = exports.TaskStateManager = void 0;
// core/taskState.ts — Persistent step-level task state.
// Enables crash recovery, idempotent execution, and token budgeting.
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const TASKS_DIR = path_1.default.join(process.cwd(), 'workspace', 'tasks');
// ── TaskStateManager ───────────────────────────────────────────
class TaskStateManager {
    create(taskId, goal, totalSteps, planId) {
        const state = {
            id: taskId,
            goal,
            planId,
            status: 'running',
            currentStep: 0,
            totalSteps,
            steps: [],
            tokenUsage: 0,
            tokenLimit: 50000,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        this.save(state);
        return state;
    }
    load(taskId) {
        try {
            const statePath = path_1.default.join(TASKS_DIR, taskId, 'state.json');
            if (!fs_1.default.existsSync(statePath))
                return null;
            return JSON.parse(fs_1.default.readFileSync(statePath, 'utf-8'));
        }
        catch {
            return null;
        }
    }
    save(state) {
        try {
            const taskDir = path_1.default.join(TASKS_DIR, state.id);
            fs_1.default.mkdirSync(taskDir, { recursive: true });
            state.updatedAt = Date.now();
            // Atomic write — temp file then rename, avoids corruption on crash
            const statePath = path_1.default.join(taskDir, 'state.json');
            const tempPath = path_1.default.join(taskDir, 'state.tmp.json');
            fs_1.default.writeFileSync(tempPath, JSON.stringify(state, null, 2));
            fs_1.default.renameSync(tempPath, statePath);
        }
        catch (e) {
            console.error(`[TaskState] Save failed for ${state.id}: ${e.message}`);
        }
    }
    startStep(state, index, tool, input) {
        const existing = state.steps.find(s => s.index === index);
        if (!existing) {
            state.steps.push({ index, tool, input, status: 'pending' });
        }
        state.currentStep = index;
        this.save(state);
    }
    // NEVER overwrite a completed step — idempotency guard
    completeStep(state, index, output, duration) {
        const step = state.steps.find(s => s.index === index);
        if (step && step.status === 'completed') {
            console.log(`[TaskState] Step ${index} already completed — skipping overwrite`);
            return;
        }
        if (step) {
            step.status = 'completed';
            step.output = output.slice(0, 2000); // cap stored output
            step.duration = duration;
            step.completedAt = Date.now();
        }
        // Estimate token usage — chars/4 is a reasonable approximation
        state.tokenUsage += Math.ceil(output.length / 4);
        this.save(state);
    }
    failStep(state, index, error) {
        const step = state.steps.find(s => s.index === index);
        if (step) {
            step.status = 'failed';
            step.error = error;
            step.completedAt = Date.now();
        }
        this.save(state);
    }
    complete(state) {
        state.status = 'completed';
        state.completedAt = Date.now();
        this.save(state);
    }
    fail(state, error) {
        state.status = 'failed';
        state.error = error;
        state.completedAt = Date.now();
        this.save(state);
    }
    isStepCompleted(state, index) {
        const step = state.steps.find(s => s.index === index);
        return step?.status === 'completed';
    }
    isOverBudget(state) {
        return state.tokenUsage >= state.tokenLimit;
    }
    // Find the first incomplete step index — used to find resume point after crash
    getResumePoint(state) {
        for (let i = 0; i < state.totalSteps; i++) {
            const step = state.steps.find(s => s.index === i);
            if (!step || step.status !== 'completed')
                return i;
        }
        return state.totalSteps; // all steps done
    }
    getRunningTasks() {
        const running = [];
        try {
            if (!fs_1.default.existsSync(TASKS_DIR))
                return [];
            const dirs = fs_1.default.readdirSync(TASKS_DIR).filter(d => d.startsWith('task_'));
            for (const dir of dirs) {
                const state = this.load(dir);
                if (state && state.status === 'running')
                    running.push(state);
            }
        }
        catch { }
        return running;
    }
    listAll() {
        try {
            if (!fs_1.default.existsSync(TASKS_DIR))
                return [];
            return fs_1.default.readdirSync(TASKS_DIR)
                .filter(d => d.startsWith('task_'))
                .sort().reverse().slice(0, 20)
                .map(dir => {
                const state = this.load(dir);
                if (!state)
                    return null;
                return {
                    id: state.id,
                    goal: state.goal.slice(0, 80),
                    status: state.status,
                    currentStep: state.currentStep,
                    totalSteps: state.totalSteps,
                    tokenUsage: state.tokenUsage,
                    tokenLimit: state.tokenLimit,
                    createdAt: state.createdAt,
                    updatedAt: state.updatedAt,
                };
            })
                .filter(Boolean);
        }
        catch {
            return [];
        }
    }
}
exports.TaskStateManager = TaskStateManager;
exports.taskStateManager = new TaskStateManager();
