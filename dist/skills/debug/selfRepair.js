"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelfRepair = void 0;
class SelfRepair {
    constructor() {
        this.attemptHistory = [];
    }
    async execute(task, options) {
        const maxRetries = options?.maxRetries ?? 5;
        this.attemptHistory = [];
        let lastError = null;
        for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
            try {
                return await task();
            }
            catch (error) {
                const normalizedError = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown error");
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
                    }
                    catch (callbackError) {
                        const callbackMessage = callbackError instanceof Error ? callbackError.message : String(callbackError);
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
        throw new Error(`Task failed after ${maxRetries} attempts. Last error: ${lastError?.message ?? "unknown"}. Attempt history: ${history}`);
    }
    async delay(ms) {
        await new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }
}
exports.SelfRepair = SelfRepair;
