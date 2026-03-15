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
exports.missionState = void 0;
// coordination/missionState.ts — Mission lifecycle persistence
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DATA_FILE = path.join(process.cwd(), 'workspace', 'missions.json');
class MissionState {
    constructor() {
        this.missions = new Map();
        this.load();
    }
    load() {
        try {
            if (fs.existsSync(DATA_FILE)) {
                const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
                for (const m of raw)
                    this.missions.set(m.id, m);
                console.log(`[MissionState] Loaded ${this.missions.size} mission(s)`);
            }
        }
        catch { /* start fresh */ }
    }
    save() {
        try {
            fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
            fs.writeFileSync(DATA_FILE, JSON.stringify([...this.missions.values()], null, 2));
        }
        catch (err) {
            console.warn(`[MissionState] Save failed: ${err?.message}`);
        }
    }
    saveMission(mission) {
        this.missions.set(mission.id, mission);
        this.save();
    }
    loadMission(id) {
        return this.missions.get(id) ?? null;
    }
    updateMission(id, updates) {
        const existing = this.missions.get(id);
        if (!existing)
            return;
        this.missions.set(id, { ...existing, ...updates });
        this.save();
    }
    listMissions(status) {
        const all = [...this.missions.values()];
        if (!status)
            return all.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
        return all
            .filter(m => m.status === status)
            .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    }
}
exports.missionState = new MissionState();
