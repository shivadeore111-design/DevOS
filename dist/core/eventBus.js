"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventBus = exports.EventBus = void 0;
// core/eventBus.ts — Lightweight typed event bus for runtime wiring
const events_1 = require("events");
class EventBus {
    constructor() {
        this.emitter = new events_1.EventEmitter();
        this._history = [];
        this.MAX_HISTORY = 100;
    }
    /** Emit a named event with optional payload */
    emit(event, data) {
        const entry = { event, data, timestamp: new Date() };
        this._history.push(entry);
        if (this._history.length > this.MAX_HISTORY) {
            this._history = this._history.slice(-this.MAX_HISTORY);
        }
        this.emitter.emit(event, data);
    }
    /** Subscribe to an event */
    on(event, handler) {
        this.emitter.on(event, handler);
    }
    /** Unsubscribe from an event */
    off(event, handler) {
        this.emitter.off(event, handler);
    }
    /** Return the last N events from history (default: all up to 100) */
    history(limit = 100) {
        return this._history.slice(-limit);
    }
}
exports.EventBus = EventBus;
exports.eventBus = new EventBus();
