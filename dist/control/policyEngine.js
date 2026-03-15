"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.policyEngine = exports.PolicyEngine = void 0;
// control/policyEngine.ts — Load and enforce config/policies.json
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const POLICY_PATH = path.join(__dirname, "../config/policies.json");
class PolicyEngine {
    constructor() {
        this.policy = this.load();
    }
    // ── Public API ──────────────────────────────────────────
    check(action) {
        const command = (action.command ?? "").toLowerCase();
        const filePath = (action.path ?? "").replace(/\//g, "\\");
        // ── Blocked commands ─────────────────────────────────
        for (const blocked of this.policy.blockedCommands) {
            if (command.includes(blocked.toLowerCase())) {
                return { allowed: false, reason: `Blocked command: "${blocked}"` };
            }
        }
        // ── Blocked paths ────────────────────────────────────
        for (const blocked of this.policy.blockedPaths) {
            const normalised = blocked.replace(/\//g, "\\");
            if (filePath.toLowerCase().startsWith(normalised.toLowerCase())) {
                return { allowed: false, reason: `Blocked path: "${blocked}"` };
            }
        }
        return { allowed: true };
    }
    getPolicy() {
        return { ...this.policy };
    }
    reload() {
        this.policy = this.load();
        console.log("[PolicyEngine] Policy reloaded from disk");
    }
    // ── Internal ────────────────────────────────────────────
    load() {
        try {
            const raw = fs.readFileSync(POLICY_PATH, "utf8");
            return JSON.parse(raw);
        }
        catch (err) {
            console.warn("[PolicyEngine] Failed to load policies.json — using defaults:", err);
            return {
                blockedCommands: ["rm -rf", "format", "shutdown", "DROP DATABASE", "DROP TABLE"],
                blockedPaths: ["C:\\Windows", "C:\\System32"],
                maxRetries: 5,
                maxRuntimeMs: 1800000,
                maxMemoryMb: 2048,
                requireApprovalAboveRisk: "high",
                autoExecuteBelow: 0.8,
                autoExecuteConfidence: true,
            };
        }
    }
}
exports.PolicyEngine = PolicyEngine;
exports.policyEngine = new PolicyEngine();
