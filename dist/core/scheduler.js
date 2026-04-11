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
const goalTracker_1 = require("./goalTracker");
const patternDetector_1 = require("./patternDetector");
const TASKS_PATH = path_1.default.join(process.cwd(), 'workspace', 'scheduled-tasks.json');
const HEARTBEAT_PATH = path_1.default.join(process.cwd(), 'workspace', 'HEARTBEAT.md');
// ── Feature 8: HEARTBEAT.md config loader ─────────────────────
function loadHeartbeatConfig() {
    try {
        if (!fs_1.default.existsSync(HEARTBEAT_PATH))
            return;
        const content = fs_1.default.readFileSync(HEARTBEAT_PATH, 'utf-8');
        const sections = content.split(/^## /m).slice(1);
        for (const section of sections) {
            const title = section.split('\n')[0];
            const scheduleMatch = title.match(/\((.+)\)/);
            if (!scheduleMatch)
                continue;
            console.log(`[Heartbeat] Loaded: ${title.split('(')[0].trim()}`);
        }
    }
    catch (e) {
        console.warn(`[Heartbeat] Could not load HEARTBEAT.md: ${e.message}`);
    }
}
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
        this.registerHeartbeatSchedule();
        loadHeartbeatConfig();
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
    // ── Feature 16: HEARTBEAT_OK suppression pattern ──────────────
    // Runs every 30 min during active hours (8 AM–11 PM).
    // Uses local Ollama (zero API cost). Silent unless alert found.
    registerHeartbeatSchedule() {
        async function runHeartbeat() {
            const hour = new Date().getHours();
            const ACTIVE_START = 8;
            const ACTIVE_END = 23;
            if (hour < ACTIVE_START || hour >= ACTIVE_END)
                return;
            if (!fs_1.default.existsSync(HEARTBEAT_PATH))
                return;
            const checklist = fs_1.default.readFileSync(HEARTBEAT_PATH, 'utf-8').trim();
            if (!checklist)
                return;
            // Build heartbeat prompt: checklist + active goals + patterns
            let heartbeatPrompt = checklist;
            const goalsSummary = (0, goalTracker_1.getActiveGoalsSummary)();
            if (goalsSummary)
                heartbeatPrompt += '\n\n' + goalsSummary;
            try {
                const patterns = await (0, patternDetector_1.detectPatterns)();
                const patternSummary = (0, patternDetector_1.getPatternSummary)(patterns);
                if (patternSummary)
                    heartbeatPrompt += '\n\n' + patternSummary;
            }
            catch { /* pattern detection is non-critical */ }
            console.log('[Heartbeat] Running checks...');
            try {
                const resp = await fetch('http://localhost:11434/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: 'llama3.2:latest',
                        stream: false,
                        messages: [
                            {
                                role: 'system',
                                content: "You are Aiden running a background heartbeat. Check the items in the list. If NOTHING needs the user's attention, reply ONLY: HEARTBEAT_OK\nIf something IS urgent or interesting, describe it in 1-2 sentences. Do NOT include HEARTBEAT_OK if you have alerts.",
                            },
                            { role: 'user', content: heartbeatPrompt },
                        ],
                    }),
                    signal: AbortSignal.timeout(30000),
                });
                if (!resp.ok) {
                    console.log('[Heartbeat] Ollama unavailable — skipping');
                    return;
                }
                const data = await resp.json();
                const response = (data?.message?.content || '');
                const cleaned = response.replace(/HEARTBEAT_OK/gi, '').trim();
                if (!cleaned || cleaned.length < 10) {
                    console.log('[Heartbeat] All clear');
                    return;
                }
                console.log('[Heartbeat] Alert:', cleaned);
                // Deliver alert via API server (non-blocking)
                fetch('http://localhost:4200/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: `notify user with desktop alert: ${cleaned}` }),
                    signal: AbortSignal.timeout(10000),
                }).catch(() => { });
            }
            catch (e) {
                console.log('[Heartbeat] Check skipped:', e.message);
            }
        }
        // Run 60s after startup, then every 30 minutes
        setTimeout(() => runHeartbeat(), 60000);
        setInterval(() => runHeartbeat(), 30 * 60 * 1000);
        console.log('[Heartbeat] Scheduled (every 30m, active hours 8 AM–11 PM)');
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
    scheduleTask(task) {
        // Poll every minute and fire when cron expression matches current time
        const interval = setInterval(() => {
            if (!task.enabled)
                return;
            if (this.shouldRun(task)) {
                task.lastRun = Date.now();
                this.save();
                const taskWithTimeout = Promise.race([
                    this.runTask(task),
                    new Promise((_, reject) => setTimeout(() => reject(new Error(`Task timeout after 5 minutes: ${task.description}`)), Scheduler.TASK_TIMEOUT_MS)),
                ]);
                taskWithTimeout.catch(e => console.log(`[Security] Task killed: "${task.description}": ${e.message}`));
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
// ── Internal ───────────────────────────────────────────
Scheduler.TASK_TIMEOUT_MS = 5 * 60 * 1000; // 5-minute dead-man switch
// ── Singleton ──────────────────────────────────────────────────
exports.scheduler = new Scheduler();
