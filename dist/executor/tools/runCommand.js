"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
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
exports.runCommand = void 0;
const childProcess = __importStar(require("child_process"));
const path = __importStar(require("path"));
const controlKernel_1 = require("../../control/controlKernel");
const DEFAULT_TIMEOUT_MS = 30000;
exports.runCommand = {
    name: "runCommand",
    description: "Execute a shell command in a given working directory",
    async execute(input) {
        // ── Control-kernel validation ─────────────────────────
        const validation = controlKernel_1.controlKernel.validate({ type: "shell_exec", command: input.command }, "tool_runtime");
        if (!validation.approved) {
            return { success: false, error: `Blocked by ControlKernel: ${validation.reason}` };
        }
        const cwd = input.cwd ? path.resolve(input.cwd) : process.cwd();
        const timeout = input.timeout ?? DEFAULT_TIMEOUT_MS;
        try {
            const stdout = childProcess.execSync(input.command, {
                cwd,
                timeout,
                encoding: "utf-8",
                stdio: ["pipe", "pipe", "pipe"],
            });
            return {
                success: true,
                output: { stdout: stdout.trim(), exitCode: 0 },
            };
        }
        catch (err) {
            const stderr = err.stderr?.toString?.()?.trim() ?? err.message;
            return { success: false, error: stderr };
        }
    },
};
