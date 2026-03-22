"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.emergencyStop = exports.EmergencyStop = void 0;
// control/emergencyStop.ts — Hard-stop any goal or the whole system
const processSupervisor_1 = require("../devos/runtime/processSupervisor");
const taskStore_1 = require("../core/taskStore");
const eventBus_1 = require("../core/eventBus");
class EmergencyStop {
    constructor() {
        this.stopRequested = new Set();
    }
    /** Kill all processes for a goal and mark its task as cancelled */
    async stop(goalId) {
        console.warn(`[EmergencyStop] ⛔ Stop requested for goal: ${goalId}`);
        this.stopRequested.add(goalId);
        // Kill spawned processes
        await processSupervisor_1.processSupervisor.killGoal(goalId);
        // Mark task as cancelled in the task store
        const task = taskStore_1.taskStore.get(goalId);
        if (task) {
            task.status = "cancelled";
            task.logs.push({
                timestamp: new Date().toISOString(),
                level: "warn",
                message: `Emergency stop triggered for goal ${goalId}`,
            });
            taskStore_1.taskStore.save(task);
        }
        // Broadcast event
        eventBus_1.eventBus.emit("emergency_stop", { goalId, reason: "emergency stop requested" });
        console.warn(`[EmergencyStop] ✅ Goal ${goalId} stopped.`);
    }
    /** Kill everything — used for system-level shutdown */
    async stopAll() {
        console.warn("[EmergencyStop] ⛔ STOP ALL triggered — killing all managed processes");
        await processSupervisor_1.processSupervisor.killAll();
        eventBus_1.eventBus.emit("emergency_stop", { goalId: "*", reason: "system shutdown" });
        console.warn("[EmergencyStop] ✅ All processes stopped.");
    }
    /** Long-running loops can poll this to exit gracefully */
    isStopRequested(goalId) {
        return this.stopRequested.has(goalId);
    }
}
exports.EmergencyStop = EmergencyStop;
exports.emergencyStop = new EmergencyStop();
