// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import * as fs from "fs"
import * as path from "path"

interface ErrorMemoryEntry {
  errorPattern: string
  fixAction: any
  successCount: number
}

export class ErrorMemory {
  private memoryPath: string
  private memory: ErrorMemoryEntry[] = []

  constructor(workspace: string) {
    this.memoryPath = path.join(workspace, "error-memory.json")
    this.load()
  }

  private load() {
    if (fs.existsSync(this.memoryPath)) {
      const raw = fs.readFileSync(this.memoryPath, "utf-8")
      this.memory = JSON.parse(raw)
    }
  }

  private save() {
    fs.writeFileSync(this.memoryPath, JSON.stringify(this.memory, null, 2))
  }

  findFix(errorOutput: string): any | null {
    for (const entry of this.memory) {
      if (errorOutput.includes(entry.errorPattern)) {
        return entry.fixAction
      }
    }
    return null
  }

  storeFix(errorOutput: string, fixAction: any) {
    const simplified = this.simplifyError(errorOutput)

    const existing = this.memory.find(
      (e) => e.errorPattern === simplified
    )

    if (existing) {
      existing.successCount += 1
    } else {
      this.memory.push({
        errorPattern: simplified,
        fixAction,
        successCount: 1
      })
    }

    this.save()
  }

  private simplifyError(errorOutput: string): string {
    return errorOutput
      .split("\n")[0]
      .trim()
      .slice(0, 200)
  }
}