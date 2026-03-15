"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryAging = exports.MemoryAging = void 0;
const MS_PER_DAY = 86400000;
class MemoryAging {
    // ── Age entries — returns modified entries with pruning flags ─
    age(entries) {
        const now = Date.now();
        const result = [];
        for (const entry of entries) {
            const ageMs = now - new Date(entry.timestamp).getTime();
            const ageDays = ageMs / MS_PER_DAY;
            const mutated = { ...entry };
            if (this.shouldPrune(entry)) {
                // Mark for pruning — skip adding to result
                continue;
            }
            // Boost high-performers used 10+ times with >0.8 success rate
            if (entry.useCount >= 10 && entry.successRate > 0.8) {
                mutated.successRate = Math.min(1.0, entry.successRate * 1.1);
            }
            result.push(mutated);
        }
        return result;
    }
    // ── shouldPrune — returns true if entry should be removed ────
    shouldPrune(entry) {
        const now = Date.now();
        const ageMs = now - new Date(entry.timestamp).getTime();
        const ageDays = ageMs / MS_PER_DAY;
        // Old low-performers
        if (ageDays > 30 && entry.successRate < 0.3)
            return true;
        // Never used after 7 days
        if (ageDays > 7 && entry.useCount === 0)
            return true;
        return false;
    }
    // ── Run full aging cycle on a live ExecutionMemory instance ──
    runAging(memory) {
        const before = memory.getAll();
        const after = this.age(before);
        const pruned = before.length - after.length;
        // Update boosted entries in memory (only those still present)
        for (const updated of after) {
            const existing = memory.getAll().find(e => e.id === updated.id);
            if (existing && existing.successRate !== updated.successRate) {
                // In-place update via recordUse is not ideal for boosts,
                // so use a direct approach — store updated entry
                Object.assign(existing, { successRate: updated.successRate });
            }
        }
        // Prune entries that should be removed
        memory.prune();
        console.log(`[MemoryAging] Aging complete — ${pruned} entries removed, ${after.length} retained`);
    }
}
exports.MemoryAging = MemoryAging;
exports.memoryAging = new MemoryAging();
