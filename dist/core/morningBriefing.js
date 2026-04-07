"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadBriefingConfig = loadBriefingConfig;
exports.saveBriefingConfig = saveBriefingConfig;
exports.generateBriefing = generateBriefing;
exports.deliverBriefing = deliverBriefing;
// core/morningBriefing.ts — Daily morning briefing: weather, markets, news,
// unfinished tasks, and a proactive automation suggestion.
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const BRIEFING_CONFIG_PATH = path_1.default.join(process.cwd(), 'workspace', 'morning-briefing.json');
const DEFAULT_CONFIG = {
    enabled: false, // user must opt in
    time: '08:00',
    channels: ['dashboard'],
    sections: {
        unfinishedTasks: true,
        calendar: true,
        marketData: true,
        weather: true,
        news: true,
    },
    marketSymbols: ['NIFTY', 'SENSEX'],
    city: 'Mumbai',
    proactiveSuggestion: true,
};
// ── Config I/O ────────────────────────────────────────────────
function loadBriefingConfig() {
    try {
        if (fs_1.default.existsSync(BRIEFING_CONFIG_PATH)) {
            return { ...DEFAULT_CONFIG, ...JSON.parse(fs_1.default.readFileSync(BRIEFING_CONFIG_PATH, 'utf-8')) };
        }
    }
    catch { }
    return { ...DEFAULT_CONFIG };
}
function saveBriefingConfig(config) {
    fs_1.default.mkdirSync(path_1.default.dirname(BRIEFING_CONFIG_PATH), { recursive: true });
    fs_1.default.writeFileSync(BRIEFING_CONFIG_PATH, JSON.stringify(config, null, 2));
}
// ── Briefing generator ────────────────────────────────────────
async function generateBriefing(config) {
    const parts = [];
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' });
    parts.push(`Good morning. It is ${timeStr} on ${dateStr}.`);
    parts.push('');
    // ── Section 1: Unfinished tasks from yesterday ────────────
    if (config.sections.unfinishedTasks) {
        try {
            const { auditTrail } = await Promise.resolve().then(() => __importStar(require('./auditTrail')));
            const entries = auditTrail.getToday();
            const failed = entries.filter((e) => !e.success);
            if (failed.length > 0) {
                const names = failed.map((e) => e.tool || e.action).filter(Boolean).slice(0, 3).join(', ');
                parts.push(`**Unfinished from yesterday:** ${failed.length} task${failed.length > 1 ? 's' : ''} did not complete${names ? ' — ' + names : ''}.`);
            }
            else {
                parts.push(`**Yesterday:** All tasks completed successfully.`);
            }
        }
        catch {
            parts.push(`**Tasks:** No data from yesterday.`);
        }
    }
    // ── Section 2: Market data — personalised ────────────────
    if (config.sections.marketData && config.marketSymbols.length > 0) {
        try {
            const { executeTool } = await Promise.resolve().then(() => __importStar(require('./toolRegistry')));
            const result = await executeTool('get_market_data', { symbol: config.marketSymbols[0] });
            if (result.success) {
                parts.push(`**Markets:** ${result.output.slice(0, 120)}`);
            }
        }
        catch { }
    }
    // ── Section 3: Weather — one line ────────────────────────
    if (config.sections.weather) {
        try {
            const { executeTool } = await Promise.resolve().then(() => __importStar(require('./toolRegistry')));
            const result = await executeTool('web_search', { query: `${config.city} weather today` });
            if (result.success) {
                const match = result.output.match(/(\d+).*?\xb0[CF].*?(rain|sun|cloud|clear|humid|hot|warm|cold)/i);
                parts.push(`**Weather:** ${config.city} — ${match ? match[0].slice(0, 60) : result.output.slice(0, 80)}`);
            }
        }
        catch { }
    }
    // ── Section 4: News — filtered by UserCognition interests ─
    if (config.sections.news) {
        try {
            const { executeTool } = await Promise.resolve().then(() => __importStar(require('./toolRegistry')));
            const { userCognitionProfile } = await Promise.resolve().then(() => __importStar(require('./userCognitionProfile')));
            const profile = userCognitionProfile.getProfile();
            const topic = profile?.interests?.[0] || 'technology India';
            const result = await executeTool('web_search', { query: `${topic} news today` });
            if (result.success) {
                parts.push(`**News:** ${result.output.slice(0, 150)}`);
            }
        }
        catch { }
    }
    // ── Section 5: Proactive suggestion from pattern detection ─
    if (config.proactiveSuggestion) {
        try {
            const { userCognitionProfile } = await Promise.resolve().then(() => __importStar(require('./userCognitionProfile')));
            const patterns = userCognitionProfile.detectRepetitivePatterns();
            if (patterns.length > 0) {
                parts.push(`**Suggestion:** ${patterns[0].suggestion}`);
            }
        }
        catch { }
    }
    return parts.join('\n');
}
// ── Briefing delivery ─────────────────────────────────────────
async function deliverBriefing(config) {
    const briefing = await generateBriefing(config);
    const date = new Date().toLocaleDateString('en-IN', { month: 'long', day: 'numeric' });
    // Deliver to dashboard — POST as a special briefing event
    try {
        await fetch('http://localhost:4200/api/briefing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: briefing,
                label: `Morning Briefing \u00b7 ${date}`,
                type: 'briefing',
            }),
        });
    }
    catch { }
    // Desktop notification — short punchy hook
    try {
        const { executeTool } = await Promise.resolve().then(() => __importStar(require('./toolRegistry')));
        const firstLine = briefing
            .split('\n')
            .filter(l => l.trim() && !l.startsWith('Good morning'))
            .slice(0, 2)
            .join(' \u00b7 ')
            .slice(0, 100);
        await executeTool('notify', {
            title: `Good morning — Aiden briefing`,
            message: firstLine,
        });
    }
    catch { }
}
