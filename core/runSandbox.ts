// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/runSandbox.ts — Node.js VM-based sandbox for the ▲ run tool.
//
// Injects the Aiden SDK (`aiden` namespace) into a fresh VM context.
// All tool calls are tracked. Timeout and max-tool-call limits enforced.
// No new dependencies — uses built-in `vm` module only.

import { createContext, runInContext, Script } from 'vm'
import { buildSdkRuntime } from './aidenSdk'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ToolCall {
  tool:       string
  args:       any
  durationMs: number
}

export interface RunResult {
  success:   boolean
  output:    string[]   // captured console.log lines
  result?:   any        // final evaluated value
  error?:    string
  toolCalls: ToolCall[]
  durationMs: number
}

// ── Sandbox ───────────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT       = 30_000   // 30 s
const DEFAULT_MAX_TOOL_CALLS = 20

export async function runInSandbox(
  code:    string,
  options: { timeout?: number; maxToolCalls?: number } = {},
): Promise<RunResult> {
  const timeout      = options.timeout      ?? DEFAULT_TIMEOUT
  const maxToolCalls = options.maxToolCalls ?? DEFAULT_MAX_TOOL_CALLS

  const start      = Date.now()
  const outputLog: string[] = []
  const toolCalls:  ToolCall[] = []

  // ── Build SDK runtime with tracking ───────────────────────────────────────
  const sdk = buildSdkRuntime((toolName, args) => {
    if (toolCalls.length >= maxToolCalls) {
      throw new Error(`Tool call limit exceeded (max ${maxToolCalls}). Aborting.`)
    }
    const callStart = Date.now()
    // We push after the fact — duration set to 0 here, patched in wrapper below
    toolCalls.push({ tool: toolName, args, durationMs: 0 })
    const idx = toolCalls.length - 1
    // Patch the duration after the call completes (via a post-hook approach)
    const origTime = callStart
    // We'll update durationMs via the wrapper in makeTrackedSdk
    void origTime  // suppress unused warning; timing done differently below
    void idx
  })

  // ── Patch SDK to record timing per-call ───────────────────────────────────
  const trackedSdk = patchSdkTiming(sdk, toolCalls, maxToolCalls)

  // ── Sandboxed console ─────────────────────────────────────────────────────
  const sandboxConsole = {
    log:   (...a: any[]) => outputLog.push(a.map(String).join(' ')),
    warn:  (...a: any[]) => outputLog.push('[warn] ' + a.map(String).join(' ')),
    error: (...a: any[]) => outputLog.push('[error] ' + a.map(String).join(' ')),
    info:  (...a: any[]) => outputLog.push(a.map(String).join(' ')),
  }

  // ── VM context — minimal globals ─────────────────────────────────────────
  const ctx = createContext({
    aiden:   trackedSdk,
    console: sandboxConsole,
    JSON,
    Math,
    Date,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    String,
    Number,
    Boolean,
    Array,
    Object,
    Promise,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  })

  // ── Wrap user code in async IIFE ─────────────────────────────────────────
  const wrappedCode = `
(async () => {
  ${code}
})()
`

  try {
    const script    = new Script(wrappedCode)
    const resultPromise = script.runInContext(ctx, { timeout: Math.min(timeout, 5000) }) as Promise<any>
    // The script.runInContext timeout only applies to sync execution.
    // For async, we race with a wall-clock timeout.
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Sandbox timeout after ${timeout}ms`)), timeout)
    )
    const finalValue = await Promise.race([resultPromise, timeoutPromise])
    return {
      success:    true,
      output:     outputLog,
      result:     finalValue,
      toolCalls,
      durationMs: Date.now() - start,
    }
  } catch (err: any) {
    return {
      success:    false,
      output:     outputLog,
      error:      err?.message ?? String(err),
      toolCalls,
      durationMs: Date.now() - start,
    }
  }
}

// ── Timing patcher ────────────────────────────────────────────────────────────

/**
 * Walks the SDK object tree and wraps every async function to record
 * actual call duration in the toolCalls array.
 */
function patchSdkTiming(
  sdkNode:      any,
  toolCalls:    ToolCall[],
  maxToolCalls: number,
): any {
  if (typeof sdkNode === 'function') {
    return async (...args: any[]) => {
      if (toolCalls.length >= maxToolCalls) {
        throw new Error(`Tool call limit exceeded (max ${maxToolCalls}). Aborting.`)
      }
      const t0  = Date.now()
      try {
        return await sdkNode(...args)
      } finally {
        // Find the last entry that was pushed by the inner onToolCall handler
        const last = toolCalls[toolCalls.length - 1]
        if (last) last.durationMs = Date.now() - t0
      }
    }
  }
  if (typeof sdkNode === 'object' && sdkNode !== null) {
    const patched: any = {}
    for (const [k, v] of Object.entries(sdkNode)) {
      patched[k] = patchSdkTiming(v, toolCalls, maxToolCalls)
    }
    return patched
  }
  return sdkNode
}
