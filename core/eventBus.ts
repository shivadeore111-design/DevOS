// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/eventBus.ts — Lightweight in-process event bus.
// Used by costTracker and aidenIdentity to push updates to
// any subscriber (e.g. api/server.ts → WebSocket clients).

import { EventEmitter } from 'events'

class DevOSEventBus extends EventEmitter {}

export const eventBus = new DevOSEventBus()
// Increase listener limit — many subsystems may subscribe
eventBus.setMaxListeners(50)
