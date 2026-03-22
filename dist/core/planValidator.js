"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePlan = validatePlan;
// Linux-only commands that should never appear on Windows
const LINUX_ONLY_PATTERNS = [
    /\bapt-get\b/,
    /\bbrew\b/,
    /curl\s+.*sudo/,
    /sudo\s+curl/,
    /\bchmod\b/,
    /\bchown\b/,
    /bash\s+-c/,
    /\/bin\/sh/,
    /\/usr\/bin/,
];
// Dangerous absolute Windows root paths (e.g. C:\ with no subdirectory)
const WIN_ROOT_PATH_PATTERN = /^[A-Za-z]:\\[^\\]*\.[^.\\]+$/; // e.g. C:\file.txt
const WIN_ROOT_DIR_PATTERN = /^[A-Za-z]:\\$/; // e.g. C:\
function validatePlan(plan, parsedGoal) {
    const errors = [];
    const warnings = [];
    // ── 1. Plan must have actions array with at least 1 item ─────
    if (!plan || typeof plan !== "object") {
        errors.push("Plan is null or not an object");
        return { valid: false, errors, warnings };
    }
    if (!Array.isArray(plan.actions)) {
        errors.push("Plan is missing an 'actions' array");
        return { valid: false, errors, warnings };
    }
    if (plan.actions.length === 0) {
        errors.push("Plan has an empty actions array — at least 1 action required");
    }
    // ── 2. Warn if too many actions ───────────────────────────────
    if (plan.actions.length > 10) {
        warnings.push(`Plan has ${plan.actions.length} actions — may be overly complex (consider breaking into sub-goals)`);
    }
    // ── 3. Per-action checks ──────────────────────────────────────
    const seenDescriptions = new Set();
    for (let i = 0; i < plan.actions.length; i++) {
        const action = plan.actions[i];
        const label = `Action[${i}] (${action.type ?? "unknown type"})`;
        // Must have a type
        if (!action.type) {
            errors.push(`${label}: missing 'type' field`);
        }
        // file_write must have content
        if (action.type === "file_write") {
            if (action.content === undefined || action.content === null) {
                errors.push(`${label}: file_write action at path "${action.path}" is missing 'content' field`);
            }
            // Detect file_write used to create a directory (no extension, no content)
            if (action.path && !action.path.includes(".") && (!action.content || action.content.trim() === "")) {
                errors.push(`${label}: file_write path "${action.path}" looks like a directory — use shell_exec with mkdir instead`);
            }
        }
        // Detect Linux-only commands on Windows
        if (parsedGoal.isWindows && action.type === "shell_exec" && action.command) {
            for (const pattern of LINUX_ONLY_PATTERNS) {
                if (pattern.test(action.command)) {
                    errors.push(`${label}: Linux-only command detected on Windows — "${action.command.substring(0, 60)}" matches ${pattern}`);
                    break;
                }
            }
        }
        // Detect writes to Windows root paths (C:\ directly)
        if (action.path) {
            if (WIN_ROOT_DIR_PATTERN.test(action.path)) {
                errors.push(`${label}: writes to Windows root path "${action.path}" — use a subdirectory`);
            }
            if (WIN_ROOT_PATH_PATTERN.test(action.path)) {
                errors.push(`${label}: writes directly to Windows drive root "${action.path}" — use a relative or subdirectory path`);
            }
        }
        // High-risk actions must have a description
        if (action.risk === "high" && !action.description) {
            errors.push(`${label}: high-risk action has no 'description' — always document destructive operations`);
        }
        // Basic circular dependency check: detect duplicate descriptions (proxy for repeated work)
        if (action.description) {
            const key = `${action.type}::${action.description}`;
            if (seenDescriptions.has(key)) {
                warnings.push(`${label}: duplicate action "${action.description}" detected — possible circular dependency or redundant step`);
            }
            seenDescriptions.add(key);
        }
    }
    // ── 4. Log results ───────────────────────────────────────────
    if (errors.length > 0) {
        console.warn(`[PlanValidator] ❌ Validation failed with ${errors.length} error(s):`);
        errors.forEach(e => console.warn(`  ERROR: ${e}`));
    }
    if (warnings.length > 0) {
        console.warn(`[PlanValidator] ⚠️  ${warnings.length} warning(s):`);
        warnings.forEach(w => console.warn(`  WARN: ${w}`));
    }
    if (errors.length === 0 && warnings.length === 0) {
        console.log(`[PlanValidator] ✅ Plan passed all checks`);
    }
    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}
