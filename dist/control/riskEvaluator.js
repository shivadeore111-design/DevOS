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
exports.riskEvaluator = exports.RiskEvaluator = void 0;
// control/riskEvaluator.ts — Score and classify action risk level
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class RiskEvaluator {
    evaluate(action) {
        let score = 0;
        const reasons = [];
        // ── file_write to existing file ──────────────────────
        if (action.type === "file_write" && action.path) {
            const absPath = path.resolve(action.path);
            if (fs.existsSync(absPath)) {
                score += 20;
                reasons.push("file_write overwrites existing file (+20)");
            }
        }
        // ── shell_exec base ──────────────────────────────────
        if (action.type === "shell_exec") {
            score += 10;
            reasons.push("shell_exec base risk (+10)");
            const cmd = (action.command ?? "").toLowerCase();
            if (/\binstall\b/.test(cmd)) {
                score += 15;
                reasons.push("command contains 'install' (+15)");
            }
            if (/\b(delete|remove|drop)\b/.test(cmd)) {
                score += 40;
                reasons.push("command contains delete/remove/drop (+40)");
            }
            if (/\b(deploy|publish)\b/.test(cmd)) {
                score += 30;
                reasons.push("command contains deploy/publish (+30)");
            }
        }
        // ── Sensitive path ───────────────────────────────────
        const actionPath = action.path ?? action.command ?? "";
        if (/[Cc]:\\[Uu]sers[/\\][^/\\]+[/\\](?!AppData)/.test(actionPath)) {
            score += 25;
            reasons.push("path touches C:\\Users root directory (+25)");
        }
        // ── Missing description ──────────────────────────────
        if (!action.description) {
            score += 10;
            reasons.push("action has no description (+10)");
        }
        // ── Derive level ─────────────────────────────────────
        let level;
        if (score >= 76)
            level = "critical";
        else if (score >= 51)
            level = "high";
        else if (score >= 26)
            level = "medium";
        else
            level = "low";
        const requiresApproval = level === "high" || level === "critical";
        return { level, score, reasons, requiresApproval };
    }
}
exports.RiskEvaluator = RiskEvaluator;
exports.riskEvaluator = new RiskEvaluator();
