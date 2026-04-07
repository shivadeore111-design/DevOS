"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDoctor = runDoctor;
// core/doctor.ts — System health checks for DevOS subsystems.
//
// Sprint 23: ComputerUse Memory check via MemoryStrategy.
// Sprint 24: Hardware Detection + First-boot Setup checks.
//
// NOTE: This is the sandbox stub. The full implementation (with LLM provider,
// Docker, database, and tool-registry checks) lives at C:\Users\shiva\DevOS\core\doctor.ts
// and will be merged on the host machine.
const memoryStrategy_1 = require("./memoryStrategy");
const hardwareDetector_1 = require("./hardwareDetector");
const setupWizard_1 = require("./setupWizard");
const evolutionAnalyzer_1 = require("./evolutionAnalyzer");
// ── Individual checks ─────────────────────────────────────────
/**
 * Sprint 23 — ComputerUse Memory check.
 */
async function checkComputerUseMemory() {
    try {
        const stats = memoryStrategy_1.memoryStrategy.stats();
        const status = stats.total === 0 ? 'warn' : 'ok';
        return {
            name: 'ComputerUse Memory',
            status,
            message: stats.total === 0
                ? 'Memory store is empty — no computer-use sessions recorded yet'
                : `Memory store healthy — ${stats.total} goal(s), avg success rate ${(stats.avgSuccessRate * 100).toFixed(1)}%`,
            detail: {
                totalGoals: stats.total,
                avgSuccessRate: stats.avgSuccessRate,
                topGoals: stats.topGoals,
            },
        };
    }
    catch (err) {
        return {
            name: 'ComputerUse Memory',
            status: 'error',
            message: `Memory store unavailable: ${err?.message ?? 'unknown error'}`,
        };
    }
}
// ── Doctor runner ─────────────────────────────────────────────
async function runDoctor() {
    const checks = [];
    // Sprint 23 — ComputerUse Memory
    checks.push(await checkComputerUseMemory());
    // Sprint 24 — Hardware Detection
    const hw = (0, hardwareDetector_1.detectHardware)();
    checks.push({
        name: 'Hardware Detection',
        status: hw.gpu !== 'Unknown GPU' ? 'ok' : 'warn',
        message: hw.gpu !== 'Unknown GPU'
            ? `GPU detected: ${hw.gpu}`
            : 'GPU not detected — model recommendations may be suboptimal',
        detail: `${hw.gpu} · ${hw.vramGB}GB VRAM · ${hw.ramGB}GB RAM · ${hw.platform}`,
    });
    // Sprint 24 — First-boot Setup
    const setupDone = (0, setupWizard_1.isSetupComplete)();
    checks.push({
        name: 'First-boot Setup',
        status: setupDone ? 'ok' : 'warn',
        message: setupDone ? 'Setup complete' : 'Run: devos setup',
        detail: setupDone ? 'Setup complete' : 'Run: devos setup',
    });
    // Sprint 27 — Self-Evolution Analyzer
    checks.push({
        name: 'Evolution Analyzer',
        status: 'ok',
        message: evolutionAnalyzer_1.evolutionAnalyzer.getSummary(),
        detail: evolutionAnalyzer_1.evolutionAnalyzer.getSummary(),
    });
    // Additional checks (LLM, Docker, DB, etc.) live in the full host implementation.
    return {
        timestamp: new Date().toISOString(),
        checks,
        healthy: checks.every(c => c.status !== 'error'),
    };
}
