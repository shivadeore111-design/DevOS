"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runInSandbox = runInSandbox;
// core/codeInterpreter.ts — Isolated code execution sandbox.
// Runs Python or Node.js scripts in per-session subdirectories under
// workspace/sandbox/interpreter/. Each session gets a clean directory;
// generated files are reported back and the directory is cleaned up
// automatically after 5 minutes.
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const SANDBOX_DIR = path_1.default.join(process.cwd(), 'workspace', 'sandbox', 'interpreter');
async function runInSandbox(code, language, packages) {
    const start = Date.now();
    fs_1.default.mkdirSync(SANDBOX_DIR, { recursive: true });
    const sessionId = `session_${Date.now()}`;
    const sessionDir = path_1.default.join(SANDBOX_DIR, sessionId);
    fs_1.default.mkdirSync(sessionDir, { recursive: true });
    // Schedule cleanup after 5 minutes regardless of outcome
    const scheduleCleanup = () => {
        setTimeout(() => {
            try {
                fs_1.default.rmSync(sessionDir, { recursive: true, force: true });
            }
            catch { }
        }, 5 * 60 * 1000);
    };
    try {
        if (language === 'python') {
            // Install packages if requested
            if (packages && packages.length > 0) {
                try {
                    (0, child_process_1.execSync)(`pip install ${packages.join(' ')} --quiet --break-system-packages 2>&1`, { timeout: 30000 });
                }
                catch { }
            }
            const scriptPath = path_1.default.join(sessionDir, 'script.py');
            fs_1.default.writeFileSync(scriptPath, code);
            return new Promise((resolve) => {
                (0, child_process_1.exec)(`python "${scriptPath}"`, { timeout: 30000, cwd: sessionDir }, (error, stdout, stderr) => {
                    scheduleCleanup();
                    const files = fs_1.default.readdirSync(sessionDir).filter(f => f !== 'script.py');
                    const duration = Date.now() - start;
                    if (error && !stdout) {
                        resolve({ success: false, output: stderr || error.message, error: stderr || error.message, files, duration });
                    }
                    else {
                        resolve({ success: true, output: stdout || '(no output)', files, duration });
                    }
                });
            });
        }
        else {
            const scriptPath = path_1.default.join(sessionDir, 'script.js');
            fs_1.default.writeFileSync(scriptPath, code);
            return new Promise((resolve) => {
                (0, child_process_1.exec)(`node "${scriptPath}"`, { timeout: 30000, cwd: sessionDir }, (error, stdout, stderr) => {
                    scheduleCleanup();
                    const files = fs_1.default.readdirSync(sessionDir).filter(f => f !== 'script.js');
                    const duration = Date.now() - start;
                    if (error && !stdout) {
                        resolve({ success: false, output: stderr || error.message, error: stderr || error.message, files, duration });
                    }
                    else {
                        resolve({ success: true, output: stdout || '(no output)', files, duration });
                    }
                });
            });
        }
    }
    catch (e) {
        scheduleCleanup();
        return { success: false, output: e.message, error: e.message, duration: Date.now() - start };
    }
}
