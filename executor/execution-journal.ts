// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import * as fs from "fs"
import * as path from "path"

export interface JournalEntry {
  timestamp: string
  summary: string
  action: any
  success: boolean
  durationMs?: number
  escalated: boolean
  repaired: boolean
  error?: string
}

export class ExecutionJournal {
  private journalPath: string

  constructor(workspace: string) {
    this.journalPath = path.join(workspace, "execution-log.json")
    if (!fs.existsSync(this.journalPath)) {
      fs.writeFileSync(this.journalPath, JSON.stringify([], null, 2))
    }
  }

  private read(): JournalEntry[] {
    const raw = fs.readFileSync(this.journalPath, "utf-8")
    return JSON.parse(raw)
  }

  private write(entries: JournalEntry[]) {
    fs.writeFileSync(this.journalPath, JSON.stringify(entries, null, 2))
  }

  log(entry: JournalEntry) {
    const entries = this.read()
    entries.push(entry)
    this.write(entries)
  }
}