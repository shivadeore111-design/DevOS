// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// coordination/missionTodo.ts — Mission progress as a markdown TODO file

import * as fs   from 'fs'
import * as path from 'path'

export interface TodoItem {
  title: string
  agent: string
  done:  boolean
}

class MissionTodo {
  private todoPath(missionId: string): string {
    return path.join(process.cwd(), 'workspace', 'missions', missionId, 'todo.md')
  }

  createTodo(missionId: string, goal: string, tasks: TodoItem[]): void {
    const dir = path.dirname(this.todoPath(missionId))
    fs.mkdirSync(dir, { recursive: true })

    const taskLines = tasks
      .map(t => `- [${t.done ? 'x' : ' '}] [${t.agent}] ${t.title}`)
      .join('\n')

    const content = `# Mission: ${goal}\n## Tasks\n${taskLines}\n`
    fs.writeFileSync(this.todoPath(missionId), content, 'utf-8')
  }

  tickTask(missionId: string, taskTitle: string): void {
    const filePath = this.todoPath(missionId)
    if (!fs.existsSync(filePath)) return

    const lines = fs.readFileSync(filePath, 'utf-8').split('\n')
    const updated = lines.map(line => {
      if (line.includes(`] ${taskTitle}`) && line.includes('[ ]')) {
        return line.replace('[ ]', '[x]')
      }
      return line
    })
    fs.writeFileSync(filePath, updated.join('\n'), 'utf-8')
  }

  readTodo(missionId: string): string {
    const filePath = this.todoPath(missionId)
    if (!fs.existsSync(filePath)) return ''
    return fs.readFileSync(filePath, 'utf-8')
  }

  getProgress(missionId: string): { total: number; done: number } {
    const content = this.readTodo(missionId)
    const done  = (content.match(/\[x\]/g) ?? []).length
    const total = done + (content.match(/\[ \]/g) ?? []).length
    return { total, done }
  }
}

export const missionTodo = new MissionTodo()
