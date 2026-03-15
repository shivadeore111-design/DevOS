"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processSupervisor = exports.ProcessSupervisor = void 0;
// devos/runtime/processSupervisor.ts — Track and control spawned processes
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DEVOS_ROOT = process.cwd();
const PERSIST_FILE = path_1.default.join(DEVOS_ROOT, "workspace", "processes.json");
class ProcessSupervisor {
    constructor() {
        this.processes = [];
        this.load();
    }
    /** Register a newly spawned process */
    register(pid, command, goalId) {
        const entry = {
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
    getByGoal(goalId) {
        return this.processes.filter(p => p.goalId === goalId);
    }
    /** Kill all processes for a given goal */
    async killGoal(goalId) {
        const procs = this.getByGoal(goalId);
        for (const p of procs) {
            await this.killPid(p);
        }
        this.persist();
    }
    /** Kill every tracked process */
    async killAll() {
        for (const p of this.processes) {
            await this.killPid(p);
        }
        this.persist();
    }
    /** Returns true if the process is still alive (signal 0 probe) */
    isAlive(pid) {
        try {
            process.kill(pid, 0);
            return true;
        }
        catch {
            return false;
        }
    }
    /** Return all tracked processes with refreshed live status */
    status() {
        for (const p of this.processes) {
            if (p.status === "running") {
                p.status = this.isAlive(p.pid) ? "running" : "crashed";
            }
        }
        return [...this.processes];
    }
    // ── Internal helpers ──────────────────────────────────────
    async killPid(p) {
        if (!this.isAlive(p.pid)) {
            p.status = "crashed";
            return;
        }
        try {
            process.kill(p.pid, "SIGTERM");
            await new Promise(r => setTimeout(r, 500));
            if (this.isAlive(p.pid))
                process.kill(p.pid, "SIGKILL");
            p.status = "stopped";
            console.log(`[ProcessSupervisor] Killed PID ${p.pid} (goal: ${p.goalId})`);
        }
        catch (err) {
            console.warn(`[ProcessSupervisor] Could not kill PID ${p.pid}: ${err.message}`);
            p.status = "stopped";
        }
    }
    persist() {
        try {
            fs_1.default.mkdirSync(path_1.default.dirname(PERSIST_FILE), { recursive: true });
            fs_1.default.writeFileSync(PERSIST_FILE, JSON.stringify(this.processes, null, 2), "utf-8");
        }
        catch (err) {
            console.warn(`[ProcessSupervisor] Persist failed: ${err.message}`);
        }
    }
    load() {
        try {
            if (!fs_1.default.existsSync(PERSIST_FILE))
                return;
            const raw = fs_1.default.readFileSync(PERSIST_FILE, "utf-8");
            const list = JSON.parse(raw);
            // Rehydrate Date objects
            this.processes = list.map(p => ({
                ...p,
                startTime: new Date(p.startTime),
                // Treat anything "running" from a previous session as crashed
                status: p.status === "running" ? "crashed" : p.status,
            }));
            console.log(`[ProcessSupervisor] Loaded ${this.processes.length} process record(s).`);
        }
        catch {
            this.processes = [];
        }
    }
}
exports.ProcessSupervisor = ProcessSupervisor;
exports.processSupervisor = new ProcessSupervisor();
