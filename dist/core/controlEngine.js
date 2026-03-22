"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldStop = shouldStop;
exports.calculateAdaptiveDelay = calculateAdaptiveDelay;
const memoryEngine_1 = require("../memory/memoryEngine");
function shouldStop(cycleCount) {
    const memory = (0, memoryEngine_1.loadMemory)();
    const maxCycles = 10;
    if (cycleCount >= maxCycles) {
        return { stop: true, reason: "Max cycles reached." };
    }
    const recentFailures = memory.failures.slice(-3);
    if (recentFailures.length === 3) {
        return { stop: true, reason: "3 consecutive failures detected." };
    }
    const recentScores = memory.improvements
        .slice(-5)
        .map((entry) => entry?.data?.usefulnessScore)
        .filter((s) => typeof s === "number");
    if (recentScores.length >= 5) {
        const avg = recentScores.reduce((a, b) => a + b, 0) /
            recentScores.length;
        if (avg < 5) {
            return { stop: true, reason: "Low average usefulness detected." };
        }
    }
    return { stop: false };
}
function calculateAdaptiveDelay() {
    const memory = (0, memoryEngine_1.loadMemory)();
    const lastImprovement = memory.improvements.slice(-1)[0];
    const recentFailures = memory.failures.slice(-2);
    // Cooldown after failures
    if (recentFailures.length > 0) {
        return 60000; // 60 seconds
    }
    if (!lastImprovement || !lastImprovement.data) {
        return 10000; // default 10 seconds
    }
    const score = lastImprovement.data.usefulnessScore;
    if (score >= 8) {
        return 60000; // high-quality → slow deeper research
    }
    if (score >= 6) {
        return 30000; // medium-quality → moderate pace
    }
    return 10000; // low-quality → pivot quickly
}
