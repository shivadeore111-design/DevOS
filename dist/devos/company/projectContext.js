"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectStore = void 0;
// ============================================================
// devos/company/projectContext.ts — Project & Agent Status Store
// Persists company projects to workspace/projects.json
// ============================================================
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// ── Storage paths ─────────────────────────────────────────────
const STORE_DIR = path_1.default.join(process.cwd(), "workspace");
const STORE_FILE = path_1.default.join(STORE_DIR, "projects.json");
// ── ProjectStore ──────────────────────────────────────────────
class ProjectStore {
    constructor() {
        this.projects = new Map();
        this._load();
    }
    _load() {
        if (!fs_1.default.existsSync(STORE_DIR)) {
            fs_1.default.mkdirSync(STORE_DIR, { recursive: true });
        }
        if (!fs_1.default.existsSync(STORE_FILE)) {
            this._persist();
            return;
        }
        try {
            const raw = fs_1.default.readFileSync(STORE_FILE, "utf-8");
            const list = JSON.parse(raw);
            this.projects.clear();
            for (const p of list)
                this.projects.set(p.id, p);
        }
        catch (err) {
            console.error(`[ProjectStore] Load failed: ${err.message}`);
        }
    }
    _persist() {
        const tmp = STORE_FILE + ".tmp";
        try {
            if (!fs_1.default.existsSync(STORE_DIR))
                fs_1.default.mkdirSync(STORE_DIR, { recursive: true });
            fs_1.default.writeFileSync(tmp, JSON.stringify(this.list(), null, 2), "utf-8");
            fs_1.default.renameSync(tmp, STORE_FILE);
        }
        catch (err) {
            console.error(`[ProjectStore] Persist failed: ${err.message}`);
        }
    }
    create(name, objective) {
        const now = new Date().toISOString();
        const project = {
            id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name,
            objective,
            status: "planning",
            createdAt: now,
            updatedAt: now,
            agents: [
                { role: "strategy", status: "idle", completedTasks: [] },
                { role: "research", status: "idle", completedTasks: [] },
                { role: "product", status: "idle", completedTasks: [] },
                { role: "engineering", status: "idle", completedTasks: [] },
                { role: "qa", status: "idle", completedTasks: [] },
                { role: "growth", status: "idle", completedTasks: [] },
            ],
            artifacts: [],
            memories: [],
        };
        this.projects.set(project.id, project);
        this._persist();
        return project;
    }
    get(id) {
        return this.projects.get(id);
    }
    update(id, partial) {
        const existing = this.projects.get(id);
        if (!existing)
            return undefined;
        const updated = { ...existing, ...partial, id, updatedAt: new Date().toISOString() };
        this.projects.set(id, updated);
        this._persist();
        return updated;
    }
    list() {
        return Array.from(this.projects.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    addArtifact(id, artifactPath) {
        const project = this.projects.get(id);
        if (!project)
            return;
        project.artifacts.push(artifactPath);
        project.updatedAt = new Date().toISOString();
        this.projects.set(id, project);
        this._persist();
    }
    updateAgent(id, role, status) {
        const project = this.projects.get(id);
        if (!project)
            return;
        const agentIdx = project.agents.findIndex(a => a.role === role);
        if (agentIdx === -1) {
            project.agents.push({ role, status: "idle", completedTasks: [], ...status });
        }
        else {
            project.agents[agentIdx] = { ...project.agents[agentIdx], ...status };
        }
        project.updatedAt = new Date().toISOString();
        this.projects.set(id, project);
        this._persist();
    }
}
exports.ProjectStore = ProjectStore;
