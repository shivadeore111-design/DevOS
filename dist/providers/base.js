"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseProvider = void 0;
class BaseProvider {
    constructor() {
        this.failureCount = 0;
        this.cooldownUntil = 0;
    }
    isHealthy() {
        return Date.now() > this.cooldownUntil;
    }
    markFailure() {
        this.failureCount++;
        if (this.failureCount >= 3) {
            this.cooldownUntil = Date.now() + 60000; // 1 min cooldown
            this.failureCount = 0;
        }
    }
    markSuccess() {
        this.failureCount = 0;
    }
}
exports.BaseProvider = BaseProvider;
