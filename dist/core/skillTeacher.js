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
exports.skillTeacher = exports.SkillTeacher = void 0;
// core/skillTeacher.ts — Self-learning skill generation.
// After every successful plan execution, records the tool sequence,
// generates a SKILL.md using the LLM, and promotes to "approved"
// after PROMOTE_THRESHOLD successes.
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// ── Paths ──────────────────────────────────────────────────────
const LEARNED_DIR = path_1.default.join(process.cwd(), 'workspace', 'skills', 'learned');
const APPROVED_DIR = path_1.default.join(process.cwd(), 'workspace', 'skills', 'approved');
const PROMOTE_THRESHOLD = 3; // successes needed to promote to approved/
// ── Skill name extractor ───────────────────────────────────────
// "research the top AI agents of 2025" → "research_ai_agents"
function extractSkillName(task, tools) {
    // Use tool sequence to name the skill when pattern is recognisable
    if (tools.includes('deep_research') && tools.includes('file_write'))
        return 'research_and_save';
    if (tools.includes('web_search') && tools.includes('file_write'))
        return 'search_and_save';
    if (tools.includes('get_stocks'))
        return 'stock_research';
    if (tools.includes('run_python'))
        return 'python_execution';
    if (tools.includes('run_node'))
        return 'node_execution';
    if (tools.includes('shell_exec') && tools.includes('file_write'))
        return 'shell_and_save';
    // Extract key nouns from task — first 3 meaningful words
    const stopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'to', 'in', 'on',
        'for', 'of', 'with', 'my', 'your', 'about', 'from',
        'save', 'get', 'find', 'make', 'show', 'tell',
    ]);
    const words = task
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w))
        .slice(0, 3);
    return words.join('_') || 'general_task';
}
// ── SKILL.md generator ─────────────────────────────────────────
async function generateSkillContent(skillName, task, tools, duration, llmCaller, apiKey, model, provider) {
    const prompt = `Generate a SKILL.md file for DevOS based on this successful task execution.

Task: "${task}"
Tools used in order: ${tools.join(' → ')}
Duration: ${Math.round(duration / 1000)}s

Write a SKILL.md with this EXACT format:
---
name: ${skillName}
description: [one line description of what this skill does]
version: 1.0.0
confidence: low
tags: [comma separated tags relevant to this task]
---

[2-5 bullet points of key instructions for doing this type of task well]
[Include specific tips learned from this execution]
[Keep it concise — under 200 words total]

Output ONLY the SKILL.md content. No explanation.`;
    try {
        const content = await llmCaller(prompt, apiKey, model, provider);
        // Validate it has valid frontmatter
        if (content.includes('---') && content.includes('name:')) {
            return content.trim();
        }
        // Fallback — minimal valid SKILL.md
        return buildFallbackSkill(skillName, task, tools, duration);
    }
    catch {
        return buildFallbackSkill(skillName, task, tools, duration);
    }
}
function buildFallbackSkill(skillName, task, tools, duration) {
    return `---
name: ${skillName}
description: ${task.slice(0, 80)}
version: 1.0.0
confidence: low
tags: ${tools.join(', ')}
---

When performing this type of task:
1. Use tools in this order: ${tools.join(' → ')}
2. Task completed in ~${Math.round(duration / 1000)}s
3. Verify each step output before proceeding to the next
`;
}
// ── SkillTeacher ───────────────────────────────────────────────
class SkillTeacher {
    constructor() {
        try {
            fs_1.default.mkdirSync(LEARNED_DIR, { recursive: true });
        }
        catch { }
        try {
            fs_1.default.mkdirSync(APPROVED_DIR, { recursive: true });
        }
        catch { }
    }
    static getInstance() {
        if (!SkillTeacher.instance) {
            SkillTeacher.instance = new SkillTeacher();
        }
        return SkillTeacher.instance;
    }
    // ── Check if a matching skill already exists ──────────────
    hasMatchingSkill(task, tools) {
        const skillName = extractSkillName(task, tools);
        const dirsToCheck = [
            path_1.default.join(process.cwd(), 'skills'),
            LEARNED_DIR,
            APPROVED_DIR,
        ];
        for (const dir of dirsToCheck) {
            try {
                if (fs_1.default.existsSync(dir) && fs_1.default.existsSync(path_1.default.join(dir, skillName)))
                    return true;
            }
            catch { }
        }
        return false;
    }
    // ── Record a successful task ───────────────────────────────
    async recordSuccess(task, tools, duration, llmCaller, apiKey, model, provider) {
        if (tools.length === 0)
            return;
        const skillName = extractSkillName(task, tools);
        const metaPath = path_1.default.join(LEARNED_DIR, skillName, 'meta.json');
        const skillPath = path_1.default.join(LEARNED_DIR, skillName, 'SKILL.md');
        // ── If skill exists — update usage count ─────────────────
        if (fs_1.default.existsSync(metaPath)) {
            try {
                const meta = JSON.parse(fs_1.default.readFileSync(metaPath, 'utf-8'));
                meta.successCount++;
                meta.lastUsed = Date.now();
                meta.avgDuration = Math.round((meta.avgDuration + duration) / 2);
                meta.confidence = Math.min(meta.successCount / PROMOTE_THRESHOLD, 1);
                if (meta.successCount >= PROMOTE_THRESHOLD && !meta.promoted) {
                    this.promoteSkill(skillName);
                    meta.promoted = true;
                    console.log(`[SkillTeacher] Promoted "${skillName}" → approved/ (${meta.successCount} successes)`);
                }
                fs_1.default.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
                console.log(`[SkillTeacher] Updated "${skillName}" — ${meta.successCount} successes, confidence: ${(meta.confidence * 100).toFixed(0)}%`);
            }
            catch (e) {
                console.warn(`[SkillTeacher] Meta update failed for "${skillName}": ${e.message}`);
            }
            return;
        }
        // ── New skill — generate SKILL.md and write meta ──────────
        console.log(`[SkillTeacher] Learning new skill: "${skillName}" from task: "${task.slice(0, 60)}"`);
        try {
            const content = await generateSkillContent(skillName, task, tools, duration, llmCaller, apiKey, model, provider);
            fs_1.default.mkdirSync(path_1.default.join(LEARNED_DIR, skillName), { recursive: true });
            fs_1.default.writeFileSync(skillPath, content, 'utf-8');
            const meta = {
                name: skillName,
                taskPattern: task.slice(0, 100),
                toolSequence: tools,
                successCount: 1,
                failCount: 0,
                confidence: 1 / PROMOTE_THRESHOLD,
                promoted: false,
                createdAt: Date.now(),
                lastUsed: Date.now(),
                avgDuration: duration,
            };
            fs_1.default.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
            console.log(`[SkillTeacher] Saved new skill: "${skillName}"`);
            // Invalidate skillLoader cache so new skill is picked up immediately
            try {
                const { skillLoader } = await Promise.resolve().then(() => __importStar(require('./skillLoader')));
                skillLoader.refresh();
            }
            catch { }
        }
        catch (e) {
            console.warn(`[SkillTeacher] Failed to generate skill "${skillName}": ${e.message}`);
        }
    }
    // ── Record a failed task ───────────────────────────────────
    recordFailure(task, tools) {
        if (tools.length === 0)
            return;
        const skillName = extractSkillName(task, tools);
        const metaPath = path_1.default.join(LEARNED_DIR, skillName, 'meta.json');
        if (!fs_1.default.existsSync(metaPath))
            return;
        try {
            const meta = JSON.parse(fs_1.default.readFileSync(metaPath, 'utf-8'));
            meta.failCount++;
            fs_1.default.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
        }
        catch { }
    }
    // ── Promote skill from learned/ to approved/ ───────────────
    promoteSkill(skillName) {
        const src = path_1.default.join(LEARNED_DIR, skillName);
        const dest = path_1.default.join(APPROVED_DIR, skillName);
        try {
            fs_1.default.mkdirSync(dest, { recursive: true });
            for (const file of fs_1.default.readdirSync(src)) {
                fs_1.default.copyFileSync(path_1.default.join(src, file), path_1.default.join(dest, file));
            }
            // Invalidate cache after promotion
            Promise.resolve().then(() => __importStar(require('./skillLoader'))).then(m => m.skillLoader.refresh()).catch(() => { });
        }
        catch (e) {
            console.warn(`[SkillTeacher] Promotion failed for "${skillName}": ${e.message}`);
        }
    }
    // ── List helpers ───────────────────────────────────────────
    readDir(dir) {
        if (!fs_1.default.existsSync(dir))
            return [];
        return fs_1.default.readdirSync(dir)
            .filter(d => {
            try {
                return fs_1.default.statSync(path_1.default.join(dir, d)).isDirectory();
            }
            catch {
                return false;
            }
        })
            .map(name => {
            try {
                const metaPath = path_1.default.join(dir, name, 'meta.json');
                if (fs_1.default.existsSync(metaPath)) {
                    return JSON.parse(fs_1.default.readFileSync(metaPath, 'utf-8'));
                }
                return { name, successCount: 0, failCount: 0, confidence: 0 };
            }
            catch {
                return { name, successCount: 0, failCount: 0, confidence: 0 };
            }
        });
    }
    listLearned() {
        return this.readDir(LEARNED_DIR);
    }
    listApproved() {
        return this.readDir(APPROVED_DIR);
    }
    getStats() {
        const learned = this.listLearned();
        const approved = this.listApproved();
        const totalSuccesses = learned.reduce((s, m) => s + (m.successCount || 0), 0);
        return { learned: learned.length, approved: approved.length, totalSuccesses };
    }
}
exports.SkillTeacher = SkillTeacher;
exports.skillTeacher = SkillTeacher.getInstance();
