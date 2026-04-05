"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeIdentity = computeIdentity;
exports.refreshIdentity = refreshIdentity;
exports.loadIdentity = loadIdentity;
exports.getIdentity = getIdentity;
// core/aidenIdentity.ts — Aiden's persistent identity and level system.
// Computed from AuditTrail (XP) + SkillTeacher (skills learned) + sessions (streak).
// Persisted to workspace/identity.json. Emits identity_update via eventBus.
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const skillTeacher_1 = require("./skillTeacher");
const eventBus_1 = require("./eventBus");
// ── Constants ─────────────────────────────────────────────────
const IDENTITY_PATH = path_1.default.join(process.cwd(), 'workspace', 'identity.json');
const AUDIT_PATH = path_1.default.join(process.cwd(), 'workspace', 'audit', 'audit.jsonl');
const SESSIONS_DIR = path_1.default.join(process.cwd(), 'workspace', 'sessions');
const LEVEL_THRESHOLDS = [0, 10, 50, 200, 500]; // XP needed for levels 1–5
const TITLES = ['Apprentice', 'Assistant', 'Specialist', 'Expert', 'Architect'];
// ── Level helpers ─────────────────────────────────────────────
function computeLevel(xp) {
    if (xp < 10)
        return 1;
    if (xp < 50)
        return 2;
    if (xp < 200)
        return 3;
    if (xp < 500)
        return 4;
    return 5;
}
function computeProgress(xp, level) {
    if (level >= 5)
        return { xpToNext: 0, progress: 1 };
    const floor = LEVEL_THRESHOLDS[level - 1];
    const ceil = LEVEL_THRESHOLDS[level];
    const span = ceil - floor;
    const done = xp - floor;
    return {
        xpToNext: Math.max(0, ceil - xp),
        progress: Math.min(1, Math.max(0, done / span)),
    };
}
// ── XP: count successful tasks from audit trail ───────────────
function computeXP() {
    try {
        if (!fs_1.default.existsSync(AUDIT_PATH))
            return 0;
        return fs_1.default.readFileSync(AUDIT_PATH, 'utf-8')
            .trim().split('\n').filter(Boolean)
            .map(l => { try {
            return JSON.parse(l);
        }
        catch {
            return null;
        } })
            .filter((e) => e !== null && e.success === true)
            .length;
    }
    catch {
        return 0;
    }
}
// ── Top strength: most frequent tool category ─────────────────
function computeTopStrength() {
    try {
        if (!fs_1.default.existsSync(AUDIT_PATH))
            return 'Research';
        const entries = fs_1.default.readFileSync(AUDIT_PATH, 'utf-8')
            .trim().split('\n').filter(Boolean)
            .map(l => { try {
            return JSON.parse(l);
        }
        catch {
            return null;
        } })
            .filter(Boolean);
        const counts = {
            Research: 0,
            Code: 0,
            Automation: 0,
            Analysis: 0,
        };
        for (const e of entries) {
            const tool = (e.tool || '');
            if (/web_search|deep_research|fetch/.test(tool))
                counts.Research++;
            else if (/file_write|run_python|run_node|shell/.test(tool))
                counts.Code++;
            else if (/mouse|keyboard|browser|vision/.test(tool))
                counts.Automation++;
            else if (/system_info|get_stocks|get_market/.test(tool))
                counts.Analysis++;
        }
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])[0][0];
    }
    catch {
        return 'Research';
    }
}
// ── Streak: consecutive days with session files ───────────────
function computeStreakDays() {
    try {
        if (!fs_1.default.existsSync(SESSIONS_DIR))
            return 0;
        const sessionDates = new Set();
        for (const f of fs_1.default.readdirSync(SESSIONS_DIR)) {
            if (!f.endsWith('.md'))
                continue;
            try {
                const mtime = fs_1.default.statSync(path_1.default.join(SESSIONS_DIR, f)).mtime;
                sessionDates.add(mtime.toISOString().slice(0, 10));
            }
            catch { }
        }
        if (sessionDates.size === 0)
            return 0;
        // Also count today's audit entries
        const auditDates = new Set();
        if (fs_1.default.existsSync(AUDIT_PATH)) {
            for (const line of fs_1.default.readFileSync(AUDIT_PATH, 'utf-8').trim().split('\n').filter(Boolean)) {
                try {
                    const e = JSON.parse(line);
                    if (e.ts)
                        auditDates.add(new Date(e.ts).toISOString().slice(0, 10));
                }
                catch { }
            }
        }
        const allDates = new Set([...sessionDates, ...auditDates]);
        const sorted = Array.from(allDates).sort().reverse();
        let streak = 0;
        let cursor = new Date();
        cursor.setHours(0, 0, 0, 0);
        for (const d of sorted) {
            const dateStr = cursor.toISOString().slice(0, 10);
            if (d === dateStr) {
                streak++;
                cursor.setDate(cursor.getDate() - 1);
            }
            else {
                break;
            }
        }
        return streak;
    }
    catch {
        return 0;
    }
}
// ── Main compute ──────────────────────────────────────────────
function computeIdentity() {
    const xp = computeXP();
    const level = computeLevel(xp);
    const title = TITLES[level - 1];
    const { xpToNext, progress } = computeProgress(xp, level);
    const stats = skillTeacher_1.skillTeacher.getStats();
    const skillsLearned = stats.learned + stats.approved;
    const identity = {
        level,
        title,
        xp,
        skillsLearned,
        streakDays: computeStreakDays(),
        topStrength: computeTopStrength(),
        xpToNextLevel: xpToNext,
        xpProgress: progress,
        lastUpdated: new Date().toISOString(),
    };
    return identity;
}
// ── Persist & emit ─────────────────────────────────────────────
function refreshIdentity() {
    const identity = computeIdentity();
    try {
        fs_1.default.mkdirSync(path_1.default.dirname(IDENTITY_PATH), { recursive: true });
        fs_1.default.writeFileSync(IDENTITY_PATH, JSON.stringify(identity, null, 2));
    }
    catch (e) {
        console.error('[AidenIdentity] Write failed:', e.message);
    }
    try {
        eventBus_1.eventBus.emit('identity_update', identity);
    }
    catch { }
    return identity;
}
// ── Load persisted (fast, no compute) ─────────────────────────
function loadIdentity() {
    try {
        if (!fs_1.default.existsSync(IDENTITY_PATH))
            return null;
        return JSON.parse(fs_1.default.readFileSync(IDENTITY_PATH, 'utf-8'));
    }
    catch {
        return null;
    }
}
// ── getIdentity: load cached or compute fresh ─────────────────
function getIdentity() {
    return loadIdentity() ?? refreshIdentity();
}
// ── Singleton initialisation on import ────────────────────────
try {
    fs_1.default.mkdirSync(path_1.default.dirname(IDENTITY_PATH), { recursive: true });
}
catch { }
