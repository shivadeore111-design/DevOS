"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.CapabilityManager = void 0;
class CapabilityManager {
    constructor() {
        this.enabled = new Set();
    }
    enable(cap) {
        this.enabled.add(cap);
        console.log(`🦾 Capability enabled: ${cap}`);
    }
    disable(cap) {
        this.enabled.delete(cap);
    }
    has(cap) {
        return this.enabled.has(cap);
    }
    list() {
        return Array.from(this.enabled);
    }
}
exports.CapabilityManager = CapabilityManager;
