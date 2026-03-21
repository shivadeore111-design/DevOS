// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// core/taskPulse.ts — Background task ingestion from TASKPULSE.md
//
// Agents and users drop tasks into workspace/TASKPULSE.md as
//   - [ ] do something
// The heartbeat calls processTasks() every 5 minutes.
// Completed tasks are moved to the Done section with a timestamp.

import * as fs   from "fs"
import * as path from "path"

const TASKPULSE_PATH = path.join(process.cwd(), "workspace", "TASKPULSE.md")

export interface PulseTask {
  text:    string
  lineIdx: number   // original line index in the file (for in-place tick)
}

export class TaskPulse {

  // ── Public API ─────────────────────────────────────────────

  /** Parse all unchecked `- [ ]` items from TASKPULSE.md */
  readTasks(): PulseTask[] {
    if (!fs.existsSync(TASKPULSE_PATH)) return []
    const lines = fs.readFileSync(TASKPULSE_PATH, "utf-8").split("\n")
    const tasks: PulseTask[] = []
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^- \[ \] (.+)$/)
      if (m) {
        tasks.push({ text: m[1].trim(), lineIdx: i })
      }
    }
    return tasks
  }

  /** Mark a task done: replace `- [ ]` → `- [x]`, move line to Done section */
  tickTask(text: string): void {
    if (!fs.existsSync(TASKPULSE_PATH)) return
    let content = fs.readFileSync(TASKPULSE_PATH, "utf-8")
    const lines = content.split("\n")

    // Find and remove the pending line
    const idx = lines.findIndex(l => l.trim() === `- [ ] ${text}`)
    if (idx === -1) return

    lines.splice(idx, 1)

    // Add ticked entry to Done section
    const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ")
    const doneLine  = `- [x] ${text}  _(done ${timestamp})_`

    const doneIdx = lines.findIndex(l => l.trim() === "## Done")
    if (doneIdx !== -1) {
      lines.splice(doneIdx + 1, 0, doneLine)
    } else {
      lines.push("", "## Done", doneLine)
    }

    fs.writeFileSync(TASKPULSE_PATH, lines.join("\n"), "utf-8")
    console.log(`[TaskPulse] ✅ Ticked: "${text}"`)
  }

  /** Append a new task to the Pending section */
  addTask(text: string): void {
    if (!fs.existsSync(TASKPULSE_PATH)) {
      // Create file with minimal structure
      const dir = path.dirname(TASKPULSE_PATH)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(TASKPULSE_PATH, [
        "# DevOS TaskPulse",
        "# Add tasks here — one per line starting with - [ ]",
        "# DevOS picks them up every 5 minutes automatically",
        "",
        "## Pending",
        `- [ ] ${text}`,
        "",
        "## Done",
      ].join("\n"), "utf-8")
      console.log(`[TaskPulse] Created TASKPULSE.md with: "${text}"`)
      return
    }

    const content = fs.readFileSync(TASKPULSE_PATH, "utf-8")
    const lines   = content.split("\n")

    // Insert after ## Pending header
    const pendingIdx = lines.findIndex(l => l.trim() === "## Pending")
    if (pendingIdx !== -1) {
      lines.splice(pendingIdx + 1, 0, `- [ ] ${text}`)
    } else {
      lines.push(`- [ ] ${text}`)
    }

    fs.writeFileSync(TASKPULSE_PATH, lines.join("\n"), "utf-8")
    console.log(`[TaskPulse] Added task: "${text}"`)
  }

  /**
   * Read all pending tasks, run each through the Runner, tick on completion.
   * Called by Heartbeat every 60 ticks (5 minutes).
   */
  async processTasks(): Promise<void> {
    const tasks = this.readTasks()

    // Skip the placeholder example task
    const real = tasks.filter(t => !t.text.startsWith("example:"))

    console.log(`[TaskPulse] Checking TASKPULSE.md — ${real.length} task${real.length !== 1 ? "s" : ""} pending`)

    if (real.length === 0) return

    // Lazy-require Runner to avoid circular boot issues
    const { Runner }     = require("./runner") as typeof import("./runner")
    const { DevOSEngine } = require("../executor/engine") as typeof import("../executor/engine")

    const ws     = path.join(process.cwd(), "workspace", "sandbox")
    if (!fs.existsSync(ws)) fs.mkdirSync(ws, { recursive: true })

    for (const task of real) {
      console.log(`[TaskPulse] ▶ Running: "${task.text}"`)
      try {
        const engine = new DevOSEngine(ws, false)
        const runner = new Runner({ agentId: `taskpulse-${Date.now()}`, engine, autoApprove: true })
        const result = await runner.runOnce(task.text)
        if (result.status === "completed") {
          this.tickTask(task.text)
        } else {
          console.warn(`[TaskPulse] ❌ Task failed: "${task.text}" — ${(result as any).error ?? "unknown"}`)
        }
      } catch (err: any) {
        console.error(`[TaskPulse] ❌ Exception on "${task.text}": ${err.message}`)
      }
    }
  }
}

export const taskPulse = new TaskPulse()
