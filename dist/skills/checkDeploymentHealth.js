"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runHealthCheckSkill = runHealthCheckSkill;
const https_1 = __importDefault(require("https"));
const memory_1 = require("../core/memory");
async function runHealthCheckSkill(projectRoot) {
    console.log("🧩 Running Deployment Health Check...");
    const memory = (0, memory_1.loadMemory)();
    if (!memory.lastDeploymentUrl) {
        console.log("⚠ No deployment URL found in memory.");
        return;
    }
    const url = memory.lastDeploymentUrl;
    await new Promise((resolve) => {
        https_1.default
            .get(url, (res) => {
            const status = res.statusCode || 0;
            if (status >= 200 && status < 400) {
                console.log("✅ Deployment is healthy:", status);
                memory.lastError = "";
            }
            else {
                console.log("🚨 Deployment returned bad status:", status);
                memory.lastError = `Health check failed with status ${status}`;
            }
            (0, memory_1.saveMemory)(memory);
            resolve();
        })
            .on("error", (err) => {
            console.log("🚨 Health check failed:", err.message);
            memory.lastError = err.message;
            (0, memory_1.saveMemory)(memory);
            resolve();
        });
    });
}
