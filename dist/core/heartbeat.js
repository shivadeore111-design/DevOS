"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.heartbeat = exports.Heartbeat = void 0;
// core/heartbeat.ts — Per-goal liveness monitor with limit enforcement
const resourceManager_1 = require("../devos/runtime/resourceManager");
const budgetManager_1 = require("../control/budgetManager");
const emergencyStop_1 = require("../control/emergencyStop");
const eventBus_1 = require("./eventBus");
const DEFAULT_INTERVAL_MS = 5000;
class Heartbeat {
    constructor() {
        this.timers = new Map();
    }
    // ── Start / stop ─────────────────────────────────────────
    start(goalId, intervalMs = DEFAULT_INTERVAL_MS) {
        if (this.timers.has(goalId))
            return; // already running
        const timer = setInterval(() => this.tick(goalId), intervalMs);
        // Allow Node to exit even if heartbeat is still running
        if (timer.unref)
            timer.unref();
        this.timers.set(goalId, timer);
        console.log(`[Heartbeat] Started for ${goalId} (every ${intervalMs}ms)`);
    }
    stop(goalId) {
        const timer = this.timers.get(goalId);
        if (!timer)
            return;
        clearInterval(timer);
        this.timers.delete(goalId);
        console.log(`[Heartbeat] Stopped for ${goalId}`);
    }
    stopAll() {
        for (const goalId of this.timers.keys()) {
            this.stop(goalId);
        }
    }
    // ── Tick ─────────────────────────────────────────────────
    tick(goalId) {
        const runtimeMs = resourceManager_1.resourceManager.getRuntimeMs(goalId);
        let stopped = false;
        // Resource limit check
        const resCheck = resourceManager_1.resourceManager.checkLimits(goalId);
        if (resCheck.exceeded) {
            console.warn(`[Heartbeat] Resource limit exceeded for ${goalId}: ${resCheck.reason}`);
            emergencyStop_1.emergencyStop.stop(goalId).catch(() => { });
            this.stop(goalId);
            stopped = true;
        }
        // Budget limit check
        if (!stopped) {
            const budCheck = budgetManager_1.budgetManager.canContinue(goalId);
            if (!budCheck.allowed) {
                console.warn(`[Heartbeat] Budget limit exceeded for ${goalId}: ${budCheck.reason}`);
                emergencyStop_1.emergencyStop.stop(goalId).catch(() => { });
                this.stop(goalId);
                stopped = true;
            }
        }
        // Emit heartbeat event
        eventBus_1.eventBus.emit("heartbeat", {
            goalId,
            runtimeMs,
            status: stopped ? "stopped" : "alive",
        });
    }
}
exports.Heartbeat = Heartbeat;
exports.heartbeat = new Heartbeat();
