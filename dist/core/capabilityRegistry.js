"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableCapabilities = getAvailableCapabilities;
exports.getCapabilityNames = getCapabilityNames;
// core/capabilityRegistry.ts
const skillRegistry_1 = require("./skillRegistry");
const builtInCapabilities = [
    "git_push",
    "vercel_deploy",
    "check_deployment_health",
    "express_setup",
    "analyze_build_error",
    "run_command",
    "file_create",
    "file_edit"
];
async function getAvailableCapabilities() {
    const generatedSkills = await (0, skillRegistry_1.loadGeneratedSkills)();
    const generatedCapabilities = generatedSkills.map((skill) => ({
        name: skill.name,
        source: "generated"
    }));
    const builtIn = builtInCapabilities.map((name) => ({
        name,
        source: "built-in"
    }));
    return [...builtIn, ...generatedCapabilities];
}
async function getCapabilityNames() {
    const capabilities = await getAvailableCapabilities();
    return capabilities.map((c) => c.name);
}
