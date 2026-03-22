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
exports.runTerminal = runTerminal;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const os_adapter_1 = require("./os-adapter");
const BLOCKED_PATTERNS = [
    /rm\s+-rf\s+\//i,
    /shutdown/i,
    /format/i,
    /del\s+\/f\s+\/s\s+\/q/i,
];
function isBlocked(command) {
    return BLOCKED_PATTERNS.some((pattern) => pattern.test(command));
}
async function runTerminal(command, timeoutMs = 20000, workspace) {
    if (isBlocked(command)) {
        return {
            success: false,
            exitCode: -1,
            stdout: "",
            stderr: "Blocked dangerous command.",
            durationMs: 0,
        };
    }
    return new Promise((resolve) => {
        const start = Date.now();
        const { shell } = (0, os_adapter_1.getRuntimeShell)();
        const sandboxCwd = workspace ? path_1.default.join(workspace, "sandbox") : undefined;
        const cwd = workspace
            ? (path_1.default.basename(workspace) === "sandbox"
                ? workspace
                : (sandboxCwd && fs_1.default.existsSync(sandboxCwd) ? sandboxCwd : workspace))
            : undefined;
        const child = (0, child_process_1.spawn)(command, {
            shell,
            cwd,
        });
        let stdout = "";
        let stderr = "";
        let finished = false;
        const timer = setTimeout(() => {
            if (!finished) {
                child.kill("SIGKILL");
                finished = true;
                resolve({
                    success: false,
                    exitCode: -1,
                    stdout,
                    stderr: "Process timed out.",
                    durationMs: Date.now() - start,
                });
            }
        }, timeoutMs);
        child.stdout.on("data", (data) => {
            stdout += data.toString();
        });
        child.stderr.on("data", (data) => {
            stderr += data.toString();
        });
        child.on("close", (code) => {
            if (finished)
                return;
            finished = true;
            clearTimeout(timer);
            resolve({
                success: code === 0,
                exitCode: code ?? -1,
                stdout,
                stderr,
                durationMs: Date.now() - start,
            });
        });
    });
}
