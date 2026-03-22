// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// ============================================================
// devos/company/projectContext.ts — Project & Agent Status Store
// Persists company projects to workspace/projects.json
// ============================================================

import fs   from "fs";
import path from "path";

// ── Interfaces ────────────────────────────────────────────────

export interface AgentStatus {
  role: string;
  status: "idle" | "running" | "completed" | "failed";
  currentTask?: string;
  completedTasks: string[];
  output?: string;
}

export interface ProjectContext {
  id: string;
  name: string;
  objective: string;
  status: "planning" | "active" | "paused" | "completed";
  createdAt: string;
  updatedAt: string;
  agents: AgentStatus[];
  artifacts: string[];
  memories: string[];
}

// ── Storage paths ─────────────────────────────────────────────

const STORE_DIR  = path.join(process.cwd(), "workspace");
const STORE_FILE = path.join(STORE_DIR, "projects.json");

// ── ProjectStore ──────────────────────────────────────────────

export class ProjectStore {
  private projects: Map<string, ProjectContext> = new Map();

  constructor() {
    this._load();
  }

  private _load(): void {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_FILE)) {
      this._persist();
      return;
    }
    try {
      const raw  = fs.readFileSync(STORE_FILE, "utf-8");
      const list: ProjectContext[] = JSON.parse(raw);
      this.projects.clear();
      for (const p of list) this.projects.set(p.id, p);
    } catch (err: any) {
      console.error(`[ProjectStore] Load failed: ${err.message}`);
    }
  }

  private _persist(): void {
    const tmp = STORE_FILE + ".tmp";
    try {
      if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify(this.list(), null, 2), "utf-8");
      fs.renameSync(tmp, STORE_FILE);
    } catch (err: any) {
      console.error(`[ProjectStore] Persist failed: ${err.message}`);
    }
  }

  create(name: string, objective: string): ProjectContext {
    const now = new Date().toISOString();
    const project: ProjectContext = {
      id:        `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      objective,
      status:    "planning",
      createdAt: now,
      updatedAt: now,
      agents: [
        { role: "strategy",    status: "idle", completedTasks: [] },
        { role: "research",    status: "idle", completedTasks: [] },
        { role: "product",     status: "idle", completedTasks: [] },
        { role: "engineering", status: "idle", completedTasks: [] },
        { role: "qa",          status: "idle", completedTasks: [] },
        { role: "growth",      status: "idle", completedTasks: [] },
      ],
      artifacts: [],
      memories:  [],
    };
    this.projects.set(project.id, project);
    this._persist();
    return project;
  }

  get(id: string): ProjectContext | undefined {
    return this.projects.get(id);
  }

  update(id: string, partial: Partial<ProjectContext>): ProjectContext | undefined {
    const existing = this.projects.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...partial, id, updatedAt: new Date().toISOString() };
    this.projects.set(id, updated);
    this._persist();
    return updated;
  }

  list(): ProjectContext[] {
    return Array.from(this.projects.values()).sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt)
    );
  }

  addArtifact(id: string, artifactPath: string): void {
    const project = this.projects.get(id);
    if (!project) return;
    project.artifacts.push(artifactPath);
    project.updatedAt = new Date().toISOString();
    this.projects.set(id, project);
    this._persist();
  }

  updateAgent(id: string, role: string, status: Partial<AgentStatus>): void {
    const project = this.projects.get(id);
    if (!project) return;
    const agentIdx = project.agents.findIndex(a => a.role === role);
    if (agentIdx === -1) {
      project.agents.push({ role, status: "idle", completedTasks: [], ...status });
    } else {
      project.agents[agentIdx] = { ...project.agents[agentIdx], ...status };
    }
    project.updatedAt = new Date().toISOString();
    this.projects.set(id, project);
    this._persist();
  }
}
