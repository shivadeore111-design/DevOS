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
exports.morningBriefing = exports.MorningBriefing = void 0;
// personal/morningBriefing.ts — LLM-generated morning briefing
const http = __importStar(require("http"));
const userProfile_1 = require("../personality/userProfile");
const lifeTimeline_1 = require("./lifeTimeline");
const goalStore_1 = require("../goals/goalStore");
const devosPersonality_1 = require("../personality/devosPersonality");
class MorningBriefing {
    async generate() {
        const profile = userProfile_1.userProfile.loadProfile();
        const timeline = lifeTimeline_1.lifeTimeline.getTimeline().slice(-10);
        const activeGoals = goalStore_1.goalStore.listGoals('active').length;
        const summary = {
            activeGoals,
            recentActivity: timeline.map(e => e.action).slice(0, 5),
            name: profile?.name || 'there',
        };
        const { system, user } = (0, devosPersonality_1.wrapWithPersona)(`Write a morning briefing for ${summary.name}. Active goals: ${summary.activeGoals}. Recent activity: ${summary.recentActivity.join(', ') || 'none'}. Keep it to 3-4 sentences, conversational, end with one suggestion.`);
        return new Promise((resolve) => {
            const body = JSON.stringify({ model: 'mistral-nemo:12b', prompt: user, system, stream: false });
            const req = http.request({ hostname: 'localhost', port: 11434, path: '/api/generate', method: 'POST' }, (res) => {
                let data = '';
                res.on('data', (c) => data += c);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data).response || 'Good morning. DevOS is ready.');
                    }
                    catch {
                        resolve('Good morning. DevOS is ready.');
                    }
                });
            });
            req.on('error', () => resolve('Good morning. DevOS is ready — Ollama offline.'));
            req.write(body);
            req.end();
        });
    }
}
exports.MorningBriefing = MorningBriefing;
exports.morningBriefing = new MorningBriefing();
