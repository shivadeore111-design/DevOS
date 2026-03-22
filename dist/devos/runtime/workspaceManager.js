"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.workspaceManager = exports.WorkspaceManager = void 0;
// devos/runtime/workspaceManager.ts — Per-goal workspace lifecycle
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DEVOS_ROOT = process.cwd();
const TASKS_DIR = path_1.default.join(DEVOS_ROOT, "workspace", "tasks");
const ARCHIVE_DIR = path_1.default.join(DEVOS_ROOT, "workspace", "archive");
class WorkspaceManager {
    constructor() {
        this.active = new Map();
        fs_1.default.mkdirSync(TASKS_DIR, { recursive: true });
        fs_1.default.mkdirSync(ARCHIVE_DIR, { recursive: true });
    }
    /** Create workspace/tasks/task_<goalId>/, return its absolute path */
    async create(goalId) {
        const dir = path_1.default.join(TASKS_DIR, `task_${goalId}`);
        fs_1.default.mkdirSync(dir, { recursive: true });
        this.active.set(goalId, dir);
        console.log(`[WorkspaceManager] Created: ${dir}`);
        return dir;
    }
    /** Return absolute workspace path for a goal */
    get(goalId) {
        const cached = this.active.get(goalId);
        if (cached)
            return cached;
        const dir = path_1.default.join(TASKS_DIR, `task_${goalId}`);
        this.active.set(goalId, dir);
        return dir;
    }
    /** List all currently tracked workspace paths */
    list() {
        return Array.from(this.active.values());
    }
    /** Move workspace to workspace/archive/task_<goalId>/ */
    async archive(goalId) {
        const src = this.get(goalId);
        const dest = path_1.default.join(ARCHIVE_DIR, `task_${goalId}`);
        if (!fs_1.default.existsSync(src)) {
            console.warn(`[WorkspaceManager] archive: path not found: ${src}`);
            return;
        }
        fs_1.default.mkdirSync(ARCHIVE_DIR, { recursive: true });
        fs_1.default.renameSync(src, dest);
        this.active.delete(goalId);
        console.log(`[WorkspaceManager] Archived: ${src} → ${dest}`);
    }
    /** Permanently delete workspace for a goal */
    async cleanup(goalId) {
        const dir = this.get(goalId);
        if (fs_1.default.existsSync(dir)) {
            fs_1.default.rmSync(dir, { recursive: true, force: true });
            console.log(`[WorkspaceManager] Cleaned up: ${dir}`);
        }
        this.active.delete(goalId);
    }
}
exports.WorkspaceManager = WorkspaceManager;
exports.workspaceManager = new WorkspaceManager();
