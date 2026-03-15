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
exports.OsAdapter = exports.CURRENT_PLATFORM = void 0;
exports.detectPlatform = detectPlatform;
exports.getRuntimeShell = getRuntimeShell;
const os_1 = __importDefault(require("os"));
function detectPlatform() {
    return os_1.default.platform() === "win32" ? "windows" : "unix";
}
exports.CURRENT_PLATFORM = detectPlatform();
function getRuntimeShell() {
    const isWindows = os_1.default.platform() === "win32";
    return {
        shell: isWindows ? "cmd.exe" : "/bin/bash",
        flag: isWindows ? "/c" : "-c",
    };
}
// ─────────────────────────────────────────────
// OS ADAPTER
// ─────────────────────────────────────────────
class OsAdapter {
    constructor(platform = exports.CURRENT_PLATFORM) {
        this.platform = platform;
    }
    adapt(command) {
        const trimmed = command.trim();
        if (this.platform === "windows") {
            if (trimmed.startsWith("sudo ")) {
                return {
                    original: trimmed,
                    translated: trimmed,
                    wasTranslated: false,
                    blocked: true,
                    blockReason: "sudo not allowed on Windows"
                };
            }
            if (trimmed.startsWith("touch ")) {
                return {
                    original: trimmed,
                    translated: trimmed.replace(/^touch\s+/, "type nul > "),
                    wasTranslated: true,
                    blocked: false
                };
            }
            if (trimmed.startsWith("ls")) {
                return {
                    original: trimmed,
                    translated: trimmed.replace(/^ls/, "dir"),
                    wasTranslated: true,
                    blocked: false
                };
            }
        }
        return {
            original: trimmed,
            translated: trimmed,
            wasTranslated: false,
            blocked: false
        };
    }
    getPlatform() {
        return this.platform;
    }
    getPlatformLabel() {
        return this.platform === "windows"
            ? "Windows (PowerShell/CMD)"
            : "Unix/Linux/macOS";
    }
    getLLMContext() {
        if (this.platform === "windows") {
            return `
PLATFORM: Windows
- Do NOT use Unix commands like touch, ls, grep, chmod.
- Use Windows equivalents.
- Use relative paths only.
`;
        }
        return `
PLATFORM: Unix
- Standard bash commands allowed.
`;
    }
}
exports.OsAdapter = OsAdapter;
