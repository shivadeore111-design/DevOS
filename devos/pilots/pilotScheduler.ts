// ============================================================
// devos/pilots/pilotScheduler.ts
// Schedules enabled pilots via cronTrigger + triggerOnStart
// ============================================================

import { pilotRegistry } from "./pilotRegistry";
import { pilotExecutor } from "./pilotExecutor";
import { PilotRun }      from "./types";
import { cronTrigger }   from "../../core/triggers/cronTrigger";
import { eventBus }      from "../../core/eventBus";

export class PilotScheduler {
  private _cronIds: Map<string, string> = new Map(); // pilotId → cronJobId
  private _running = false;

  // ── Start — register all enabled pilots ───────────────────

  start(): void {
    if (this._running) return;
    this._running = true;

    const enabled = pilotRegistry.listEnabled();
    let scheduled = 0;

    for (const manifest of enabled) {
      // Register cron schedule
      if (manifest.schedule) {
        const cronId = cronTrigger.add({
          schedule: manifest.schedule,
          goal:     `[Pilot: ${manifest.id}] ${manifest.description}`,
          enabled:  true,
        });
        this._cronIds.set(manifest.id, cronId);
        scheduled++;
        console.log(`[PilotScheduler] ⏰ Scheduled: ${manifest.name} (${manifest.schedule})`);
      }

      // Trigger on start
      if (manifest.triggerOnStart) {
        console.log(`[PilotScheduler] ▶️  TriggerOnStart: ${manifest.name}`);
        pilotExecutor.run(manifest.id).catch(err =>
          console.error(`[PilotScheduler] ❌ TriggerOnStart failed for ${manifest.id}: ${err.message}`)
        );
      }
    }

    // Listen for cron events that map to pilots
    eventBus.on("cron_triggered", ({ goal }: { jobId: string; goal: string }) => {
      // Match cron goal back to pilot
      const match = goal.match(/^\[Pilot: ([^\]]+)\]/);
      if (match) {
        const pilotId = match[1];
        if (pilotRegistry.get(pilotId)) {
          pilotExecutor.run(pilotId).catch(err =>
            console.error(`[PilotScheduler] ❌ Scheduled run failed: ${pilotId} — ${err.message}`)
          );
        }
      }
    });

    console.log(`[PilotScheduler] 🚀 ${scheduled} pilot(s) scheduled`);
  }

  // ── Stop — remove registered cron jobs ────────────────────

  stop(): void {
    for (const [pilotId, cronId] of this._cronIds.entries()) {
      try {
        cronTrigger.remove(cronId);
        console.log(`[PilotScheduler] Removed cron for pilot: ${pilotId}`);
      } catch { /* ignore if already removed */ }
    }
    this._cronIds.clear();
    this._running = false;
    console.log("[PilotScheduler] Stopped");
  }

  // ── Manual trigger ────────────────────────────────────────

  async runNow(pilotId: string): Promise<PilotRun> {
    console.log(`[PilotScheduler] ▶️  Manual run: ${pilotId}`);
    return pilotExecutor.run(pilotId);
  }
}

export const pilotScheduler = new PilotScheduler();
