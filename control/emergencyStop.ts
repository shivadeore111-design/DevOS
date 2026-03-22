// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// control/emergencyStop.ts — Hard-stop any goal or the whole system

import { processSupervisor } from "../devos/runtime/processSupervisor";
import { taskStore }         from "../core/taskStore";
import { eventBus }          from "../core/eventBus";

export class EmergencyStop {
  private stopRequested = new Set<string>();

  /** Kill all processes for a goal and mark its task as cancelled */
  async stop(goalId: string): Promise<void> {
    console.warn(`[EmergencyStop] ⛔ Stop requested for goal: ${goalId}`);
    this.stopRequested.add(goalId);

    // Kill spawned processes
    await processSupervisor.killGoal(goalId);

    // Mark task as cancelled in the task store
    const task = taskStore.get(goalId);
    if (task) {
      task.status = "cancelled";
      task.logs.push({
        timestamp: new Date().toISOString(),
        level:     "warn",
        message:   `Emergency stop triggered for goal ${goalId}`,
      });
      taskStore.save(task);
    }

    // Broadcast event
    eventBus.emit("emergency_stop", { goalId, reason: "emergency stop requested" });
    console.warn(`[EmergencyStop] ✅ Goal ${goalId} stopped.`);
  }

  /** Kill everything — used for system-level shutdown */
  async stopAll(): Promise<void> {
    console.warn("[EmergencyStop] ⛔ STOP ALL triggered — killing all managed processes");
    await processSupervisor.killAll();
    eventBus.emit("emergency_stop", { goalId: "*", reason: "system shutdown" });
    console.warn("[EmergencyStop] ✅ All processes stopped.");
  }

  /** Long-running loops can poll this to exit gracefully */
  isStopRequested(goalId: string): boolean {
    return this.stopRequested.has(goalId);
  }
}

export const emergencyStop = new EmergencyStop();
