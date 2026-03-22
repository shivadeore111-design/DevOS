"use strict";
// ============================================================
// devos/pilots/pilotScheduler.ts
// Schedules enabled pilots via cronTrigger + triggerOnStart
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.pilotScheduler = exports.PilotScheduler = void 0;
const pilotRegistry_1 = require("./pilotRegistry");
const pilotExecutor_1 = require("./pilotExecutor");
const cronTrigger_1 = require("../../core/triggers/cronTrigger");
const eventBus_1 = require("../../core/eventBus");
class PilotScheduler {
    constructor() {
        this._cronIds = new Map(); // pilotId → cronJobId
        this._running = false;
    }
    // ── Start — register all enabled pilots ───────────────────
    start() {
        if (this._running)
            return;
        this._running = true;
        const enabled = pilotRegistry_1.pilotRegistry.listEnabled();
        let scheduled = 0;
        for (const manifest of enabled) {
            // Register cron schedule
            if (manifest.schedule) {
                const cronId = cronTrigger_1.cronTrigger.add({
                    schedule: manifest.schedule,
                    goal: `[Pilot: ${manifest.id}] ${manifest.description}`,
                    enabled: true,
                });
                this._cronIds.set(manifest.id, cronId);
                scheduled++;
                console.log(`[PilotScheduler] ⏰ Scheduled: ${manifest.name} (${manifest.schedule})`);
            }
            // Trigger on start
            if (manifest.triggerOnStart) {
                console.log(`[PilotScheduler] ▶️  TriggerOnStart: ${manifest.name}`);
                pilotExecutor_1.pilotExecutor.run(manifest.id).catch(err => console.error(`[PilotScheduler] ❌ TriggerOnStart failed for ${manifest.id}: ${err.message}`));
            }
        }
        // Listen for cron events that map to pilots
        eventBus_1.eventBus.on("cron_triggered", ({ goal }) => {
            // Match cron goal back to pilot
            const match = goal.match(/^\[Pilot: ([^\]]+)\]/);
            if (match) {
                const pilotId = match[1];
                if (pilotRegistry_1.pilotRegistry.get(pilotId)) {
                    pilotExecutor_1.pilotExecutor.run(pilotId).catch(err => console.error(`[PilotScheduler] ❌ Scheduled run failed: ${pilotId} — ${err.message}`));
                }
            }
        });
        console.log(`[PilotScheduler] 🚀 ${scheduled} pilot(s) scheduled`);
    }
    // ── Stop — remove registered cron jobs ────────────────────
    stop() {
        for (const [pilotId, cronId] of this._cronIds.entries()) {
            try {
                cronTrigger_1.cronTrigger.remove(cronId);
                console.log(`[PilotScheduler] Removed cron for pilot: ${pilotId}`);
            }
            catch { /* ignore if already removed */ }
        }
        this._cronIds.clear();
        this._running = false;
        console.log("[PilotScheduler] Stopped");
    }
    // ── Manual trigger ────────────────────────────────────────
    async runNow(pilotId) {
        console.log(`[PilotScheduler] ▶️  Manual run: ${pilotId}`);
        return pilotExecutor_1.pilotExecutor.run(pilotId);
    }
}
exports.PilotScheduler = PilotScheduler;
exports.pilotScheduler = new PilotScheduler();
