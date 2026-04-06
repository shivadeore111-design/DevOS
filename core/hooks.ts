// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/hooks.ts — Lightweight hook system for extensibility.
// Allows pre/post processing of messages and tool calls without
// modifying agentLoop internals directly.

export type HookEvent =
  | 'message_received'
  | 'before_tool_call'
  | 'after_tool_call'
  | 'session_start'
  | 'session_end'

export type HookHandler = (data: any) => Promise<any>

const hooks: Map<HookEvent, HookHandler[]> = new Map()

export function registerHook(event: HookEvent, handler: HookHandler): void {
  if (!hooks.has(event)) hooks.set(event, [])
  hooks.get(event)!.push(handler)
}

export async function fireHook(event: HookEvent, data: any): Promise<any> {
  const handlers = hooks.get(event) || []
  let result = data
  for (const handler of handlers) {
    result = (await handler(result)) || result
  }
  return result
}

export function clearHooks(event?: HookEvent): void {
  if (event) hooks.delete(event)
  else hooks.clear()
}

export function hookCount(event?: HookEvent): number {
  if (event) return hooks.get(event)?.length ?? 0
  let total = 0
  hooks.forEach(h => { total += h.length })
  return total
}
