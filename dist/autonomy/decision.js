"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.DecisionLayer = void 0;
const capabilities_1 = require("./capabilities");
class DecisionLayer {
    constructor() {
        this.capabilities = new capabilities_1.CapabilityManager();
    }
    // ─────────────────────────────────────────────
    // PLAN SCORING
    // ─────────────────────────────────────────────
    scorePlan(plan) {
        let score = 0;
        for (const action of plan.actions) {
            if (action.type === "system_task") {
                score += 40;
            }
            if (action.type === "command" && action.command?.startsWith("git")) {
                score += 20;
            }
            if (action.risk === "medium") {
                score += 5;
            }
            if (action.risk === "high") {
                score += 20;
            }
        }
        if (plan.actions.length > 5) {
            score += 20;
        }
        let decision = "executor";
        if (score >= 40) {
            decision = "openclaw";
        }
        if (score >= 80) {
            decision = "block";
        }
        this.printReport(score, plan.actions.length, decision);
        return { score, decision };
    }
    // ─────────────────────────────────────────────
    // ACTION DECISION
    // ─────────────────────────────────────────────
    decide(action) {
        // Hard block dangerous system tasks
        if (action.type === "system_task") {
            return "block";
        }
        // Capability: Git
        if (action.type === "command" &&
            action.command?.startsWith("git") &&
            !this.capabilities.has("git")) {
            console.log("🔐 Git capability not enabled → escalating.");
            return "openclaw";
        }
        // Capability: Network
        if (action.type === "command" &&
            (action.command?.includes("curl") ||
                action.command?.includes("wget")) &&
            !this.capabilities.has("network")) {
            console.log("🌐 Network capability not enabled → escalating.");
            return "openclaw";
        }
        // High risk commands escalate
        if (action.risk === "high") {
            return "openclaw";
        }
        return "executor";
    }
    // ─────────────────────────────────────────────
    // CAPABILITY CONTROL
    // ─────────────────────────────────────────────
    enableCapability(cap) {
        this.capabilities.enable(cap);
    }
    disableCapability(cap) {
        this.capabilities.disable(cap);
    }
    listCapabilities() {
        return this.capabilities.list();
    }
    // ─────────────────────────────────────────────
    // REPORTING
    // ─────────────────────────────────────────────
    printReport(score, actionCount, decision) {
        console.log("\n📊 Complexity Report");
        console.log(`   Score    : ${score}`);
        console.log(`   Actions  : ${actionCount}`);
        if (decision === "executor") {
            console.log("   Decision : ⚙ EXECUTOR");
        }
        if (decision === "openclaw") {
            console.log("   Decision : 🦾 OPENCLAW");
        }
        if (decision === "block") {
            console.log("   Decision : 🚫 BLOCK");
        }
        console.log(`   Summary  : Score: ${score} → ${decision}`);
        console.log("");
    }
}
exports.DecisionLayer = DecisionLayer;
