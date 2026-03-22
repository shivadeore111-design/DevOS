"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerminalOperator = void 0;
const execa_1 = require("execa");
class TerminalOperator {
    async execute(command, options = {}) {
        const timeout = options.timeout ?? TerminalOperator.DEFAULT_TIMEOUT_MS;
        const start = Date.now();
        try {
            const result = await (0, execa_1.execaCommand)(command, {
                cwd: options.cwd,
                timeout,
                reject: true,
                shell: true
            });
            const duration = Date.now() - start;
            console.log(`[TerminalOperator] ${command} completed in ${duration}ms`);
            return {
                success: true,
                stdout: result.stdout ?? "",
                stderr: result.stderr ?? "",
                exitCode: result.exitCode ?? 0,
                duration,
                command
            };
        }
        catch (error) {
            const duration = Date.now() - start;
            const execaError = error;
            const timedOut = execaError.timedOut === true;
            const timeoutMessage = `Command timed out after ${timeout}ms`;
            console.log(`[TerminalOperator] ${command} ${timedOut ? "timed out" : "failed"} in ${duration}ms`);
            return {
                success: false,
                stdout: execaError.stdout ?? "",
                stderr: timedOut
                    ? `${timeoutMessage}${execaError.stderr ? `\n${execaError.stderr}` : ""}`
                    : execaError.stderr ?? execaError.shortMessage ?? execaError.message ?? "Unknown error",
                exitCode: execaError.exitCode ?? (timedOut ? 124 : 1),
                duration,
                command
            };
        }
    }
}
exports.TerminalOperator = TerminalOperator;
TerminalOperator.DEFAULT_TIMEOUT_MS = 30000;
