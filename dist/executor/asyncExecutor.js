"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncExecutor = exports.AsyncExecutor = void 0;
// executor/asyncExecutor.ts — Concurrency utilities for parallel action execution
class AsyncExecutor {
    constructor() {
        this.defaultConcurrency = 3;
    }
    /** Run all tasks concurrently, collect results (or errors) */
    async runParallel(tasks) {
        return Promise.all(tasks.map(t => t()));
    }
    /**
     * Run tasks with a maximum of `concurrency` running at once.
     * Preserves result order (matches input order).
     */
    async runParallelLimited(tasks, concurrency = this.defaultConcurrency) {
        if (tasks.length === 0)
            return [];
        const results = new Array(tasks.length);
        let nextIndex = 0;
        async function worker() {
            while (nextIndex < tasks.length) {
                const i = nextIndex++;
                try {
                    results[i] = await tasks[i]();
                }
                catch (err) {
                    results[i] = { error: err };
                }
            }
        }
        const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, worker);
        await Promise.all(workers);
        return results;
    }
    /**
     * Run a single task, rejecting with a timeout error if it takes too long.
     */
    async runWithTimeout(task, timeoutMs) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Task timed out after ${timeoutMs}ms`));
            }, timeoutMs);
            task()
                .then(result => { clearTimeout(timer); resolve(result); })
                .catch(err => { clearTimeout(timer); reject(err); });
        });
    }
}
exports.AsyncExecutor = AsyncExecutor;
exports.asyncExecutor = new AsyncExecutor();
