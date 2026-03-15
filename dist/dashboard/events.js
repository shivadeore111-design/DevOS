"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventBus = void 0;
// ============================================================
// dashboard/events.ts — DevOS Event Bus
// Singleton EventEmitter that bridges the execution engine
// to the dashboard WebSocket server.
// ============================================================
const events_1 = require("events");
// ── Event Bus ─────────────────────────────────────────────────
class EventBus {
    constructor() {
        this.emitter = new events_1.EventEmitter();
        this.history = [];
        this.MAX_HISTORY = 200;
    }
    emit(event) {
        // Keep a rolling history for new WebSocket clients to replay
        this.history.push(event);
        if (this.history.length > this.MAX_HISTORY) {
            this.history = this.history.slice(-this.MAX_HISTORY);
        }
        this.emitter.emit("event", event);
    }
    subscribe(handler) {
        this.emitter.on("event", handler);
    }
    unsubscribe(handler) {
        this.emitter.off("event", handler);
    }
    /** Return the last N events (for WebSocket replay on connect) */
    getHistory(limit = 20) {
        return this.history.slice(-limit);
    }
}
// ── Singleton ─────────────────────────────────────────────────
exports.eventBus = new EventBus();
