"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.skillIndex = exports.SkillIndex = void 0;
// skills/skillIndex.ts — Scans the skills/ directory, tracks tier + success
//                         metrics, and persists to skills/skill-index.json.
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const SKILLS_ROOT = path_1.default.join(process.cwd(), "skills");
const INDEX_FILE = path_1.default.join(SKILLS_ROOT, "skill-index.json");
// Order tiers so "core" floats to the top
const TIER_PRIORITY = { core: 0, domain: 1, generated: 2 };
// Directories / file names that are definitely not skills
const EXCLUDED_NAMES = new Set([
    "skill-index.json", "skillIndex.ts", "skillIndex.js",
    "skillMemory.ts", "skillMemory.js",
    "loader.ts", "loader.js",
    "registry.ts", "registry.js",
    "index.ts", "index.js",
    "node_modules",
]);
class SkillIndex {
    constructor() {
        this.index = new Map();
        this._loadFromDisk();
        this._scan();
        this._persist();
    }
    /** Returns all entries sorted by tier then successRate desc. */
    getAll() {
        return this._sorted(Array.from(this.index.values()));
    }
    /**
     * Returns the best entries for the planner — up to `limit` (default 20),
     * sorted by tier priority then descending successRate.
     */
    getForPlanner(limit = 20) {
        return this._sorted(Array.from(this.index.values())).slice(0, limit);
    }
    /**
     * Register a new skill or update an existing one.
     * Persists immediately.
     */
    register(name, skillPath, tier) {
        const existing = this.index.get(name);
        const entry = {
            name,
            path: skillPath,
            tier: this._normaliseTier(tier),
            description: existing?.description ?? "",
            usageCount: existing?.usageCount ?? 0,
            successRate: existing?.successRate ?? 1.0,
        };
        this.index.set(name, entry);
        this._persist();
    }
    /** Update usage stats for a skill after it runs. */
    recordRun(name, success) {
        const entry = this.index.get(name);
        if (!entry)
            return;
        const newUsage = entry.usageCount + 1;
        const prevTotal = Math.max(entry.usageCount, 1);
        const prevSuccess = Math.round(entry.successRate * prevTotal);
        const newSuccess = prevSuccess + (success ? 1 : 0);
        entry.usageCount = newUsage;
        entry.successRate = newSuccess / newUsage;
        this._persist();
    }
    // ── Private ───────────────────────────────────────────────
    _scan() {
        if (!fs_1.default.existsSync(SKILLS_ROOT))
            return;
        const entries = fs_1.default.readdirSync(SKILLS_ROOT);
        for (const entry of entries) {
            if (EXCLUDED_NAMES.has(entry))
                continue;
            const full = path_1.default.join(SKILLS_ROOT, entry);
            let stat;
            try {
                stat = fs_1.default.statSync(full);
            }
            catch {
                continue;
            }
            if (stat.isDirectory()) {
                // Each subdirectory is a skill category; scan its children
                this._scanSubdir(full, entry);
            }
            else if ((entry.endsWith(".ts") || entry.endsWith(".js")) && !entry.endsWith(".d.ts")) {
                const name = entry.replace(/\.(ts|js)$/, "");
                if (EXCLUDED_NAMES.has(name))
                    continue;
                this._upsert(name, full, this._inferTier(full));
            }
        }
    }
    _scanSubdir(dir, category) {
        let children;
        try {
            children = fs_1.default.readdirSync(dir);
        }
        catch {
            return;
        }
        const tier = this._inferTier(dir);
        for (const child of children) {
            if (EXCLUDED_NAMES.has(child))
                continue;
            const full = path_1.default.join(dir, child);
            try {
                const stat = fs_1.default.statSync(full);
                if (stat.isDirectory()) {
                    // nested sub-skill (e.g. skills/coding/react/)
                    const name = `${category}/${child}`;
                    this._upsert(name, full, tier);
                }
                else if ((child.endsWith(".ts") || child.endsWith(".js")) && !child.endsWith(".d.ts")) {
                    const name = `${category}/${child.replace(/\.(ts|js)$/, "")}`;
                    this._upsert(name, full, tier);
                }
            }
            catch {
                // skip
            }
        }
    }
    _upsert(name, skillPath, tier) {
        if (this.index.has(name)) {
            // Keep existing metrics, just refresh path + tier
            const e = this.index.get(name);
            e.path = skillPath;
            e.tier = tier;
        }
        else {
            this.index.set(name, {
                name,
                path: skillPath,
                tier,
                description: "",
                usageCount: 0,
                successRate: 1.0,
            });
        }
    }
    _inferTier(skillPath) {
        const lower = skillPath.toLowerCase();
        if (lower.includes(`${path_1.default.sep}generated`))
            return "generated";
        if (lower.includes(`${path_1.default.sep}coding`) ||
            lower.includes(`${path_1.default.sep}planning`) ||
            lower.includes(`${path_1.default.sep}browser`) ||
            lower.includes(`${path_1.default.sep}docs`) ||
            lower.includes(`${path_1.default.sep}debug`) ||
            lower.includes(`${path_1.default.sep}devops`) ||
            lower.includes(`${path_1.default.sep}system`) ||
            lower.includes(`${path_1.default.sep}utils`) ||
            lower.includes(`${path_1.default.sep}performance`) ||
            lower.includes(`${path_1.default.sep}security`) ||
            lower.includes(`${path_1.default.sep}architecture`))
            return "domain";
        return "core";
    }
    _normaliseTier(tier) {
        if (tier === "core" || tier === "domain" || tier === "generated")
            return tier;
        return "domain";
    }
    _sorted(entries) {
        return entries.sort((a, b) => {
            const tierDiff = (TIER_PRIORITY[a.tier] ?? 9) - (TIER_PRIORITY[b.tier] ?? 9);
            if (tierDiff !== 0)
                return tierDiff;
            return b.successRate - a.successRate;
        });
    }
    _loadFromDisk() {
        try {
            if (!fs_1.default.existsSync(INDEX_FILE))
                return;
            const raw = fs_1.default.readFileSync(INDEX_FILE, "utf-8");
            const data = JSON.parse(raw);
            for (const e of data) {
                this.index.set(e.name, e);
            }
        }
        catch {
            // corrupt index — start fresh, scan will rebuild
        }
    }
    _persist() {
        try {
            fs_1.default.mkdirSync(path_1.default.dirname(INDEX_FILE), { recursive: true });
            fs_1.default.writeFileSync(INDEX_FILE, JSON.stringify(Array.from(this.index.values()), null, 2), "utf-8");
        }
        catch (err) {
            console.warn(`[SkillIndex] Could not persist index: ${err.message}`);
        }
    }
}
exports.SkillIndex = SkillIndex;
exports.skillIndex = new SkillIndex();
