"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.goalPlanner = exports.GoalPlanner = void 0;
// goals/goalPlanner.ts — LLM-powered goal decomposition into projects + tasks
const ollama_1 = require("../llm/ollama");
const goalStore_1 = require("./goalStore");
function extractJSON(raw) {
    // Strip markdown code fences if present
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced)
        return fenced[1].trim();
    // Find first { … } block
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end !== -1)
        return raw.slice(start, end + 1);
    return raw.trim();
}
class GoalPlanner {
    async plan(goalId) {
        const goal = goalStore_1.goalStore.getGoal(goalId);
        if (!goal)
            throw new Error(`[GoalPlanner] Goal not found: ${goalId}`);
        goalStore_1.goalStore.updateGoal(goalId, { status: 'planning' });
        const prompt = `You are a project planner. Break this goal into projects and tasks.
Goal: ${goal.title} — ${goal.description}

Return JSON only:
{
  "projects": [
    {
      "title": "Research",
      "description": "...",
      "order": 1,
      "tasks": [
        { "title": "...", "description": "...", "priority": 8, "dependencies": [] }
      ]
    }
  ]
}`;
        const raw = await (0, ollama_1.callOllama)(prompt);
        const json = extractJSON(raw);
        let plan;
        try {
            plan = JSON.parse(json);
        }
        catch (err) {
            console.error(`[GoalPlanner] Failed to parse LLM response: ${json.slice(0, 200)}`);
            throw new Error(`[GoalPlanner] Invalid JSON from LLM: ${String(err)}`);
        }
        if (!Array.isArray(plan.projects) || plan.projects.length === 0) {
            throw new Error('[GoalPlanner] LLM returned no projects');
        }
        let totalTasks = 0;
        for (const rawProj of plan.projects) {
            const project = goalStore_1.goalStore.createProject(goalId, rawProj.title ?? 'Unnamed project', rawProj.description ?? '', rawProj.order ?? 1);
            // First pass: create all tasks and build title→id map
            const titleToId = new Map();
            const createdTasks = [];
            for (const rawTask of (rawProj.tasks ?? [])) {
                const task = goalStore_1.goalStore.createTask(project.id, goalId, rawTask.title ?? 'Unnamed task', rawTask.description ?? '', []);
                if (rawTask.priority && typeof rawTask.priority === 'number') {
                    goalStore_1.goalStore.updateTask(task.id, { priority: rawTask.priority });
                }
                titleToId.set(rawTask.title, task.id);
                createdTasks.push(task);
                totalTasks++;
            }
            // Second pass: wire dependencies by title → id
            for (let i = 0; i < createdTasks.length; i++) {
                const rawTask = rawProj.tasks[i];
                const deps = (rawTask.dependencies ?? []);
                if (deps.length > 0) {
                    const depIds = deps
                        .map((d) => titleToId.get(d))
                        .filter((id) => !!id);
                    goalStore_1.goalStore.updateTask(createdTasks[i].id, { dependencies: depIds });
                }
            }
        }
        goalStore_1.goalStore.updateGoal(goalId, { status: 'active' });
        console.log(`[GoalPlanner] ✅ Planned: ${plan.projects.length} projects, ${totalTasks} tasks`);
    }
    /** Replan a failed goal — keep completed tasks, reset only failed/pending ones */
    async replan(goalId) {
        const goal = goalStore_1.goalStore.getGoal(goalId);
        if (!goal)
            throw new Error(`[GoalPlanner] Goal not found: ${goalId}`);
        // Reset failed tasks to pending so they can be retried
        for (const projectId of goal.projects) {
            const tasks = goalStore_1.goalStore.listTasks(projectId);
            for (const task of tasks) {
                if (task.status === 'failed' || task.status === 'pending') {
                    goalStore_1.goalStore.updateTask(task.id, { status: 'pending', retryCount: 0, error: undefined });
                }
            }
            // Reset project status if needed
            const project = goalStore_1.goalStore.getProject(projectId);
            if (project?.status === 'failed') {
                goalStore_1.goalStore.updateProject(projectId, { status: 'pending' });
            }
        }
        goalStore_1.goalStore.updateGoal(goalId, { status: 'active' });
        console.log(`[GoalPlanner] ♻️  Replanned goal: ${goal.title}`);
    }
}
exports.GoalPlanner = GoalPlanner;
exports.goalPlanner = new GoalPlanner();
