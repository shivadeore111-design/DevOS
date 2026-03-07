import { execaCommand } from "execa";

export interface TerminalResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  command: string;
}

export class TerminalOperator {
  private static readonly DEFAULT_TIMEOUT_MS = 30_000;

  public async execute(
    command: string,
    options: { timeout?: number; cwd?: string } = {}
  ): Promise<TerminalResult> {
    const timeout = options.timeout ?? TerminalOperator.DEFAULT_TIMEOUT_MS;
    const start = Date.now();

    try {
      const result = await execaCommand(command, {
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
    } catch (error: unknown) {
      const duration = Date.now() - start;
      const execaError = error as {
        timedOut?: boolean;
        shortMessage?: string;
        stderr?: string;
        stdout?: string;
        exitCode?: number;
        message?: string;
      };

      const timedOut = execaError.timedOut === true;
      const timeoutMessage = `Command timed out after ${timeout}ms`;

      console.log(
        `[TerminalOperator] ${command} ${timedOut ? "timed out" : "failed"} in ${duration}ms`
      );

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
