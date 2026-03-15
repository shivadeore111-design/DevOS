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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.goalStore = exports.GoalStore = void 0;
// goals/goalStore.ts — Persistent store for Goals, Projects, Tasks
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = __importDefault(require("crypto"));
function makeId(prefix) {
    return `${prefix}_${crypto_1.default.randomBytes(6).toString('hex')}`;
}
function now() {
    return new Date();
}
class GoalStore {
    constructor() {
        this.goals = new Map();
        this.projects = new Map();
        this.tasks = new Map();
        const ws = path.join(process.cwd(), 'workspace');
        this.goalsPath = path.join(ws, 'goals.json');
        this.projectsPath = path.join(ws, 'goal_projects.json');
        this.tasksPath = path.join(ws, 'goal_tasks.json');
        fs.mkdirSync(ws, { recursive: true });
        this.load();
    }
    // ── Persistence ───────────────────────────────────────────
    load() {
        this.goals = this.readMap(this.goalsPath);
        this.projects = this.readMap(this.projectsPath);
        this.tasks = this.readMap(this.tasksPath);
    }
    readMap(filePath) {
        try {
            if (!fs.existsSync(filePath))
                return new Map();
            const raw = fs.readFileSync(filePath, 'utf-8');
            const obj = JSON.parse(raw);
            return new Map(Object.entries(obj));
        }
        catch {
            return new Map();
        }
    }
    saveGoals() { this.writeMap(this.goalsPath, this.goals); }
    saveProjects() { this.writeMap(this.projectsPath, this.projects); }
    saveTasks() { this.writeMap(this.tasksPath, this.tasks); }
    writeMap(filePath, map) {
        const obj = {};
        for (const [k, v] of map)
            obj[k] = v;
        fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
    }
    // ── Goals ─────────────────────────────────────────────────
    createGoal(title, description) {
        const goal = {
            id: makeId('goal'),
            title,
            description,
            status: 'pending',
            projects: [],
            createdAt: now(),
            updatedAt: now(),
            metadata: {},
        };
        this.goals.set(goal.id, goal);
        this.saveGoals();
        return goal;
    }
    getGoal(id) {
        return this.goals.get(id) ?? null;
    }
    listGoals(status) {
        const all = Array.from(this.goals.values());
        return status ? all.filter(g => g.status === status) : all;
    }
    updateGoal(id, updates) {
        const goal = this.goals.get(id);
        if (!goal)
            return;
        Object.assign(goal, updates, { updatedAt: now() });
        this.goals.set(id, goal);
        this.saveGoals();
    }
    // ── Projects ──────────────────────────────────────────────
    createProject(goalId, title, description, order) {
        const project = {
            id: makeId('proj'),
            goalId,
            title,
            description,
            status: 'pending',
            tasks: [],
            order,
            createdAt: now(),
        };
        this.projects.set(project.id, project);
        this.saveProjects();
        // Register project id on parent goal
        const goal = this.goals.get(goalId);
        if (goal) {
            goal.projects.push(project.id);
            goal.updatedAt = now();
            this.goals.set(goalId, goal);
            this.saveGoals();
        }
        return project;
    }
    getProject(id) {
        return this.projects.get(id) ?? null;
    }
    listProjects(goalId) {
        return Array.from(this.projects.values())
            .filter(p => p.goalId === goalId)
            .sort((a, b) => a.order - b.order);
    }
    updateProject(id, updates) {
        const project = this.projects.get(id);
        if (!project)
            return;
        Object.assign(project, updates);
        this.projects.set(id, project);
        this.saveProjects();
    }
    // ── Tasks ─────────────────────────────────────────────────
    createTask(projectId, goalId, title, description, deps = []) {
        const task = {
            id: makeId('task'),
            projectId,
            goalId,
            title,
            description,
            status: 'pending',
            dependencies: deps,
            priority: 5,
            createdAt: now(),
            retryCount: 0,
            maxRetries: 1,
        };
        this.tasks.set(task.id, task);
        this.saveTasks();
        // Register task id on parent project
        const project = this.projects.get(projectId);
        if (project) {
            project.tasks.push(task.id);
            this.projects.set(projectId, project);
            this.saveProjects();
        }
        return task;
    }
    getTask(id) {
        return this.tasks.get(id) ?? null;
    }
    listTasks(projectId) {
        return Array.from(this.tasks.values())
            .filter(t => t.projectId === projectId);
    }
    /** Tasks where all dependency tasks are completed */
    listReadyTasks(projectId) {
        const projectTasks = this.listTasks(projectId);
        return projectTasks.filter(task => {
            if (task.status !== 'pending')
                return false;
            return task.dependencies.every(depId => {
                const dep = this.tasks.get(depId);
                return dep?.status === 'completed';
            });
        });
    }
    updateTask(id, updates) {
        const task = this.tasks.get(id);
        if (!task)
            return;
        Object.assign(task, updates);
        this.tasks.set(id, task);
        this.saveTasks();
    }
}
exports.GoalStore = GoalStore;
exports.goalStore = new GoalStore();
