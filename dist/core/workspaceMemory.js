"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceMemory = void 0;
// core/workspaceMemory.ts — Per-task file workspace.
// Each task gets an isolated directory for intermediate artifacts.
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class WorkspaceMemory {
    constructor(taskId) {
        this.taskDir = path_1.default.join(process.cwd(), 'workspace', 'tasks', taskId);
        fs_1.default.mkdirSync(this.taskDir, { recursive: true });
    }
    write(filename, content) {
        const filePath = path_1.default.join(this.taskDir, filename);
        fs_1.default.writeFileSync(filePath, content, 'utf-8');
        return filePath;
    }
    read(filename) {
        const filePath = path_1.default.join(this.taskDir, filename);
        if (!fs_1.default.existsSync(filePath))
            return null;
        return fs_1.default.readFileSync(filePath, 'utf-8');
    }
    append(filename, content) {
        const filePath = path_1.default.join(this.taskDir, filename);
        fs_1.default.appendFileSync(filePath, content + '\n', 'utf-8');
        return filePath;
    }
    exists(filename) {
        return fs_1.default.existsSync(path_1.default.join(this.taskDir, filename));
    }
    getPath(filename) {
        return path_1.default.join(this.taskDir, filename);
    }
    getDir() {
        return this.taskDir;
    }
    list() {
        try {
            return fs_1.default.readdirSync(this.taskDir);
        }
        catch {
            return [];
        }
    }
}
exports.WorkspaceMemory = WorkspaceMemory;
