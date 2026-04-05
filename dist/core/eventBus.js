"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventBus = void 0;
// core/eventBus.ts — Lightweight in-process event bus.
// Used by costTracker and aidenIdentity to push updates to
// any subscriber (e.g. api/server.ts → WebSocket clients).
const events_1 = require("events");
class DevOSEventBus extends events_1.EventEmitter {
}
exports.eventBus = new DevOSEventBus();
// Increase listener limit — many subsystems may subscribe
exports.eventBus.setMaxListeners(50);
