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
exports.taskBus = void 0;
// coordination/taskBus.ts — Central task queue for autonomous missions
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const DATA_FILE = path.join(process.cwd(), 'workspace', 'task-bus.json');
class TaskBus {
    constructor() {
        this.tasks = new Map();
        this.load();
    }
    load() {
        try {
            if (fs.existsSync(DATA_FILE)) {
                const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
                for (const t of raw)
                    this.tasks.set(t.id, t);
                console.log(`[TaskBus] Loaded ${this.tasks.size} tasks`);
            }
        }
        catch { /* start fresh */ }
    }
    save() {
        try {
            fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
            fs.writeFileSync(DATA_FILE, JSON.stringify([...this.tasks.values()], null, 2));
        }
        catch (err) {
            console.warn(`[TaskBus] Save failed: ${err?.message}`);
        }
    }
    enqueue(missionId, tasks) {
        const created = [];
        for (const t of tasks) {
            const busTask = {
                ...t,
                id: crypto.randomUUID(),
                missionId,
                status: 'queued',
                createdAt: new Date().toISOString(),
                retryCount: 0,
            };
            this.tasks.set(busTask.id, busTask);
            created.push(busTask);
        }
        this.save();
        return created;
    }
    /** Return highest-priority queued task for a mission */
    getNext(missionId) {
        const queued = [...this.tasks.values()]
            .filter(t => t.missionId === missionId && t.status === 'queued')
            .sort((a, b) => a.priority - b.priority);
        return queued[0] ?? null;
    }
    claim(taskId, agentRole) {
        const task = this.tasks.get(taskId);
        if (!task)
            return;
        task.status = 'claimed';
        task.claimedAt = new Date().toISOString();
        task.assignedTo = agentRole;
        this.save();
    }
    complete(taskId, result) {
        const task = this.tasks.get(taskId);
        if (!task)
            return;
        task.status = 'completed';
        task.completedAt = new Date().toISOString();
        task.result = result;
        this.save();
    }
    fail(taskId, error) {
        const task = this.tasks.get(taskId);
        if (!task)
            return;
        task.status = 'failed';
        task.error = error;
        this.save();
    }
    getQueue(missionId) {
        return [...this.tasks.values()].filter(t => t.missionId === missionId);
    }
    getPending(missionId) {
        return [...this.tasks.values()].filter(t => t.missionId === missionId && (t.status === 'queued' || t.status === 'claimed'));
    }
    getCompleted(missionId) {
        return [...this.tasks.values()].filter(t => t.missionId === missionId && t.status === 'completed');
    }
}
exports.taskBus = new TaskBus();
