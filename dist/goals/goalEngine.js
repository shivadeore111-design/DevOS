"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.goalEngine = exports.GoalEngine = void 0;
// goals/goalEngine.ts — Main Goal Engine orchestrator
const goalStore_1 = require("./goalStore");
const goalPlanner_1 = require("./goalPlanner");
const goalExecutor_1 = require("./goalExecutor");
class GoalEngine {
    async run(title, description) {
        // 1. Create goal
        const goal = goalStore_1.goalStore.createGoal(title, description);
        console.log(`[GoalEngine] 🎯 New goal: ${title} (${goal.id})`);
        // 2. Plan it
        await goalPlanner_1.goalPlanner.plan(goal.id);
        // 3. Execute it
        await goalExecutor_1.goalExecutor.execute(goal.id);
        // 4. Return final goal state
        return goalStore_1.goalStore.getGoal(goal.id);
    }
    async list(status) {
        return goalStore_1.goalStore.listGoals(status);
    }
    async getStatus(goalId) {
        const goal = goalStore_1.goalStore.getGoal(goalId);
        const projects = goalStore_1.goalStore.listProjects(goalId);
        const tasks = projects.flatMap(p => goalStore_1.goalStore.listTasks(p.id));
        return { goal, projects, tasks };
    }
}
exports.GoalEngine = GoalEngine;
exports.goalEngine = new GoalEngine();
