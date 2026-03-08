// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// devos/runtime/workspaceManager.ts — Per-goal workspace lifecycle

import fs   from "fs";
import path from "path";

const DEVOS_ROOT    = process.cwd();
const TASKS_DIR     = path.join(DEVOS_ROOT, "workspace", "tasks");
const ARCHIVE_DIR   = path.join(DEVOS_ROOT, "workspace", "archive");

export class WorkspaceManager {
  private active = new Map<string, string>();

  constructor() {
    fs.mkdirSync(TASKS_DIR,   { recursive: true });
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  }

  /** Create workspace/tasks/task_<goalId>/, return its absolute path */
  async create(goalId: string): Promise<string> {
    const dir = path.join(TASKS_DIR, `task_${goalId}`);
    fs.mkdirSync(dir, { recursive: true });
    this.active.set(goalId, dir);
    console.log(`[WorkspaceManager] Created: ${dir}`);
    return dir;
  }

  /** Return absolute workspace path for a goal */
  get(goalId: string): string {
    const cached = this.active.get(goalId);
    if (cached) return cached;
    const dir = path.join(TASKS_DIR, `task_${goalId}`);
    this.active.set(goalId, dir);
    return dir;
  }

  /** List all currently tracked workspace paths */
  list(): string[] {
    return Array.from(this.active.values());
  }

  /** Move workspace to workspace/archive/task_<goalId>/ */
  async archive(goalId: string): Promise<void> {
    const src  = this.get(goalId);
    const dest = path.join(ARCHIVE_DIR, `task_${goalId}`);
    if (!fs.existsSync(src)) {
      console.warn(`[WorkspaceManager] archive: path not found: ${src}`);
      return;
    }
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
    fs.renameSync(src, dest);
    this.active.delete(goalId);
    console.log(`[WorkspaceManager] Archived: ${src} → ${dest}`);
  }

  /** Permanently delete workspace for a goal */
  async cleanup(goalId: string): Promise<void> {
    const dir = this.get(goalId);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`[WorkspaceManager] Cleaned up: ${dir}`);
    }
    this.active.delete(goalId);
  }
}

export const workspaceManager = new WorkspaceManager();
