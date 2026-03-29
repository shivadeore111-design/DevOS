// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/workspaceMemory.ts — Per-task file workspace.
// Each task gets an isolated directory for intermediate artifacts.

import fs   from 'fs'
import path from 'path'

export class WorkspaceMemory {
  private taskDir: string

  constructor(taskId: string) {
    this.taskDir = path.join(process.cwd(), 'workspace', 'tasks', taskId)
    fs.mkdirSync(this.taskDir, { recursive: true })
  }

  write(filename: string, content: string): string {
    const filePath = path.join(this.taskDir, filename)
    fs.writeFileSync(filePath, content, 'utf-8')
    return filePath
  }

  read(filename: string): string | null {
    const filePath = path.join(this.taskDir, filename)
    if (!fs.existsSync(filePath)) return null
    return fs.readFileSync(filePath, 'utf-8')
  }

  append(filename: string, content: string): string {
    const filePath = path.join(this.taskDir, filename)
    fs.appendFileSync(filePath, content + '\n', 'utf-8')
    return filePath
  }

  exists(filename: string): boolean {
    return fs.existsSync(path.join(this.taskDir, filename))
  }

  getPath(filename: string): string {
    return path.join(this.taskDir, filename)
  }

  getDir(): string {
    return this.taskDir
  }

  list(): string[] {
    try { return fs.readdirSync(this.taskDir) } catch { return [] }
  }
}
