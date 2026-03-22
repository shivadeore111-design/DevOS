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
Object.defineProperty(exports, "__esModule", { value: true });
exports.lifeTimeline = exports.LifeTimeline = void 0;
// personal/lifeTimeline.ts — Persistent log of everything DevOS does
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const eventBus_1 = require("../core/eventBus");
const FILE = path.join(process.cwd(), 'workspace/life-timeline.json');
class LifeTimeline {
    constructor() {
        // Wire eventBus listeners to auto-capture key system events
        eventBus_1.eventBus.on('goal:completed', (data) => {
            this.addEntry({
                timestamp: new Date().toISOString(),
                agent: 'GoalEngine',
                action: 'Goal completed: ' + (data.title || data.goalId),
                result: data.result || '',
                goalId: data.goalId,
                type: 'build',
            });
        });
        eventBus_1.eventBus.on('mission:complete', (data) => {
            this.addEntry({
                timestamp: new Date().toISOString(),
                agent: 'MissionControl',
                action: 'Mission complete: ' + data.goal,
                result: data.summary || '',
                goalId: data.missionId,
                type: 'build',
            });
        });
        eventBus_1.eventBus.on('pilot_completed', (data) => {
            this.addEntry({
                timestamp: new Date().toISOString(),
                agent: data.pilotId || 'Pilot',
                action: 'Pilot run completed',
                result: data.output || '',
                type: 'monitor',
            });
        });
    }
    addEntry(entry) {
        const entries = this.load();
        entries.push({ ...entry, id: crypto.randomUUID() });
        const dir = path.dirname(FILE);
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(FILE, JSON.stringify(entries.slice(-500), null, 2));
    }
    getTimeline(goalId) {
        const entries = this.load();
        return goalId ? entries.filter(e => e.goalId === goalId) : entries;
    }
    load() {
        if (!fs.existsSync(FILE))
            return [];
        try {
            return JSON.parse(fs.readFileSync(FILE, 'utf-8'));
        }
        catch {
            return [];
        }
    }
}
exports.LifeTimeline = LifeTimeline;
exports.lifeTimeline = new LifeTimeline();
