"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolHooks = exports.ToolHooks = void 0;
const eventBus_1 = require("../core/eventBus");
const executionMemory_1 = require("../memory/executionMemory");
class ToolHooks {
    constructor() {
        this.beforeHooks = new Map();
        this.afterHooks = new Map();
        this._registerDefaults();
    }
    // ── Registration ──────────────────────────────────────────
    /** Register a handler to run BEFORE a tool executes. */
    before(toolName, handler) {
        const list = this.beforeHooks.get(toolName) ?? [];
        list.push(handler);
        this.beforeHooks.set(toolName, list);
    }
    /** Register a handler to run AFTER a tool executes. */
    after(toolName, handler) {
        const list = this.afterHooks.get(toolName) ?? [];
        list.push(handler);
        this.afterHooks.set(toolName, list);
    }
    // ── Application ───────────────────────────────────────────
    /**
     * Run all `before` hooks for the given tool name in registration order.
     * Each hook receives the (potentially modified) input from the previous hook.
     */
    applyBefore(toolName, input) {
        const hooks = this.beforeHooks.get(toolName) ?? [];
        const wildcard = this.beforeHooks.get("*") ?? [];
        let current = input;
        for (const hook of [...hooks, ...wildcard]) {
            try {
                const next = hook(current);
                if (next !== undefined)
                    current = next;
            }
            catch (err) {
                console.warn(`[ToolHooks] before:${toolName} hook error: ${err.message}`);
            }
        }
        return current;
    }
    /**
     * Run all `after` hooks for the given tool name.
     * Each hook receives and returns the ToolResult, allowing transformation.
     */
    applyAfter(toolName, result) {
        const hooks = this.afterHooks.get(toolName) ?? [];
        const wildcard = this.afterHooks.get("*") ?? [];
        let current = result;
        for (const hook of [...hooks, ...wildcard]) {
            try {
                const next = hook(current);
                if (next !== undefined)
                    current = next;
            }
            catch (err) {
                console.warn(`[ToolHooks] after:${toolName} hook error: ${err.message}`);
            }
        }
        return current;
    }
    // ── Default hooks ────────────────────────────────────────
    _registerDefaults() {
        // Before runCommand: emit to event bus so listeners can observe
        this.before("runCommand", (input) => {
            eventBus_1.eventBus.emit("tool_command_executing", {
                tool: "runCommand",
                command: input?.command,
                cwd: input?.cwd,
            });
            return input;
        });
        // After any tool (*): record failures into execution memory
        this.after("*", (result) => {
            if (!result.success && result.error) {
                try {
                    executionMemory_1.executionMemory.store({
                        pattern: `tool_failure`,
                        goalType: "tool",
                        domain: "tool_runtime",
                        stack: [],
                        outcome: "failure",
                        reason: result.error,
                        actions: [],
                        durationMs: 0,
                        retryCount: 0,
                    });
                }
                catch {
                    // never let memory write break the tool result
                }
            }
            return result;
        });
    }
}
exports.ToolHooks = ToolHooks;
exports.toolHooks = new ToolHooks();
