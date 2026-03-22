"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeBuildError = analyzeBuildError;
function analyzeBuildError(log) {
    const lower = log.toLowerCase();
    if (lower.includes("module not found")) {
        return {
            type: "install_missing_package",
            message: "Detected missing module. Attempting npm install."
        };
    }
    if (lower.includes("typescript") && lower.includes("cannot find name")) {
        return {
            type: "typescript_missing_types",
            message: "Detected missing TypeScript types."
        };
    }
    if (lower.includes("port already in use")) {
        return {
            type: "port_conflict",
            message: "Detected port conflict."
        };
    }
    return {
        type: "unknown",
        message: "No known pattern detected."
    };
}
