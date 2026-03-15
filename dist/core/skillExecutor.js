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
exports.SkillExecutor = void 0;
exports.runCommand = runCommand;
exports.createFile = createFile;
exports.editFile = editFile;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const execa_1 = require("execa");
const child_process_1 = require("child_process");
const LOG_FILE = "C:\\DevOS\\execution.log";
function logExecution(message) {
    const timestamp = new Date().toISOString();
    fs_1.default.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
}
const BLOCKED_PATTERNS = [
    "format",
    "shutdown",
    "reboot",
    "rd /s",
    "del /s",
    "rm -rf /"
];
function isBlocked(command) {
    return BLOCKED_PATTERNS.some(pattern => command.toLowerCase().includes(pattern));
}
function isLongRunning(command) {
    return /node |npm start|python |flask|uvicorn/.test(command);
}
async function ensurePackageJson(cwd) {
    const pkgPath = path_1.default.join(cwd, "package.json");
    if (!fs_1.default.existsSync(pkgPath)) {
        await (0, execa_1.execa)("npm init -y", {
            shell: true,
            cwd
        });
    }
}
async function runCommand(command, risk, cwd) {
    if (isBlocked(command)) {
        throw new Error("Blocked dangerous command.");
    }
    if (risk === "high") {
        throw new Error("High-risk command requires approval.");
    }
    logExecution(`COMMAND: ${command}`);
    if (command.startsWith("npm install")) {
        await ensurePackageJson(cwd);
    }
    if (isLongRunning(command)) {
        const child = (0, child_process_1.spawn)(command, {
            shell: true,
            cwd,
            detached: true,
            stdio: "ignore"
        });
        child.unref();
        logExecution(`SPAWNED LONG-RUNNING: ${command}`);
        return "Process started.";
    }
    const result = await (0, execa_1.execa)(command, {
        shell: true,
        cwd
    });
    logExecution(`OUTPUT: ${result.stdout}`);
    return result.stdout;
}
function createFile(filePath, content, risk) {
    if (risk === "high") {
        throw new Error("High-risk file operation requires approval.");
    }
    const dir = path_1.default.dirname(filePath);
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
    fs_1.default.writeFileSync(filePath, content);
    logExecution(`CREATE FILE: ${filePath}`);
}
function editFile(filePath, content, risk) {
    if (risk === "high") {
        throw new Error("High-risk file edit requires approval.");
    }
    if (!fs_1.default.existsSync(filePath)) {
        throw new Error("File does not exist.");
    }
    fs_1.default.writeFileSync(filePath, content);
    logExecution(`EDIT FILE: ${filePath}`);
}
// ── SkillExecutor class (used by agentLoop, executionController) ──
/**
 * Class-based wrapper so legacy consumers that do `new SkillExecutor()`
 * keep working while the underlying logic stays in the free functions above.
 */
class SkillExecutor {
    constructor(cwd = process.cwd()) {
        this.cwd = cwd;
    }
    async execute(skill, args = {}) {
        const command = typeof args.command === "string" ? args.command : skill;
        return runCommand(command, "low", this.cwd);
    }
    async run(command, risk = "low") {
        return runCommand(command, risk, this.cwd);
    }
    write(filePath, content, risk = "low") {
        createFile(filePath, content, risk);
    }
    edit(filePath, content, risk = "low") {
        editFile(filePath, content, risk);
    }
}
exports.SkillExecutor = SkillExecutor;
