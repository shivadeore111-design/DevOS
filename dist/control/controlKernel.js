"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.controlKernel = exports.ControlKernel = void 0;
// control/controlKernel.ts — Central gate: every action passes through here
const commandSanitizer_1 = require("./commandSanitizer");
const policyEngine_1 = require("./policyEngine");
const riskEvaluator_1 = require("./riskEvaluator");
const budgetManager_1 = require("./budgetManager");
const eventBus_1 = require("../core/eventBus");
const auditLogger_1 = require("../security/auditLogger");
const APPROVAL_TIMEOUT_MS = 30000;
class ControlKernel {
    // ── Prompt injection scanner ────────────────────────────
    scanForInjection(input) {
        const INJECTION_PATTERNS = [
            /ignore\s+previous\s+instructions/i,
            /disregard\s+(all\s+)?(previous|prior|earlier)/i,
            /override\s+(your\s+)?(instructions|directives|rules)/i,
            /you\s+are\s+now\s+/i,
            /forget\s+your\s+/i,
            /new\s+persona/i,
            /act\s+as\s+(a\s+|an\s+)?(?!devos)/i,
            /jailbreak/i,
            /rm\s+-rf\s+\//i,
            /DROP\s+TABLE/i,
            /;\s*cat\s+\/etc\/passwd/i,
            /\/etc\/shadow/i,
            /base64\s*--decode/i,
            /eval\s*\(/i,
        ];
        for (const pattern of INJECTION_PATTERNS) {
            if (pattern.test(input)) {
                console.warn(`[ControlKernel] 🚨 Prompt injection detected: ${input.slice(0, 100)}`);
                return true;
            }
        }
        return false;
    }
    // ── Main validation gate ────────────────────────────────
    validate(action, goalId) {
        const actionLabel = `${action.type}${action.description ? ` "${action.description.slice(0, 40)}"` : ""}`;
        // 0. Prompt injection scan — check goal, description, command, query fields
        const inputsToScan = [
            action.goal, action.description, action.command,
            action.query, action.content, action.prompt,
        ].filter(Boolean).join(" ");
        if (inputsToScan && this.scanForInjection(inputsToScan)) {
            auditLogger_1.auditLogger.log({
                timestamp: new Date().toISOString(),
                type: "injection_blocked",
                actor: "control-kernel",
                action: `blocked:${action.type ?? "unknown"}`,
                detail: inputsToScan.slice(0, 200),
                success: false,
            });
            return { approved: false, reason: "Prompt injection detected", riskLevel: "critical" };
        }
        // 1. Budget / runtime check
        const budget = budgetManager_1.budgetManager.canContinue(goalId);
        if (!budget.allowed) {
            console.log(`[ControlKernel] ${actionLabel} ❌ ${budget.reason}`);
            return { approved: false, reason: budget.reason, riskLevel: "high" };
        }
        // 2. Command sanitizer (shell only)
        if (action.type === "shell_exec" && action.command) {
            const san = commandSanitizer_1.commandSanitizer.sanitize(action.command);
            if (!san.safe) {
                console.log(`[ControlKernel] ${actionLabel} ❌ ${san.reason}`);
                return { approved: false, reason: san.reason, riskLevel: "critical" };
            }
            // Apply sanitized command back (strips sudo etc.)
            action.command = san.sanitized;
            for (const w of san.warnings) {
                console.warn(`[ControlKernel] ⚠️  ${w}`);
            }
        }
        // 3. Policy engine check
        const policy = policyEngine_1.policyEngine.check(action);
        if (!policy.allowed) {
            console.log(`[ControlKernel] ${actionLabel} ❌ ${policy.reason}`);
            return { approved: false, reason: policy.reason, riskLevel: "critical" };
        }
        // 4. Risk evaluation
        const risk = riskEvaluator_1.riskEvaluator.evaluate(action);
        const icon = risk.requiresApproval ? "⚠️ " : "✅";
        console.log(`[ControlKernel] ${action.type} risk=${risk.level} ${icon}`);
        if (risk.requiresApproval) {
            // Emit event for dashboard; caller should call requestApproval() for interactive flow
            return {
                approved: false,
                reason: `Risk level ${risk.level} requires manual approval (score: ${risk.score})`,
                riskLevel: risk.level,
            };
        }
        return { approved: true, riskLevel: risk.level };
    }
    // ── Async approval request ──────────────────────────────
    async requestApproval(action, goalId) {
        return new Promise(resolve => {
            console.log(`[ControlKernel] 🔔 Approval required for action: ${action.type} — goalId: ${goalId}`);
            // Emit approval_required event
            eventBus_1.eventBus.emit("approval_required", { action, goalId });
            let settled = false;
            const onGranted = (data) => {
                if (data?.goalId !== goalId)
                    return;
                if (settled)
                    return;
                settled = true;
                eventBus_1.eventBus.off("approval_granted", onGranted);
                eventBus_1.eventBus.off("approval_denied", onDenied);
                console.log(`[ControlKernel] ✅ Approval granted for ${goalId}`);
                resolve(true);
            };
            const onDenied = (data) => {
                if (data?.goalId !== goalId)
                    return;
                if (settled)
                    return;
                settled = true;
                eventBus_1.eventBus.off("approval_granted", onGranted);
                eventBus_1.eventBus.off("approval_denied", onDenied);
                console.log(`[ControlKernel] ❌ Approval denied for ${goalId}`);
                resolve(false);
            };
            eventBus_1.eventBus.on("approval_granted", onGranted);
            eventBus_1.eventBus.on("approval_denied", onDenied);
            // Auto-deny after timeout
            setTimeout(() => {
                if (!settled) {
                    settled = true;
                    eventBus_1.eventBus.off("approval_granted", onGranted);
                    eventBus_1.eventBus.off("approval_denied", onDenied);
                    console.log(`[ControlKernel] ⏱️  Approval timed out for ${goalId} — auto-denied`);
                    resolve(false);
                }
            }, APPROVAL_TIMEOUT_MS);
        });
    }
}
exports.ControlKernel = ControlKernel;
exports.controlKernel = new ControlKernel();
