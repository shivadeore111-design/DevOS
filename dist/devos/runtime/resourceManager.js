"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.resourceManager = exports.ResourceManager = void 0;
const DEFAULT_LIMITS = {
    maxRuntimeMs: 1800000, // 30 minutes
    maxMemoryMb: 2048,
    maxDiskMb: 1024,
};
class ResourceManager {
    constructor() {
        this.tracking = new Map();
    }
    /** Begin tracking a goal's resource usage */
    startTracking(goalId, limits = {}) {
        this.tracking.set(goalId, {
            startMs: Date.now(),
            limits: { ...DEFAULT_LIMITS, ...limits },
        });
        console.log(`[ResourceManager] Tracking started for ${goalId}`);
    }
    /** Check whether any resource limit has been breached */
    checkLimits(goalId) {
        const entry = this.tracking.get(goalId);
        if (!entry)
            return { exceeded: false };
        const runtimeMs = Date.now() - entry.startMs;
        if (runtimeMs > entry.limits.maxRuntimeMs) {
            const mins = (entry.limits.maxRuntimeMs / 60000).toFixed(0);
            return {
                exceeded: true,
                reason: `Runtime limit exceeded: ${(runtimeMs / 60000).toFixed(1)} min > ${mins} min`,
            };
        }
        // Memory check (best-effort; only available for the current process)
        const memMb = process.memoryUsage().rss / (1024 * 1024);
        if (memMb > entry.limits.maxMemoryMb) {
            return {
                exceeded: true,
                reason: `Memory limit exceeded: ${memMb.toFixed(0)} MB > ${entry.limits.maxMemoryMb} MB`,
            };
        }
        return { exceeded: false };
    }
    /** Stop tracking a goal */
    stopTracking(goalId) {
        if (this.tracking.has(goalId)) {
            const ms = this.getRuntimeMs(goalId);
            console.log(`[ResourceManager] Stopped tracking ${goalId} — runtime: ${(ms / 1000).toFixed(1)}s`);
            this.tracking.delete(goalId);
        }
    }
    /** Return elapsed milliseconds for a tracked goal */
    getRuntimeMs(goalId) {
        const entry = this.tracking.get(goalId);
        return entry ? Date.now() - entry.startMs : 0;
    }
}
exports.ResourceManager = ResourceManager;
exports.resourceManager = new ResourceManager();
