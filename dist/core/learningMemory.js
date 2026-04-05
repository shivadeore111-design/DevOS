"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.learningMemory = exports.LearningMemory = void 0;
// core/learningMemory.ts — Self-learning from task outcomes.
// Records every plan execution (success or failure) and surfaces
// similar past experiences to guide the planner on future tasks.
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const semanticMemory_1 = require("./semanticMemory");
const LEARNING_PATH = path_1.default.join(process.cwd(), 'workspace', 'learning.json');
// ── LearningMemory ─────────────────────────────────────────────
class LearningMemory {
    constructor() {
        this.data = [];
        this.load();
    }
    // ── Persistence ───────────────────────────────────────────────
    load() {
        try {
            if (fs_1.default.existsSync(LEARNING_PATH)) {
                this.data = JSON.parse(fs_1.default.readFileSync(LEARNING_PATH, 'utf-8'));
            }
        }
        catch { }
    }
    save() {
        try {
            fs_1.default.mkdirSync(path_1.default.dirname(LEARNING_PATH), { recursive: true });
            fs_1.default.writeFileSync(LEARNING_PATH, JSON.stringify(this.data, null, 2));
        }
        catch { }
    }
    // ── Key normalization ─────────────────────────────────────────
    normalize(task) {
        return task
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .slice(0, 50)
            .trim();
    }
    // ── Record experience ─────────────────────────────────────────
    record(exp) {
        const experience = {
            ...exp,
            id: `exp_${Date.now()}`,
            taskEmbeddingKey: this.normalize(exp.task),
            timestamp: Date.now(),
        };
        this.data.push(experience);
        // Keep last 200 experiences
        if (this.data.length > 200) {
            this.data = this.data.slice(-200);
        }
        // Index successful patterns into semantic memory for fuzzy matching
        if (exp.success) {
            semanticMemory_1.semanticMemory.add(`Successful task: ${exp.task}. Steps: ${exp.steps.join(' → ')}`, 'result', ['success', 'pattern']);
        }
        this.save();
    }
    // ── Similarity search ─────────────────────────────────────────
    // Uses word-level Jaccard overlap — fast, no vectors required.
    findSimilar(task, topK = 3) {
        const normalized = this.normalize(task);
        const queryWords = new Set(normalized.split(/\s+/).filter(w => w.length > 3));
        if (queryWords.size === 0)
            return [];
        const scored = this.data.map(exp => {
            const expWords = new Set(exp.taskEmbeddingKey.split(/\s+/));
            let overlap = 0;
            queryWords.forEach(w => { if (expWords.has(w))
                overlap++; });
            const score = overlap / Math.max(queryWords.size, expWords.size, 1);
            return { exp, score };
        });
        return scored
            .filter(s => s.score > 0.2)
            .sort((a, b) => b.score - a.score)
            .slice(0, topK)
            .map(s => s.exp);
    }
    // ── Context string for planner ────────────────────────────────
    buildLearningContext(task) {
        const similar = this.findSimilar(task);
        if (similar.length === 0)
            return '';
        const lines = ['PAST EXPERIENCE (use to choose better steps and avoid known failures):'];
        similar.forEach(exp => {
            const status = exp.success ? '✓' : '✗';
            lines.push(`${status} "${exp.task.slice(0, 60)}"`);
            lines.push(`  Steps used: ${exp.steps.join(' → ')}`);
            if (!exp.success && exp.errorMessage) {
                lines.push(`  Failed because: ${exp.errorMessage.slice(0, 100)}`);
            }
            if (exp.filesCreated.length > 0) {
                lines.push(`  Files created: ${exp.filesCreated.join(', ')}`);
            }
        });
        return lines.join('\n');
    }
    // ── Stats ─────────────────────────────────────────────────────
    getStats() {
        if (this.data.length === 0)
            return { total: 0, successRate: 0, avgDuration: 0 };
        const successful = this.data.filter(e => e.success).length;
        const avgDuration = this.data.reduce((s, e) => s + e.duration, 0) / this.data.length;
        return {
            total: this.data.length,
            successRate: Math.round((successful / this.data.length) * 100),
            avgDuration: Math.round(avgDuration),
        };
    }
}
exports.LearningMemory = LearningMemory;
exports.learningMemory = new LearningMemory();
