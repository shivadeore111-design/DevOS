"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.skillKnowledgeBase = exports.SkillKnowledgeBase = void 0;
// ============================================================
// memory/skillKnowledge.ts — Skill Knowledge Base
// Stores known problems, solutions, and best practices per skill.
// Persists to workspace/skill-knowledge.json
// ============================================================
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const STORE_DIR = path_1.default.join(process.cwd(), "workspace");
const STORE_FILE = path_1.default.join(STORE_DIR, "skill-knowledge.json");
// ── SkillKnowledgeBase ────────────────────────────────────────
class SkillKnowledgeBase {
    constructor() {
        this.data = new Map();
        this._load();
    }
    // ── Reads ──────────────────────────────────────────────────
    get(skillName) {
        return this.data.get(skillName);
    }
    list() {
        return Array.from(this.data.values());
    }
    // ── Writes ─────────────────────────────────────────────────
    upsert(knowledge) {
        knowledge.lastUpdated = new Date().toISOString();
        this.data.set(knowledge.skillName, knowledge);
        this._persist();
    }
    addFailurePattern(skillName, pattern, solution) {
        const existing = this._getOrCreate(skillName);
        const found = existing.failurePatterns.find(fp => fp.pattern === pattern);
        if (found) {
            found.frequency += 1;
            found.solution = solution;
        }
        else {
            existing.failurePatterns.push({ pattern, frequency: 1, solution });
        }
        existing.lastUpdated = new Date().toISOString();
        this.data.set(skillName, existing);
        this._persist();
    }
    addBestPractice(skillName, practice) {
        const existing = this._getOrCreate(skillName);
        if (!existing.bestPractices.includes(practice)) {
            existing.bestPractices.push(practice);
        }
        existing.lastUpdated = new Date().toISOString();
        this.data.set(skillName, existing);
        this._persist();
    }
    // ── Private ────────────────────────────────────────────────
    _getOrCreate(skillName) {
        if (this.data.has(skillName))
            return this.data.get(skillName);
        const blank = {
            skillName,
            knownProblems: [],
            knownSolutions: [],
            bestPractices: [],
            failurePatterns: [],
            lastUpdated: new Date().toISOString(),
        };
        this.data.set(skillName, blank);
        return blank;
    }
    _load() {
        if (!fs_1.default.existsSync(STORE_DIR)) {
            fs_1.default.mkdirSync(STORE_DIR, { recursive: true });
        }
        if (!fs_1.default.existsSync(STORE_FILE)) {
            this._persist();
            return;
        }
        try {
            const raw = JSON.parse(fs_1.default.readFileSync(STORE_FILE, "utf-8"));
            this.data.clear();
            for (const sk of raw)
                this.data.set(sk.skillName, sk);
        }
        catch (err) {
            console.error(`[SkillKnowledgeBase] Load failed: ${err.message}`);
        }
    }
    _persist() {
        const tmp = STORE_FILE + ".tmp";
        try {
            if (!fs_1.default.existsSync(STORE_DIR))
                fs_1.default.mkdirSync(STORE_DIR, { recursive: true });
            fs_1.default.writeFileSync(tmp, JSON.stringify(this.list(), null, 2), "utf-8");
            fs_1.default.renameSync(tmp, STORE_FILE);
        }
        catch (err) {
            console.error(`[SkillKnowledgeBase] Persist failed: ${err.message}`);
        }
    }
}
exports.SkillKnowledgeBase = SkillKnowledgeBase;
// ── Singleton ─────────────────────────────────────────────────
exports.skillKnowledgeBase = new SkillKnowledgeBase();
