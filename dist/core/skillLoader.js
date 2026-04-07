"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.skillLoader = exports.SkillLoader = void 0;
// core/skillLoader.ts — Loads SKILL.md files and injects relevant
// skill context into the planner and responder prompts.
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Keywords that map skills to task categories
const KEYWORD_MAP = {
    web: ['search', 'browse', 'fetch', 'scrape', 'website', 'url', 'internet', 'online', 'news', 'weather'],
    file: ['create', 'write', 'read', 'save', 'file', 'document', 'report', 'desktop', 'folder'],
    code: ['code', 'script', 'python', 'node', 'javascript', 'typescript', 'program', 'build', 'run', 'execute'],
    research: ['research', 'analyze', 'compare', 'study', 'investigate', 'find', 'gather', 'information'],
    deploy: ['deploy', 'vercel', 'github', 'push', 'publish', 'release', 'launch'],
    system: ['system', 'computer', 'machine', 'disk', 'cpu', 'memory', 'process'],
};
// ── SkillLoader ────────────────────────────────────────────────
class SkillLoader {
    constructor() {
        this.cache = null;
        // Check built-in skills, workspace skills, and self-learned/promoted skills
        this.skillsDirs = [
            path_1.default.join(process.cwd(), 'skills'),
            path_1.default.join(process.cwd(), 'workspace', 'skills'),
            path_1.default.join(process.cwd(), 'workspace', 'skills', 'learned'),
            path_1.default.join(process.cwd(), 'workspace', 'skills', 'approved'),
        ].filter(d => {
            try {
                return fs_1.default.existsSync(d);
            }
            catch {
                return false;
            }
        });
    }
    loadAll() {
        if (this.cache)
            return this.cache;
        const skills = [];
        for (const dir of this.skillsDirs) {
            try {
                const entries = fs_1.default.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (!entry.isDirectory())
                        continue;
                    const skillPath = path_1.default.join(dir, entry.name, 'SKILL.md');
                    if (!fs_1.default.existsSync(skillPath))
                        continue;
                    try {
                        const raw = fs_1.default.readFileSync(skillPath, 'utf-8');
                        const parsed = this.parse(raw, skillPath);
                        if (parsed)
                            skills.push(parsed);
                    }
                    catch { }
                }
            }
            catch { }
        }
        this.cache = skills;
        if (skills.length > 0) {
            console.log(`[SkillLoader] Loaded ${skills.length} skills: ${skills.map(s => s.name).join(', ')}`);
        }
        return skills;
    }
    parse(raw, filePath) {
        try {
            const match = raw.match(/^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/);
            if (!match) {
                // No frontmatter — use directory name as skill name
                const name = path_1.default.basename(path_1.default.dirname(filePath));
                return { name, description: name, version: '1.0.0', tags: [name], content: raw.trim(), filePath };
            }
            const frontmatter = match[1];
            const content = match[2].trim();
            const get = (key) => {
                const m = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
                return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : '';
            };
            const tagsRaw = get('tags');
            const tags = tagsRaw
                ? tagsRaw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
                : [];
            const name = get('name') || path_1.default.basename(path_1.default.dirname(filePath));
            return {
                name,
                description: get('description'),
                version: get('version') || '1.0.0',
                tags,
                content,
                filePath,
            };
        }
        catch {
            return null;
        }
    }
    findRelevant(message, maxSkills = 3) {
        const skills = this.loadAll();
        if (skills.length === 0)
            return [];
        const lower = message.toLowerCase();
        const words = lower.split(/\s+/);
        // Detect categories from message text
        const matchedCategories = new Set();
        for (const [category, keywords] of Object.entries(KEYWORD_MAP)) {
            if (keywords.some(kw => lower.includes(kw))) {
                matchedCategories.add(category);
            }
        }
        // Score each skill by relevance
        const scored = skills.map(skill => {
            let score = 0;
            // Exact name match in message
            if (lower.includes(skill.name.toLowerCase()))
                score += 10;
            // Description word overlap
            const descWords = skill.description.toLowerCase().split(/\s+/);
            words.forEach(w => { if (w.length > 3 && descWords.includes(w))
                score += 3; });
            // Direct tag match
            skill.tags.forEach(tag => {
                if (lower.includes(tag))
                    score += 5;
                if (matchedCategories.has(tag))
                    score += 4;
            });
            // Category match
            matchedCategories.forEach(cat => {
                if (skill.tags.includes(cat))
                    score += 6;
            });
            return { skill, score };
        });
        return scored
            .filter(s => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, maxSkills)
            .map(s => s.skill);
    }
    formatForPrompt(skills) {
        if (skills.length === 0)
            return '';
        const formatted = skills.map(s => `[SKILL: ${s.name}]\nDescription: ${s.description}\n${s.content.slice(0, 500)}`).join('\n\n---\n\n');
        return `\n\nRELEVANT SKILLS FOR THIS TASK:\n${formatted}\n\nUse these skill instructions to guide your planning.\n`;
    }
    // Invalidate cache — call after new skills are added at runtime
    refresh() {
        this.cache = null;
    }
}
exports.SkillLoader = SkillLoader;
exports.skillLoader = new SkillLoader();
