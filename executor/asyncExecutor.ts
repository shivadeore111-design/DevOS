// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// executor/asyncExecutor.ts — Concurrency utilities for parallel action execution

export class AsyncExecutor {
  readonly defaultConcurrency = 3

  /** Run all tasks concurrently, collect results (or errors) */
  async runParallel(tasks: Array<() => Promise<any>>): Promise<any[]> {
    return Promise.all(tasks.map(t => t()))
  }

  /**
   * Run tasks with a maximum of `concurrency` running at once.
   * Preserves result order (matches input order).
   */
  async runParallelLimited(
    tasks:       Array<() => Promise<any>>,
    concurrency: number = this.defaultConcurrency,
  ): Promise<any[]> {
    if (tasks.length === 0) return []

    const results: any[]  = new Array(tasks.length)
    let   nextIndex = 0

    async function worker(): Promise<void> {
      while (nextIndex < tasks.length) {
        const i = nextIndex++
        try {
          results[i] = await tasks[i]()
        } catch (err) {
          results[i] = { error: err }
        }
      }
    }

    const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, worker)
    await Promise.all(workers)
    return results
  }

  /**
   * Run a single task, rejecting with a timeout error if it takes too long.
   */
  async runWithTimeout<T>(task: () => Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Task timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      task()
        .then(result => { clearTimeout(timer); resolve(result) })
        .catch(err   => { clearTimeout(timer); reject(err)     })
    })
  }
}

export const asyncExecutor = new AsyncExecutor()
