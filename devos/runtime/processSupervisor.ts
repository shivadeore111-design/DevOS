// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// devos/runtime/processSupervisor.ts — Track and control spawned processes

import fs   from "fs";
import path from "path";

const DEVOS_ROOT   = process.cwd();
const PERSIST_FILE = path.join(DEVOS_ROOT, "workspace", "processes.json");

export interface ManagedProcess {
  pid:       number;
  command:   string;
  goalId:    string;
  startTime: Date;
  status:    "running" | "stopped" | "crashed";
}

export class ProcessSupervisor {
  private processes: ManagedProcess[] = [];

  constructor() {
    this.load();
  }

  /** Register a newly spawned process */
  register(pid: number, command: string, goalId: string): void {
    const entry: ManagedProcess = {
      pid,
      command,
      goalId,
      startTime: new Date(),
      status: "running",
    };
    this.processes.push(entry);
    this.persist();
    console.log(`[ProcessSupervisor] Registered PID ${pid} for goal ${goalId}: ${command}`);
  }

  /** Get all processes associated with a goal */
  getByGoal(goalId: string): ManagedProcess[] {
    return this.processes.filter(p => p.goalId === goalId);
  }

  /** Kill all processes for a given goal */
  async killGoal(goalId: string): Promise<void> {
    const procs = this.getByGoal(goalId);
    for (const p of procs) {
      await this.killPid(p);
    }
    this.persist();
  }

  /** Kill every tracked process */
  async killAll(): Promise<void> {
    for (const p of this.processes) {
      await this.killPid(p);
    }
    this.persist();
  }

  /** Returns true if the process is still alive (signal 0 probe) */
  isAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /** Return all tracked processes with refreshed live status */
  status(): ManagedProcess[] {
    for (const p of this.processes) {
      if (p.status === "running") {
        p.status = this.isAlive(p.pid) ? "running" : "crashed";
      }
    }
    return [...this.processes];
  }

  // ── Internal helpers ──────────────────────────────────────

  private async killPid(p: ManagedProcess): Promise<void> {
    if (!this.isAlive(p.pid)) {
      p.status = "crashed";
      return;
    }
    try {
      process.kill(p.pid, "SIGTERM");
      await new Promise(r => setTimeout(r, 500));
      if (this.isAlive(p.pid)) process.kill(p.pid, "SIGKILL");
      p.status = "stopped";
      console.log(`[ProcessSupervisor] Killed PID ${p.pid} (goal: ${p.goalId})`);
    } catch (err: any) {
      console.warn(`[ProcessSupervisor] Could not kill PID ${p.pid}: ${err.message}`);
      p.status = "stopped";
    }
  }

  private persist(): void {
    try {
      fs.mkdirSync(path.dirname(PERSIST_FILE), { recursive: true });
      fs.writeFileSync(PERSIST_FILE, JSON.stringify(this.processes, null, 2), "utf-8");
    } catch (err: any) {
      console.warn(`[ProcessSupervisor] Persist failed: ${err.message}`);
    }
  }

  private load(): void {
    try {
      if (!fs.existsSync(PERSIST_FILE)) return;
      const raw = fs.readFileSync(PERSIST_FILE, "utf-8");
      const list = JSON.parse(raw) as ManagedProcess[];
      // Rehydrate Date objects
      this.processes = list.map(p => ({
        ...p,
        startTime: new Date(p.startTime),
        // Treat anything "running" from a previous session as crashed
        status: p.status === "running" ? "crashed" : p.status,
      }));
      console.log(`[ProcessSupervisor] Loaded ${this.processes.length} process record(s).`);
    } catch {
      this.processes = [];
    }
  }
}

export const processSupervisor = new ProcessSupervisor();
