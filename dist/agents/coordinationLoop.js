"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.coordinationLoop = exports.CoordinationLoop = void 0;
// agents/coordinationLoop.ts — Autonomous multi-agent coordination engine
const goalEngine_1 = require("../goals/goalEngine");
const goalStore_1 = require("../goals/goalStore");
const agentExecutor_1 = require("./agentExecutor");
const agentMessenger_1 = require("./agentMessenger");
class CoordinationLoop {
    constructor() {
        this.running = false;
    }
    async start(goalId) {
        this.running = true;
        console.log(`[CoordinationLoop] 🔄 Starting for goal: ${goalId}`);
        const { goal, projects, tasks } = await goalEngine_1.goalEngine.getStatus(goalId);
        // Phase 1: CEO plans
        agentMessenger_1.agentMessenger.send('user', 'ceo', `Execute this goal: ${goal.title} — ${goal.description}`, 'instruction', goalId);
        const ceoResult = await agentExecutor_1.agentExecutor.assign('ceo', { id: goalId, title: 'Plan goal', description: goal.description }, goal.title);
        agentMessenger_1.agentMessenger.send('ceo', 'all', ceoResult, 'result', goalId);
        // Phase 2: Execute projects in order — assign to right agent by type
        for (const project of projects) {
            if (!this.running)
                break;
            goalStore_1.goalStore.updateProject(project.id, { status: 'active' });
            const role = this.pickAgent(project.title);
            const projectTasks = goalStore_1.goalStore.listReadyTasks(project.id);
            for (const task of projectTasks) {
                if (!this.running)
                    break;
                agentMessenger_1.agentMessenger.send('ceo', role, `Handle this task: ${task.title}`, 'instruction', task.id);
                const result = await agentExecutor_1.agentExecutor.assign(role, task, goal.title);
                goalStore_1.goalStore.updateTask(task.id, { status: 'completed', result, completedAt: new Date() });
                agentMessenger_1.agentMessenger.send(role, 'ceo', result, 'result', task.id);
            }
            goalStore_1.goalStore.updateProject(project.id, { status: 'completed', completedAt: new Date() });
        }
        // Phase 3: CEO evaluates
        const finalStatus = await goalEngine_1.goalEngine.getStatus(goalId);
        const completedCount = finalStatus.tasks.filter(t => t.status === 'completed').length;
        agentMessenger_1.agentMessenger.send('ceo', 'user', `Goal complete. ${completedCount}/${finalStatus.tasks.length} tasks done.`, 'result', goalId);
        goalStore_1.goalStore.updateGoal(goalId, { status: 'completed', completedAt: new Date() });
        console.log(`[CoordinationLoop] ✅ Goal completed: ${goal.title}`);
    }
    stop() {
        this.running = false;
        console.log(`[CoordinationLoop] ⏹ Stopped`);
    }
    pickAgent(projectTitle) {
        const t = projectTitle.toLowerCase();
        if (t.includes('research') || t.includes('analyz') || t.includes('market'))
            return 'researcher';
        if (t.includes('deploy') || t.includes('infra') || t.includes('server'))
            return 'operator';
        if (t.includes('build') || t.includes('code') || t.includes('implement') ||
            t.includes('test'))
            return 'engineer';
        return 'engineer'; // default
    }
}
exports.CoordinationLoop = CoordinationLoop;
exports.coordinationLoop = new CoordinationLoop();
