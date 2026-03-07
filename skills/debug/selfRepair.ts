export interface RepairAttempt {
  attempt: number;
  error: string;
  timestamp: Date;
}

export class SelfRepair {
  public attemptHistory: RepairAttempt[] = [];

  public async execute<T>(
    task: () => Promise<T>,
    options?: {
      maxRetries?: number;
      onFailure?: (error: Error, attempt: number) => Promise<string | void>;
    }
  ): Promise<T> {
    const maxRetries = options?.maxRetries ?? 5;
    this.attemptHistory = [];

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        return await task();
      } catch (error) {
        const normalizedError =
          error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown error");

        lastError = normalizedError;
        this.attemptHistory.push({
          attempt,
          error: normalizedError.message,
          timestamp: new Date()
        });

        console.error(`[SelfRepair] Attempt ${attempt} failed: ${normalizedError.message}`);

        if (options?.onFailure) {
          try {
            const note = await options.onFailure(normalizedError, attempt);
            if (note) {
              console.log(`[SelfRepair] onFailure note (attempt ${attempt}): ${note}`);
            }
          } catch (callbackError) {
            const callbackMessage =
              callbackError instanceof Error ? callbackError.message : String(callbackError);
            console.error(`[SelfRepair] onFailure handler failed: ${callbackMessage}`);
          }
        }

        if (attempt < maxRetries) {
          await this.delay(1000);
        }
      }
    }

    const history = this.attemptHistory
      .map((item) => `#${item.attempt} @ ${item.timestamp.toISOString()} - ${item.error}`)
      .join("; ");

    throw new Error(
      `Task failed after ${maxRetries} attempts. Last error: ${lastError?.message ?? "unknown"}. Attempt history: ${history}`
    );
  }

  private async delay(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
