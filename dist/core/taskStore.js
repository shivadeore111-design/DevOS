"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskStore = exports.TaskStore = void 0;
// ============================================================
// taskStore.ts — DevOS Persistence Layer
// JSON-backed, atomic writes, in-memory Map for runtime speed
// ============================================================
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const STORE_DIR = path_1.default.join(process.cwd(), "workspace", "tasks");
const STORE_FILE = path_1.default.join(STORE_DIR, "tasks.json");
class TaskStore {
    constructor() {
        this.tasks = new Map();
    }
    load() {
        if (!fs_1.default.existsSync(STORE_DIR)) {
            fs_1.default.mkdirSync(STORE_DIR, { recursive: true });
        }
        if (!fs_1.default.existsSync(STORE_FILE)) {
            this.persist();
            return;
        }
        try {
            const raw = fs_1.default.readFileSync(STORE_FILE, "utf-8");
            const list = JSON.parse(raw);
            this.tasks.clear();
            for (const t of list)
                this.tasks.set(t.id, t);
            console.log(`[TaskStore] Loaded ${this.tasks.size} task(s).`);
        }
        catch (err) {
            console.error(`[TaskStore] Load failed: ${err.message}`);
        }
    }
    get(id) {
        return this.tasks.get(id);
    }
    getAll() {
        return Array.from(this.tasks.values());
    }
    save(task) {
        task.updatedAt = new Date().toISOString();
        this.tasks.set(task.id, task);
        this.persist();
    }
    delete(id) {
        const ok = this.tasks.delete(id);
        if (ok)
            this.persist();
        return ok;
    }
    /**
     * Directly claim a specific task by ID if its status is `queued`.
     * Allows the runner to claim its just-created task without racing
     * against other queued tasks.
     */
    claim(taskId, agentId) {
        const task = this.tasks.get(taskId);
        if (!task || task.status !== "queued")
            return undefined;
        task.status = "claimed";
        task.claimedBy = agentId;
        task.claimedAt = new Date().toISOString();
        task.logs.push({
            timestamp: new Date().toISOString(),
            level: "info",
            message: `Claimed by agent ${agentId}`,
        });
        this.save(task);
        return task;
    }
    /**
     * Atomically claim the next eligible queued task.
     * AND-logic: all blockedBy deps must be completed first.
     * Priority order: critical > high > normal > low
     */
    claimNext(agentId) {
        const completedIds = new Set(this.getAll().filter(t => t.status === "completed").map(t => t.id));
        const PRIO = { critical: 3, high: 2, normal: 1, low: 0 };
        const next = this.getAll()
            .filter(t => t.status === "queued" && t.blockedBy.every(id => completedIds.has(id)))
            .sort((a, b) => PRIO[b.priority] - PRIO[a.priority])[0];
        if (!next)
            return undefined;
        next.status = "claimed";
        next.claimedBy = agentId;
        next.claimedAt = new Date().toISOString();
        next.logs.push({
            timestamp: new Date().toISOString(),
            level: "info",
            message: `Claimed by agent ${agentId}`,
        });
        this.save(next);
        return next;
    }
    /**
     * Remove tasks whose `updatedAt` is older than `maxAgeMs` milliseconds.
     * Returns the count of tasks removed.
     */
    clearStale(maxAgeMs = 3600000) {
        const cutoff = Date.now() - maxAgeMs;
        let count = 0;
        for (const task of Array.from(this.tasks.values())) {
            if (Date.parse(task.updatedAt) < cutoff) {
                this.tasks.delete(task.id);
                count++;
            }
        }
        if (count > 0)
            this.persist();
        return count;
    }
    persist() {
        const tmp = STORE_FILE + ".tmp";
        try {
            if (!fs_1.default.existsSync(STORE_DIR))
                fs_1.default.mkdirSync(STORE_DIR, { recursive: true });
            fs_1.default.writeFileSync(tmp, JSON.stringify(this.getAll(), null, 2), "utf-8");
            fs_1.default.renameSync(tmp, STORE_FILE);
        }
        catch (err) {
            console.error(`[TaskStore] Persist failed: ${err.message}`);
        }
    }
}
exports.TaskStore = TaskStore;
exports.taskStore = new TaskStore();
