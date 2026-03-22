"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.registry = exports.skillRegistry = exports.SkillRegistry = void 0;
// ============================================================
// skills/registry.ts — Central Skill Interface & Registry
// All skills must implement the Skill interface and register here.
// ============================================================
const environmentBuilder_1 = require("./system/environmentBuilder");
const terminalOperator_1 = require("./system/terminalOperator");
// ── Registry ─────────────────────────────────────────────────
class SkillRegistry {
    constructor(loadDefaults = false) {
        this.skills = new Map();
        if (loadDefaults)
            this.registerDefaultSkills();
    }
    register(skill) {
        this.skills.set(skill.name, skill);
        console.log(`[SkillRegistry] Registered: ${skill.name}`);
    }
    get(name) {
        return this.skills.get(name);
    }
    getAll() {
        return Array.from(this.skills.values());
    }
    list() {
        return Array.from(this.skills.keys());
    }
    has(name) {
        return this.skills.has(name);
    }
    findByCategory(category) {
        return this.getAll().filter(s => s.category === category);
    }
    registerDefaultSkills() {
        const terminalOperator = new terminalOperator_1.TerminalOperator();
        const environmentBuilder = new environmentBuilder_1.EnvironmentBuilder(terminalOperator);
        this.register({
            name: "terminalOperator",
            description: "Safely executes shell commands with timeout support",
            category: "system",
            execute: async (input) => {
                if (typeof input === "string") {
                    return terminalOperator.execute(input);
                }
                return terminalOperator.execute(input.command, {
                    timeout: input.timeout,
                    cwd: input.cwd
                });
            }
        });
        this.register({
            name: "environmentBuilder",
            description: "Detects and prepares development environments",
            category: "system",
            execute: async (input) => {
                if (input.mode === "detect") {
                    return environmentBuilder.detect(input.dir);
                }
                return environmentBuilder.prepare(input.dir);
            }
        });
    }
}
exports.SkillRegistry = SkillRegistry;
// ── Singletons ────────────────────────────────────────────────
/** Main singleton used by all v3 skills */
exports.skillRegistry = new SkillRegistry();
/** Alias for code using the older `registry` export name */
exports.registry = exports.skillRegistry;
