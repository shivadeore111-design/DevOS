// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// ============================================================
// taskStore.ts — DevOS Persistence Layer
// JSON-backed, atomic writes, in-memory Map for runtime speed
// ============================================================

import fs from "fs";
import path from "path";
import { DevOSTask } from "./task";

const STORE_DIR  = path.join(process.cwd(), "workspace", "tasks");
const STORE_FILE = path.join(STORE_DIR, "tasks.json");

export class TaskStore {
  private tasks: Map<string, DevOSTask> = new Map();

  load(): void {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_FILE)) {
      this.persist();
      return;
    }
    try {
      const raw   = fs.readFileSync(STORE_FILE, "utf-8");
      const list: DevOSTask[] = JSON.parse(raw);
      this.tasks.clear();
      for (const t of list) this.tasks.set(t.id, t);
      console.log(`[TaskStore] Loaded ${this.tasks.size} task(s).`);
    } catch (err: any) {
      console.error(`[TaskStore] Load failed: ${err.message}`);
    }
  }

  get(id: string): DevOSTask | undefined {
    return this.tasks.get(id);
  }

  getAll(): DevOSTask[] {
    return Array.from(this.tasks.values());
  }

  save(task: DevOSTask): void {
    task.updatedAt = new Date().toISOString();
    this.tasks.set(task.id, task);
    this.persist();
  }

  delete(id: string): boolean {
    const ok = this.tasks.delete(id);
    if (ok) this.persist();
    return ok;
  }

  /**
   * Atomically claim the next eligible queued task.
   * AND-logic: all blockedBy deps must be completed first.
   * Priority order: critical > high > normal > low
   */
  claimNext(agentId: string): DevOSTask | undefined {
    const completedIds = new Set(
      this.getAll().filter(t => t.status === "completed").map(t => t.id)
    );

    const PRIO = { critical: 3, high: 2, normal: 1, low: 0 };

    const next = this.getAll()
      .filter(t => t.status === "queued" && t.blockedBy.every(id => completedIds.has(id)))
      .sort((a, b) => PRIO[b.priority] - PRIO[a.priority])[0];

    if (!next) return undefined;

    next.status    = "claimed";
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

  private persist(): void {
    const tmp = STORE_FILE + ".tmp";
    try {
      if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify(this.getAll(), null, 2), "utf-8");
      fs.renameSync(tmp, STORE_FILE);
    } catch (err: any) {
      console.error(`[TaskStore] Persist failed: ${err.message}`);
    }
  }
}

export const taskStore = new TaskStore();
