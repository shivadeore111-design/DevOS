// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

import * as fs   from "fs"
import * as path from "path"
import { Tool, ToolResult } from "../toolRuntime"

export const editFile: Tool = {
  name:        "editFile",
  description: "Replace the first occurrence of a string in a file with a new string",

  async execute(input: { path: string; oldStr: string; newStr: string }): Promise<ToolResult> {
    try {
      const fullPath = path.resolve(input.path)
      const original = fs.readFileSync(fullPath, "utf-8")

      if (!original.includes(input.oldStr)) {
        return { success: false, error: "String not found in file" }
      }

      // Replace only the first occurrence
      const updated = original.replace(input.oldStr, input.newStr)
      fs.writeFileSync(fullPath, updated, "utf-8")

      return {
        success: true,
        output:  { path: fullPath, changed: true },
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  },
}
