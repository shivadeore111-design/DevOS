"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolRuntime = exports.ToolRuntime = void 0;
class ToolRuntime {
    constructor() {
        this.registry = new Map();
        // Register built-in tools lazily to avoid circular-dependency issues
        // (the tool files import Tool/ToolResult types from this module).
        this._registerBuiltins();
    }
    /** Register a tool. Overwrites any existing registration with the same name. */
    register(tool) {
        this.registry.set(tool.name, tool);
    }
    /** Returns the named tool or null if not registered. */
    get(name) {
        return this.registry.get(name) ?? null;
    }
    /** Execute a tool by name, applying hooks and logging. */
    async execute(name, input) {
        const tool = this.registry.get(name);
        if (!tool) {
            const err = { success: false, error: `Tool not found: ${name}` };
            console.error(`[ToolRuntime] ❌ Unknown tool: ${name}`);
            return err;
        }
        console.log(`[ToolRuntime] Executing: ${name}`);
        try {
            const result = await tool.execute(input);
            if (result.success) {
                console.log(`[ToolRuntime] ✅ ${name}`);
            }
            else {
                console.error(`[ToolRuntime] ❌ ${name}: ${result.error ?? "unknown error"}`);
            }
            return result;
        }
        catch (err) {
            const result = { success: false, error: err.message };
            console.error(`[ToolRuntime] ❌ ${name}: ${err.message}`);
            return result;
        }
    }
    /** Returns all registered tools. */
    list() {
        return Array.from(this.registry.values());
    }
    // ── Private ───────────────────────────────────────────────
    _registerBuiltins() {
        try {
            const { readFile } = require("./tools/readFile");
            const { writeFile } = require("./tools/writeFile");
            const { editFile } = require("./tools/editFile");
            const { runCommand } = require("./tools/runCommand");
            this.register(readFile);
            this.register(writeFile);
            this.register(editFile);
            this.register(runCommand);
        }
        catch (err) {
            console.warn(`[ToolRuntime] Could not register built-in tools: ${err.message}`);
        }
    }
}
exports.ToolRuntime = ToolRuntime;
exports.toolRuntime = new ToolRuntime();
