"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cronTrigger = exports.CronTrigger = void 0;
// core/triggers/cronTrigger.ts — Pure Node.js cron scheduler.
//   Supports standard 5-field cron expressions: minute hour day month weekday
//   Uses polling every 60 s; fires jobs whose expression matches the current time.
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const eventBus_1 = require("../eventBus");
const JOBS_FILE = path_1.default.join(process.cwd(), "config", "cron-jobs.json");
const POLL_MS = 60000; // 1 minute
// ── Cron Expression Matching ─────────────────────────────────
/**
 * Returns true if `value` matches the cron `field`.
 * Supports: * (any), single number, comma-separated list, ranges (1-5).
 */
function matchField(field, value) {
    if (field === "*")
        return true;
    for (const part of field.split(",")) {
        if (part.includes("-")) {
            const [lo, hi] = part.split("-").map(Number);
            if (value >= lo && value <= hi)
                return true;
        }
        else {
            if (parseInt(part, 10) === value)
                return true;
        }
    }
    return false;
}
function matchesCron(expression, now) {
    const parts = expression.trim().split(/\s+/);
    if (parts.length !== 5)
        return false;
    const [minF, hourF, domF, monF, dowF] = parts;
    return (matchField(minF, now.getMinutes()) &&
        matchField(hourF, now.getHours()) &&
        matchField(domF, now.getDate()) &&
        matchField(monF, now.getMonth() + 1) && // JS months are 0-based
        matchField(dowF, now.getDay()) // 0=Sunday
    );
}
// ── CronTrigger ───────────────────────────────────────────────
function makeId() {
    return `cron_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
class CronTrigger {
    constructor() {
        this.jobs = new Map();
        this.timer = null;
        this.running = false;
        /** Track the last minute we fired so we don't double-fire within the same minute. */
        this._lastFiredMinute = -1;
        this._load();
    }
    // ── Public API ─────────────────────────────────────────────
    add(job) {
        const id = makeId();
        const entry = { ...job, id };
        this.jobs.set(id, entry);
        this._persist();
        console.log(`[CronTrigger] Added job ${id}: "${job.goal}" @ ${job.schedule}`);
        return id;
    }
    remove(id) {
        if (!this.jobs.has(id))
            return;
        this.jobs.delete(id);
        this._persist();
        console.log(`[CronTrigger] Removed job ${id}`);
    }
    enable(id) {
        const job = this.jobs.get(id);
        if (!job)
            return;
        job.enabled = true;
        this._persist();
    }
    disable(id) {
        const job = this.jobs.get(id);
        if (!job)
            return;
        job.enabled = false;
        this._persist();
    }
    list() {
        return Array.from(this.jobs.values());
    }
    /** Start the poll loop. Safe to call multiple times. */
    start() {
        if (this.running)
            return;
        this.running = true;
        console.log("[CronTrigger] Started — polling every 60 s");
        this._tick();
        this.timer = setInterval(() => this._tick(), POLL_MS);
        if (this.timer.unref)
            this.timer.unref(); // don't keep process alive
    }
    /** Stop the poll loop. */
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.running = false;
        console.log("[CronTrigger] Stopped");
    }
    // ── Private ───────────────────────────────────────────────
    _tick() {
        const now = new Date();
        // Avoid firing the same minute twice if _tick is called more than once per minute
        const minuteKey = now.getFullYear() * 10000000 +
            (now.getMonth() + 1) * 100000 +
            now.getDate() * 1000 +
            now.getHours() * 60 +
            now.getMinutes();
        if (minuteKey === this._lastFiredMinute)
            return;
        this._lastFiredMinute = minuteKey;
        for (const job of this.jobs.values()) {
            if (!job.enabled)
                continue;
            if (matchesCron(job.schedule, now)) {
                console.log(`[CronTrigger] 🔔 Firing job ${job.id}: "${job.goal}"`);
                job.lastRun = now;
                this._persist();
                eventBus_1.eventBus.emit("cron_triggered", { jobId: job.id, goal: job.goal });
            }
        }
    }
    _load() {
        try {
            if (!fs_1.default.existsSync(JOBS_FILE))
                return;
            const raw = fs_1.default.readFileSync(JOBS_FILE, "utf-8");
            const data = JSON.parse(raw);
            for (const j of data) {
                // Rehydrate Date fields
                if (j.lastRun)
                    j.lastRun = new Date(j.lastRun);
                if (j.nextRun)
                    j.nextRun = new Date(j.nextRun);
                this.jobs.set(j.id, j);
            }
            console.log(`[CronTrigger] Loaded ${this.jobs.size} job(s) from disk`);
        }
        catch {
            // Start fresh if file is corrupt
        }
    }
    _persist() {
        try {
            fs_1.default.mkdirSync(path_1.default.dirname(JOBS_FILE), { recursive: true });
            fs_1.default.writeFileSync(JOBS_FILE, JSON.stringify(Array.from(this.jobs.values()), null, 2), "utf-8");
        }
        catch (err) {
            console.warn(`[CronTrigger] Could not persist jobs: ${err.message}`);
        }
    }
}
exports.CronTrigger = CronTrigger;
exports.cronTrigger = new CronTrigger();
