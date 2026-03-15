"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
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
exports.OpenClawAdapter = void 0;
// openclaw/openclaw-adapter.ts
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class OpenClawAdapter {
    constructor() {
        this.timeoutMs = 60000;
    }
    async executeEscalation(action, workspace) {
        try {
            console.log("⚡ OpenClaw Escalation Triggered");
            switch (action.type) {
                case "file_create":
                    return this.handleFileCreate(action, workspace);
                case "shell":
                    return this.executeShellCommand(action.command, workspace);
                case "shell_plan":
                    return this.executeShellPlan(action.commands, workspace);
                default:
                    return {
                        success: false,
                        error: `Unsupported escalation type: ${action.type}`
                    };
            }
        }
        catch (err) {
            return {
                success: false,
                error: err.message
            };
        }
    }
    // ================================
    // FILE CREATE (Controlled)
    // ================================
    async handleFileCreate(action, workspace) {
        const fullPath = path.join(workspace, action.path);
        this.assertPathInsideWorkspace(fullPath, workspace);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, action.content || "");
        return {
            success: true,
            output: "File created via OpenClaw",
            artifacts: [fullPath]
        };
    }
    // ================================
    // SINGLE SHELL EXECUTION
    // ================================
    async executeShellCommand(command, workspace) {
        this.assertSafeCommand(command);
        return new Promise((resolve) => {
            const start = Date.now();
            const child = (0, child_process_1.spawn)(command, {
                shell: true,
                cwd: workspace,
                windowsHide: true
            });
            let stdout = "";
            let stderr = "";
            let killedByTimeout = false;
            const timeout = setTimeout(() => {
                killedByTimeout = true;
                child.kill("SIGKILL");
            }, this.timeoutMs);
            child.stdout.on("data", (data) => {
                stdout += data.toString();
            });
            child.stderr.on("data", (data) => {
                stderr += data.toString();
            });
            child.on("close", (code) => {
                clearTimeout(timeout);
                const durationMs = Date.now() - start;
                resolve({
                    success: !killedByTimeout && code === 0,
                    output: stdout.trim(),
                    error: stderr.trim() || undefined,
                    exitCode: code ?? -1,
                    durationMs
                });
            });
        });
    }
    // ================================
    // MULTI-COMMAND PLAN EXECUTION
    // ================================
    async executeShellPlan(commands, workspace) {
        const artifacts = [];
        const start = Date.now();
        for (const command of commands) {
            const result = await this.executeShellCommand(command, workspace);
            if (!result.success) {
                return {
                    success: false,
                    error: `Plan failed at command: ${command}\n${result.error || ""}`,
                    durationMs: Date.now() - start
                };
            }
            artifacts.push(`executed: ${command}`);
        }
        return {
            success: true,
            output: "Shell plan executed successfully",
            artifacts,
            durationMs: Date.now() - start
        };
    }
    // ================================
    // SAFETY LAYERS
    // ================================
    assertSafeCommand(command) {
        const blockedPatterns = [
            /rm\s+-rf\s+\//i,
            /rm\s+-rf\s+\*/i,
            /format\s+/i,
            /shutdown/i,
            /reboot/i,
            /del\s+\/f/i,
            /rmdir\s+\/s/i,
            /:\(\)\{:\|\:&\};:/ // fork bomb
        ];
        for (const pattern of blockedPatterns) {
            if (pattern.test(command)) {
                throw new Error(`Blocked dangerous command: ${command}`);
            }
        }
    }
    assertPathInsideWorkspace(fullPath, workspace) {
        const resolvedWorkspace = path.resolve(workspace);
        const resolvedPath = path.resolve(fullPath);
        if (!resolvedPath.startsWith(resolvedWorkspace)) {
            throw new Error("Path escape attempt detected");
        }
    }
}
exports.OpenClawAdapter = OpenClawAdapter;
