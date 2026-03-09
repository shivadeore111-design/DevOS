// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

import * as fs   from "fs"
import * as path from "path"
import { Tool, ToolResult } from "../toolRuntime"

export const readFile: Tool = {
  name:        "readFile",
  description: "Read contents of a file",

  async execute(input: { path: string }): Promise<ToolResult> {
    try {
      const fullPath = path.resolve(input.path)
      const content  = fs.readFileSync(fullPath, "utf-8")
      return { success: true, output: content }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  },
}
