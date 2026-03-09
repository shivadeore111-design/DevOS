// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

import * as fs   from "fs"
import * as path from "path"
import { Tool, ToolResult } from "../toolRuntime"

export const writeFile: Tool = {
  name:        "writeFile",
  description: "Write or append content to a file, creating parent directories as needed",

  async execute(input: { path: string; content: string; append?: boolean }): Promise<ToolResult> {
    try {
      const fullPath = path.resolve(input.path)
      const dir      = path.dirname(fullPath)

      fs.mkdirSync(dir, { recursive: true })

      if (input.append) {
        fs.appendFileSync(fullPath, input.content, "utf-8")
      } else {
        fs.writeFileSync(fullPath, input.content, "utf-8")
      }

      return {
        success: true,
        output:  { path: fullPath, bytes: input.content.length },
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  },
}
