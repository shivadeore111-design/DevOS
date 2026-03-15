"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeShellAction = executeShellAction;
// ============================================================
// DevOS - Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const net = __importStar(require("net"));
const execa_1 = require("execa");
const os_adapter_1 = require("../os-adapter");
const processSupervisor_1 = require("../../devos/runtime/processSupervisor");
// ── Port conflict detection ───────────────────────────────
function isPortInUse(port) {
    return new Promise(resolve => {
        const s = net.createConnection(port, "127.0.0.1");
        s.once("connect", () => { s.destroy(); resolve(true); });
        s.once("error", () => { s.destroy(); resolve(false); });
    });
}
function extractPort(command) {
    // Match patterns: PORT=3000, -p 3000, :3000, standalone 4-digit port numbers
    const patterns = [
        /PORT[=\s]+(\d{4,5})/i,
        /-p\s+(\d{4,5})/i,
        /:(\d{4,5})\b/,
        /\b(3000|3001|4000|4200|5000|8000|8080|8888)\b/,
    ];
    for (const re of patterns) {
        const m = command.match(re);
        if (m)
            return parseInt(m[1], 10);
    }
    return 3000; // default
}
const BLOCKED_PATTERNS = [
    "rm -rf /",
    "del /f /s /q c:\\",
    "format c:",
    "shutdown",
    ":(){ :|:& };:",
];
async function executeShellAction(action, workspace, goalId) {
    const command = action.command;
    if (!command)
        return { success: false, error: "No command provided" };
    for (const blocked of BLOCKED_PATTERNS) {
        if (command.toLowerCase().includes(blocked.toLowerCase())) {
            return { success: false, error: `Blocked command pattern: "${blocked}"` };
        }
    }
    if (action.risk === "high") {
        return { success: false, error: "High-risk shell commands require OpenClaw escalation" };
    }
    const { shell, flag } = (0, os_adapter_1.getRuntimeShell)();
    const sandboxCwd = path_1.default.join(workspace, "sandbox");
    const cwd = path_1.default.basename(workspace) === "sandbox"
        ? workspace
        : (fs_1.default.existsSync(sandboxCwd) ? sandboxCwd : workspace);
    console.log(`[ShellActions] Executing: ${command}`);
    const serverPatterns = ["node server", "npm start", "python app", "flask run"];
    const isServerCmd = serverPatterns.some(p => command.toLowerCase().includes(p));
    if (isServerCmd) {
        // ── Port conflict check ─────────────────────────────
        const port = extractPort(command);
        const inUse = await isPortInUse(port);
        if (inUse) {
            console.log(`[ShellActions] Port ${port} already in use — server may already be running`);
            return { success: true, output: { stdout: `Port ${port} already in use — skipping spawn`, stderr: "", exitCode: 0 } };
        }
        const proc = require("child_process").spawn(shell, [flag, command], {
            cwd, detached: true, stdio: "ignore",
        });
        proc.unref();
        // Register with process supervisor so it can be killed later
        if (proc.pid !== undefined && goalId) {
            processSupervisor_1.processSupervisor.register(proc.pid, command, goalId);
        }
        await new Promise(r => setTimeout(r, 3000));
        const alive = (() => {
            try {
                process.kill(proc.pid, 0);
                return true;
            }
            catch {
                return false;
            }
        })();
        if (!alive) {
            // Port may have come up even if PID check failed (process detached)
            const portUp = await isPortInUse(port);
            if (portUp) {
                return { success: true, output: { stdout: `Server listening on port ${port}`, stderr: "", exitCode: 0 } };
            }
            return { success: false, error: "Server process exited immediately" };
        }
        return { success: true, output: { stdout: "Server started in background", stderr: "", exitCode: 0 } };
    }
    try {
        const result = await (0, execa_1.execa)(shell, [flag, command], {
            cwd,
            timeout: 30000,
            reject: false,
        });
        const exitCode = result.exitCode ?? (result.stdout && !result.stderr ? 0 : 1);
        const success = exitCode === 0;
        console.log(`[ShellActions] Exit ${exitCode}: ${command}`);
        return {
            success,
            output: { stdout: result.stdout, stderr: result.stderr, exitCode },
            error: success ? undefined : `Exit ${exitCode}: ${result.stderr}`,
        };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
