"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userCognitionProfile = exports.UserCognitionProfile = void 0;
// core/userCognitionProfile.ts — Silent behavioural adaptation.
//
// Appends every (user, AI) exchange as a JSONL line to
// workspace/cognition/interaction-log.jsonl.
// After 20+ conversations, derives a CognitionProfile and
// injects a short hint into the system prompt.
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// ── Paths ──────────────────────────────────────────────────────
const COGNITION_DIR = path_1.default.join(process.cwd(), 'workspace', 'cognition');
const PROFILE_PATH = path_1.default.join(COGNITION_DIR, 'user-profile.json');
const LOG_PATH = path_1.default.join(COGNITION_DIR, 'interaction-log.jsonl');
const CALIBRATION_MIN = 20;
// ── UserCognitionProfile ───────────────────────────────────────
class UserCognitionProfile {
    constructor() {
        this.profile = {
            verbosity: 'balanced',
            technicalLevel: 'medium',
            decisionStyle: 'fast',
            conversationCount: 0,
            lastUpdated: Date.now(),
        };
        try {
            fs_1.default.mkdirSync(COGNITION_DIR, { recursive: true });
        }
        catch { }
        if (fs_1.default.existsSync(PROFILE_PATH)) {
            try {
                this.profile = JSON.parse(fs_1.default.readFileSync(PROFILE_PATH, 'utf-8'));
            }
            catch { }
        }
    }
    // ── Observe an exchange ───────────────────────────────────────
    observe(userMessage, aiReply) {
        const interaction = {
            userLength: userMessage.length,
            aiLength: aiReply.length,
            containsCode: /```|`[^`]+`/.test(userMessage + aiReply),
            followUps: 0,
            timestamp: Date.now(),
        };
        try {
            fs_1.default.appendFileSync(LOG_PATH, JSON.stringify(interaction) + '\n', 'utf-8');
        }
        catch { }
        this.profile.conversationCount++;
        if (this.profile.conversationCount >= CALIBRATION_MIN) {
            this.updateProfile();
        }
        else {
            this.saveProfile();
        }
    }
    // ── System prompt hint ────────────────────────────────────────
    getSystemPromptAddition() {
        if (this.profile.conversationCount < CALIBRATION_MIN)
            return '';
        const hints = [];
        if (this.profile.verbosity === 'short') {
            hints.push('Keep responses concise.');
        }
        else if (this.profile.verbosity === 'detailed') {
            hints.push('This user prefers detailed explanations.');
        }
        if (this.profile.technicalLevel === 'high') {
            hints.push('Use technical language and code examples freely.');
        }
        else if (this.profile.technicalLevel === 'low') {
            hints.push('Avoid jargon, explain simply.');
        }
        if (this.profile.decisionStyle === 'fast') {
            hints.push('Lead with the answer, then explain.');
        }
        return hints.length > 0 ? `\n\nUser preferences: ${hints.join(' ')}` : '';
    }
    // ── Profile accessor ──────────────────────────────────────────
    getProfile() {
        return { ...this.profile };
    }
    // ── Observe with tool list (Sprint 12) ───────────────────────
    // Extended version of observe() that also records which tools ran.
    observeWithTools(userMessage, aiReply, toolsUsed) {
        const interaction = {
            userLength: userMessage.length,
            aiLength: aiReply.length,
            containsCode: /```|`[^`]+`/.test(userMessage + aiReply),
            followUps: 0,
            timestamp: Date.now(),
            toolsUsed,
        };
        try {
            fs_1.default.appendFileSync(LOG_PATH, JSON.stringify(interaction) + '\n', 'utf-8');
        }
        catch { }
        this.profile.conversationCount++;
        if (this.profile.conversationCount >= CALIBRATION_MIN) {
            this.updateProfile();
        }
        else {
            this.saveProfile();
        }
    }
    // ── Pattern detection (Sprint 12) ────────────────────────────
    // Scans the last 100 log entries for repetitive behaviours and
    // returns structured suggestions the dashboard can present.
    detectRepetitivePatterns() {
        try {
            if (!fs_1.default.existsSync(LOG_PATH))
                return [];
            const lines = fs_1.default.readFileSync(LOG_PATH, 'utf-8').trim().split('\n').filter(Boolean);
            const interactions = lines
                .slice(-100)
                .map(l => { try {
                return JSON.parse(l);
            }
            catch {
                return null;
            } })
                .filter((i) => i !== null);
            const results = [];
            // ── Monday-morning routine ────────────────────────────
            const mondayMorning = interactions.filter(i => {
                const d = new Date(i.timestamp);
                return d.getDay() === 1 && d.getHours() >= 8 && d.getHours() <= 10;
            });
            if (mondayMorning.length >= 3) {
                results.push({
                    pattern: 'monday_morning_routine',
                    frequency: mondayMorning.length,
                    suggestion: 'I noticed you often work on Monday mornings — want me to prepare a weekly briefing automatically?',
                    automationGoal: 'Every Monday at 9am, check my calendar, summarize last week from git log, and send a desktop notification with the summary',
                });
            }
            // ── Frequent web_search ───────────────────────────────
            const toolFrequency = {};
            for (const interaction of interactions) {
                if (interaction.toolsUsed) {
                    for (const tool of interaction.toolsUsed) {
                        toolFrequency[tool] = (toolFrequency[tool] || 0) + 1;
                    }
                }
            }
            if ((toolFrequency['web_search'] ?? 0) > 20) {
                results.push({
                    pattern: 'frequent_web_search',
                    frequency: toolFrequency['web_search'],
                    suggestion: 'You search the web frequently. Want me to run a daily news briefing on your key topics?',
                    automationGoal: 'Every morning at 8am, search for news on my most researched topics and send a desktop notification summary',
                });
            }
            // ── Daily late-evening sessions (after 8pm) ───────────
            const lateNight = interactions.filter(i => new Date(i.timestamp).getHours() >= 20);
            if (lateNight.length >= 5) {
                results.push({
                    pattern: 'late_evening_sessions',
                    frequency: lateNight.length,
                    suggestion: "You often work late evenings. Want me to auto-summarise what you accomplished each day at 10pm?",
                    automationGoal: 'Every day at 10pm, summarise today\'s activity log and write it to workspace/daily-summary.md',
                });
            }
            // ── Frequent file_write + run_python combo ─────────────
            const scriptingCount = (toolFrequency['run_python'] ?? 0) + (toolFrequency['run_node'] ?? 0);
            if (scriptingCount > 15) {
                results.push({
                    pattern: 'frequent_scripting',
                    frequency: scriptingCount,
                    suggestion: 'You run code frequently. Want me to auto-run your test suite after every file save?',
                    automationGoal: 'Every hour during working hours, run the project test suite and notify me of any failures',
                });
            }
            return results;
        }
        catch {
            return [];
        }
    }
    // ── Derive profile from recent interactions ───────────────────
    updateProfile() {
        if (!fs_1.default.existsSync(LOG_PATH))
            return;
        let lines;
        try {
            lines = fs_1.default.readFileSync(LOG_PATH, 'utf-8').trim().split('\n').filter(Boolean);
        }
        catch {
            return;
        }
        const last20 = lines
            .slice(-20)
            .map(l => {
            try {
                return JSON.parse(l);
            }
            catch {
                return null;
            }
        })
            .filter((i) => i !== null);
        if (last20.length === 0)
            return;
        const avgUserLen = last20.reduce((s, i) => s + i.userLength, 0) / last20.length;
        const codeUsage = last20.filter(i => i.containsCode).length / last20.length;
        this.profile.verbosity = avgUserLen < 80 ? 'short'
            : avgUserLen < 200 ? 'balanced'
                : 'detailed';
        this.profile.technicalLevel = codeUsage > 0.5 ? 'high'
            : codeUsage > 0.2 ? 'medium'
                : 'low';
        // decisionStyle: fast if user messages are short (< 100 chars avg)
        this.profile.decisionStyle = avgUserLen < 100 ? 'fast' : 'analytical';
        this.profile.lastUpdated = Date.now();
        this.saveProfile();
    }
    saveProfile() {
        try {
            fs_1.default.writeFileSync(PROFILE_PATH, JSON.stringify(this.profile, null, 2), 'utf-8');
        }
        catch { }
    }
}
exports.UserCognitionProfile = UserCognitionProfile;
// ── Singleton ─────────────────────────────────────────────────
exports.userCognitionProfile = new UserCognitionProfile();
