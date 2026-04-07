"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.livePulse = void 0;
// coordination/livePulse.ts — Real-time agent pulse / activity log.
// Extends EventEmitter so subscribers (e.g. /api/chat) can stream
// live execution progress directly to the UI.
//
// Every public method fires both a named event AND a universal
// 'any' event carrying a typed PulseEvent — one subscriber
// handles everything.
const events_1 = require("events");
// ── Implementation ────────────────────────────────────────────
const HISTORY_MAX = 100;
class LivePulse extends events_1.EventEmitter {
    constructor() {
        super();
        this.history = [];
        // CRITICAL: register a no-op 'error' listener so Node doesn't throw
        // unhandled 'error' events when livePulse.emit('error', ...) is called.
        this.on('error', () => { });
    }
    // ── Private event dispatcher ──────────────────────────────
    emit_event(event) {
        try {
            this.history.push(event);
            if (this.history.length > HISTORY_MAX)
                this.history.shift();
            // Named event (backwards compat) — skip 'error' type to avoid throwing
            if (event.type !== 'error') {
                this.emit(event.type, event.agent, event.message);
            }
            // Universal subscriber — always fires
            this.emit('any', event);
        }
        catch {
            // Never throw from event dispatch
        }
    }
    // ── Public methods — all wrapped in try-catch so they NEVER throw ──
    act(agent, message, missionId) {
        try {
            console.log(`[${agent}] ${message}`);
            this.emit_event({ type: 'act', agent, message, timestamp: Date.now(), missionId });
        }
        catch {
            // Silent fail — never throw from pulse methods
        }
    }
    done(agent, message, missionId) {
        try {
            console.log(`[${agent}] ✓ ${message}`);
            this.emit_event({ type: 'done', agent, message, timestamp: Date.now(), missionId });
        }
        catch {
            // Silent fail — never throw from pulse methods
        }
    }
    error(agent, message, missionId) {
        try {
            console.error(`[${agent}] ✗ ${message}`);
            this.emit_event({ type: 'error', agent, message, timestamp: Date.now(), missionId });
        }
        catch {
            // Never throw from error handler — log to console only
            console.error(`[LivePulse] emit_event failed for error: ${message}`);
        }
    }
    warn(agent, message, missionId) {
        try {
            console.warn(`[${agent}] ⚠ ${message}`);
            this.emit_event({ type: 'warn', agent, message, timestamp: Date.now(), missionId });
        }
        catch {
            // Silent fail — never throw from pulse methods
        }
    }
    info(agent, message, missionId) {
        try {
            console.log(`[${agent}] ℹ ${message}`);
            this.emit_event({ type: 'info', agent, message, timestamp: Date.now(), missionId });
        }
        catch {
            // Silent fail — never throw from pulse methods
        }
    }
    thinking(agent, message, missionId) {
        try {
            console.log(`[${agent}] 💭 ${message}`);
            this.emit_event({ type: 'thinking', agent, message, timestamp: Date.now(), missionId });
        }
        catch {
            // Silent fail — never throw from pulse methods
        }
    }
    tool(agent, toolName, command, output) {
        try {
            const message = output
                ? `${toolName}: ${command} → ${output.slice(0, 120)}`
                : `${toolName}: ${command}`;
            console.log(`[${agent}] 🔧 ${message}`);
            this.emit_event({
                type: 'tool',
                agent,
                message,
                timestamp: Date.now(),
                tool: toolName,
                command,
                output,
            });
        }
        catch {
            // Silent fail — never throw from pulse methods
        }
    }
    // ── History helpers ───────────────────────────────────────
    getHistory() {
        return [...this.history];
    }
    clear() {
        this.history = [];
    }
}
exports.livePulse = new LivePulse();
