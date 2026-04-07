"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduler = exports.Scheduler = void 0;
exports.naturalToCron = naturalToCron;
// core/scheduler.ts — Natural-language scheduled task engine.
// Converts human schedules ("every monday at 9am") to cron expressions,
// fires tasks against the local /api/chat endpoint, and persists state.
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const morningBriefing_1 = require("./morningBriefing");
const dreamEngine_1 = require("./dreamEngine");
const TASKS_PATH = path_1.default.join(process.cwd(), 'workspace', 'scheduled-tasks.json');
// ── Natural-language → cron converter ─────────────────────────
function naturalToCron(schedule) {
    const s = schedule.toLowerCase().trim();
    // ── Time extraction helper ────────────────────────────
    const extractHour = (str) => {
        const m = str.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
        if (!m)
            return null;
        let hour = parseInt(m[1], 10);
        const ampm = m[3];
        if (ampm === 'pm' && hour !== 12)
            hour += 12;
        if (ampm === 'am' && hour === 12)
            hour = 0;
        return hour;
    };
    const extractMinute = (str) => {
        const m = str.match(/\d{1,2}:(\d{2})/);
        return m ? parseInt(m[1], 10) : 0;
    };
    // ── Every N minutes ───────────────────────────────────
    const everyMin = s.match(/every\s+(\d+)\s*min/);
    if (everyMin)
        return `*/${everyMin[1]} * * * *`;
    // ── Every hour ────────────────────────────────────────
    if (/every\s+hour/.test(s))
        return '0 * * * *';
    // ── Every 30 minutes ─────────────────────────────────
    if (/every\s+30/.test(s))
        return '*/30 * * * *';
    // ── Daily / every day ────────────────────────────────
    if (/every\s+day|daily/.test(s)) {
        const h = extractHour(s) ?? 8;
        const m = extractMinute(s);
        return `${m} ${h} * * *`;
    }
    // ── Weekdays ─────────────────────────────────────────
    const DAY_MAP = {
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
        thursday: 4, friday: 5, saturday: 6,
    };
    for (const [dayName, dayNum] of Object.entries(DAY_MAP)) {
        if (s.includes(dayName)) {
            const h = extractHour(s) ?? 9;
            const m = extractMinute(s);
            return `${m} ${h} * * ${dayNum}`;
        }
    }
    // ── Weekdays (Mon–Fri) ────────────────────────────────
    if (/weekday/.test(s)) {
        const h = extractHour(s) ?? 9;
        const m = extractMinute(s);
        return `${m} ${h} * * 1-5`;
    }
    // ── Weekly ───────────────────────────────────────────
    if (/weekly|every\s+week/.test(s)) {
        const h = extractHour(s) ?? 9;
        return `0 ${h} * * 1`; // Monday by default
    }
    // ── Monthly ──────────────────────────────────────────
    if (/monthly|every\s+month/.test(s)) {
        const h = extractHour(s) ?? 9;
        return `0 ${h} 1 * *`; // 1st of month
    }
    // ── Fallback: 9am daily ───────────────────────────────
    return '0 9 * * *';
}
// ── Cron match checker ─────────────────────────────────────────
// Parses a cron expression and tests it against the current time.
function cronMatchesNow(cronExpr) {
    const parts = cronExpr.split(' ');
    if (parts.length < 5)
        return false;
    const [minutePart, hourPart, , , dayOfWeekPart] = parts;
    const now = new Date();
    const matchField = (field, value) => {
        if (field === '*')
            return true;
        if (field.startsWith('*/')) {
            const step = parseInt(field.slice(2), 10);
            return value % step === 0;
        }
        if (field.includes('-')) {
            const [lo, hi] = field.split('-').map(Number);
            return value >= lo && value <= hi;
        }
        return parseInt(field, 10) === value;
    };
    return (matchField(minutePart, now.getMinutes()) &&
        matchField(hourPart, now.getHours()) &&
        matchField(dayOfWeekPart, now.getDay()));
}
// ── Scheduler class ────────────────────────────────────────────
class Scheduler {
    constructor() {
        this.tasks = [];
        this.intervals = new Map();
        this.load();
        this.registerDreamSchedule();
    }
    // ── Public API ─────────────────────────────────────────
    add(description, schedule, goal) {
        const task = {
            id: `task_${Date.now()}`,
            description,
            schedule,
            cronExpression: naturalToCron(schedule),
            goal,
            enabled: true,
            createdAt: Date.now(),
        };
        this.tasks.push(task);
        this.save();
        this.scheduleTask(task);
        console.log(`[Scheduler] Added: "${description}" (${task.cronExpression})`);
        return task;
    }
    remove(id) {
        const interval = this.intervals.get(id);
        if (interval) {
            clearInterval(interval);
            this.intervals.delete(id);
        }
        const before = this.tasks.length;
        this.tasks = this.tasks.filter(t => t.id !== id);
        this.save();
        return this.tasks.length < before;
    }
    toggle(id, enabled) {
        const task = this.tasks.find(t => t.id === id);
        if (!task)
            return false;
        task.enabled = enabled;
        this.save();
        return true;
    }
    list() {
        return this.tasks;
    }
    // ── Dream Engine: check every 6 hours ─────────────────
    registerDreamSchedule() {
        // Run once 30s after startup
        setTimeout(() => {
            (0, dreamEngine_1.checkAndRunDream)();
        }, 30000);
        // Then every 6 hours
        setInterval(() => {
            (0, dreamEngine_1.checkAndRunDream)();
        }, 6 * 60 * 60 * 1000);
        console.log('[Scheduler] Dream engine scheduled (every 6h, startup+30s)');
    }
    // ── Sprint 25: morning briefing registration ────────────
    registerMorningBriefing() {
        const config = (0, morningBriefing_1.loadBriefingConfig)();
        // Always remove any existing briefing task first
        const existing = this.tasks.find(t => t.id === 'morning_briefing');
        if (existing)
            this.remove('morning_briefing');
        if (!config.enabled)
            return;
        const [hourStr, minuteStr] = config.time.split(':');
        const hour = parseInt(hourStr ?? '8', 10);
        const minute = parseInt(minuteStr ?? '0', 10);
        const task = {
            id: 'morning_briefing',
            description: 'Morning briefing',
            schedule: `every day at ${config.time}`,
            cronExpression: `${minute} ${hour} * * *`,
            goal: '__morning_briefing__',
            enabled: true,
            createdAt: Date.now(),
        };
        this.tasks.push(task);
        this.save();
        this.scheduleTask(task);
        console.log(`[Scheduler] Morning briefing registered at ${config.time}`);
    }
    // ── Internal ───────────────────────────────────────────
    scheduleTask(task) {
        // Poll every minute and fire when cron expression matches current time
        const interval = setInterval(() => {
            if (!task.enabled)
                return;
            if (this.shouldRun(task)) {
                task.lastRun = Date.now();
                this.save();
                this.runTask(task).catch(e => console.error(`[Scheduler] Task "${task.description}" threw: ${e.message}`));
            }
        }, 60 * 1000);
        this.intervals.set(task.id, interval);
    }
    shouldRun(task) {
        // Must not have run in the last 55 minutes (prevents double-fire within same minute tick)
        const notRunRecently = !task.lastRun || (Date.now() - task.lastRun) > 55 * 60 * 1000;
        return notRunRecently && cronMatchesNow(task.cronExpression);
    }
    async runTask(task) {
        console.log(`[Scheduler] Running task: "${task.description}"`);
        // ── Sprint 25: morning briefing special marker ────────
        if (task.goal === '__morning_briefing__') {
            try {
                const config = (0, morningBriefing_1.loadBriefingConfig)();
                await (0, morningBriefing_1.deliverBriefing)(config);
                console.log(`[Scheduler] Morning briefing delivered`);
            }
            catch (e) {
                console.error(`[Scheduler] Morning briefing failed: ${e.message}`);
            }
            return;
        }
        try {
            const res = await fetch('http://localhost:4200/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: task.goal, history: [] }),
                signal: AbortSignal.timeout(120000), // 2-minute cap per scheduled task
            });
            if (res.ok) {
                console.log(`[Scheduler] Task complete: "${task.description}"`);
            }
            else {
                console.warn(`[Scheduler] Task HTTP ${res.status}: "${task.description}"`);
            }
        }
        catch (e) {
            console.error(`[Scheduler] Task failed: "${task.description}" — ${e.message}`);
        }
    }
    load() {
        try {
            if (!fs_1.default.existsSync(TASKS_PATH))
                return;
            const raw = fs_1.default.readFileSync(TASKS_PATH, 'utf-8');
            this.tasks = JSON.parse(raw);
            const enabled = this.tasks.filter(t => t.enabled);
            enabled.forEach(t => this.scheduleTask(t));
            if (enabled.length > 0) {
                console.log(`[Scheduler] Loaded ${this.tasks.length} task(s), ${enabled.length} active`);
            }
        }
        catch (e) {
            console.warn(`[Scheduler] Failed to load tasks: ${e.message}`);
            this.tasks = [];
        }
    }
    save() {
        try {
            fs_1.default.mkdirSync(path_1.default.dirname(TASKS_PATH), { recursive: true });
            fs_1.default.writeFileSync(TASKS_PATH, JSON.stringify(this.tasks, null, 2));
        }
        catch (e) {
            console.warn(`[Scheduler] Failed to save tasks: ${e.message}`);
        }
    }
}
exports.Scheduler = Scheduler;
// ── Singleton ──────────────────────────────────────────────────
exports.scheduler = new Scheduler();
