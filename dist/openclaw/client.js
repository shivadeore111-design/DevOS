"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenClawClient = void 0;
// @ts-ignore — @openclaw/core is not installed; stub for future use
const core_1 = require("@openclaw/core");
class OpenClawClient {
    constructor() {
        this.claw = new core_1.OpenClaw({
            workingDirectory: "C:\\DevOS\\workspace\\sandbox",
            allowDangerous: false
        });
    }
    async runTask(task) {
        console.log("🦾 OpenClaw executing task...");
        const result = await this.claw.execute(task);
        console.log("🦾 OpenClaw Result:\n", result);
        return result;
    }
}
exports.OpenClawClient = OpenClawClient;
