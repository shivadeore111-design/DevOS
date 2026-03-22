"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.osContext = void 0;
exports.detectOSContext = detectOSContext;
// core/osContext.ts — Runtime OS detection and capability discovery
const os_1 = __importDefault(require("os"));
const child_process_1 = require("child_process");
function checkCommand(cmd) {
    try {
        (0, child_process_1.execSync)(`${cmd} --version`, { stdio: "ignore" });
        return true;
    }
    catch {
        return false;
    }
}
function detectOSContext() {
    const platform = os_1.default.platform();
    const isWindows = platform === "win32";
    return {
        platform,
        shell: isWindows ? "cmd.exe" : "/bin/bash",
        shellFlag: isWindows ? "/c" : "-c",
        nodeVersion: process.version,
        hasDocker: checkCommand("docker"),
        hasGit: checkCommand("git"),
        hasNpm: checkCommand("npm"),
        tempDir: os_1.default.tmpdir(),
        homeDir: os_1.default.homedir()
    };
}
exports.osContext = detectOSContext();
