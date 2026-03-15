"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.terminal = exports.TerminalOperator = void 0;
// ============================================================
// skills/utils/terminalOperator.ts — Safe terminal command runner
// Wraps Node child_process for use inside DevOS skills.
// No external dependencies — uses Node built-ins only.
// ============================================================
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class TerminalOperator {
    constructor(cwd = process.cwd(), timeoutMs = 60000) {
        this.defaultCwd = cwd;
        this.timeoutMs = timeoutMs;
    }
    /**
     * Run a shell command asynchronously.
     * Returns stdout, stderr, and exit code.
     * Never throws — captures errors in the result object.
     */
    async run(command, cwd) {
        const dir = cwd ?? this.defaultCwd;
        const start = Date.now();
        console.log(`[TerminalOperator] $ ${command}  (cwd: ${dir})`);
        try {
            const { stdout, stderr } = await execAsync(command, {
                cwd: dir,
                timeout: this.timeoutMs,
                env: { ...process.env },
            });
            return {
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                exitCode: 0,
                command,
                durationMs: Date.now() - start,
            };
        }
        catch (err) {
            return {
                stdout: err.stdout?.trim() ?? "",
                stderr: err.stderr?.trim() ?? err.message,
                exitCode: err.code ?? 1,
                command,
                durationMs: Date.now() - start,
            };
        }
    }
    /**
     * Run a shell command synchronously.
     * Throws on non-zero exit code.
     */
    runSync(command, cwd) {
        const dir = cwd ?? this.defaultCwd;
        console.log(`[TerminalOperator] sync $ ${command}  (cwd: ${dir})`);
        return (0, child_process_1.execSync)(command, { cwd: dir, encoding: "utf-8", timeout: this.timeoutMs }).trim();
    }
    /**
     * Run a sequence of commands, stopping on first failure.
     */
    async runSequence(commands, cwd) {
        const results = [];
        for (const cmd of commands) {
            const result = await this.run(cmd, cwd);
            results.push(result);
            if (result.exitCode !== 0) {
                console.error(`[TerminalOperator] Sequence aborted after: ${cmd}`);
                break;
            }
        }
        return results;
    }
    /**
     * Check whether a CLI tool is available in PATH.
     */
    isAvailable(tool) {
        try {
            (0, child_process_1.execSync)(`which ${tool}`, { stdio: "ignore" });
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.TerminalOperator = TerminalOperator;
/** Default singleton terminal operator rooted at CWD. */
exports.terminal = new TerminalOperator();
