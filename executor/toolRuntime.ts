// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// executor/toolRuntime.ts — Central registry and executor for all DevOS tools.

export interface Tool {
  name:        string
  description: string
  execute(input: any): Promise<ToolResult>
}

export interface ToolResult {
  success: boolean
  output?: any
  error?:  string
}

export class ToolRuntime {

  private registry = new Map<string, Tool>()

  constructor() {
    // Register built-in tools lazily to avoid circular-dependency issues
    // (the tool files import Tool/ToolResult types from this module).
    this._registerBuiltins()
  }

  /** Register a tool. Overwrites any existing registration with the same name. */
  register(tool: Tool): void {
    this.registry.set(tool.name, tool)
  }

  /** Returns the named tool or null if not registered. */
  get(name: string): Tool | null {
    return this.registry.get(name) ?? null
  }

  /** Execute a tool by name, applying hooks and logging. */
  async execute(name: string, input: any): Promise<ToolResult> {
    const tool = this.registry.get(name)
    if (!tool) {
      const err: ToolResult = { success: false, error: `Tool not found: ${name}` }
      console.error(`[ToolRuntime] ❌ Unknown tool: ${name}`)
      return err
    }

    console.log(`[ToolRuntime] Executing: ${name}`)
    try {
      const result = await tool.execute(input)
      if (result.success) {
        console.log(`[ToolRuntime] ✅ ${name}`)
      } else {
        console.error(`[ToolRuntime] ❌ ${name}: ${result.error ?? "unknown error"}`)
      }
      return result
    } catch (err: any) {
      const result: ToolResult = { success: false, error: err.message }
      console.error(`[ToolRuntime] ❌ ${name}: ${err.message}`)
      return result
    }
  }

  /** Returns all registered tools. */
  list(): Tool[] {
    return Array.from(this.registry.values())
  }

  // ── Private ───────────────────────────────────────────────

  private _registerBuiltins(): void {
    try {
      const { readFile }   = require("./tools/readFile")
      const { writeFile }  = require("./tools/writeFile")
      const { editFile }   = require("./tools/editFile")
      const { runCommand } = require("./tools/runCommand")

      this.register(readFile)
      this.register(writeFile)
      this.register(editFile)
      this.register(runCommand)
    } catch (err: any) {
      console.warn(`[ToolRuntime] Could not register built-in tools: ${err.message}`)
    }
  }
}

export const toolRuntime = new ToolRuntime()
