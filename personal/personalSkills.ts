// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// personal/personalSkills.ts — Lightweight wrappers around existing infrastructure

import { researchEngine } from '../research/researchEngine'
import { knowledgeStore } from '../knowledge/knowledgeStore'
import { wrapWithPersona } from '../personality/devosPersonality'

export async function research(query: string): Promise<string> {
  // Use existing researchEngine if available, fallback to knowledge query
  try {
    const result = await researchEngine.research(query)
    return typeof result === 'string' ? result : JSON.stringify(result)
  } catch {
    return 'Research unavailable — Ollama may be offline'
  }
}

export async function createTask(title: string, dueDate?: string): Promise<string> {
  const fs = require('fs')
  const path = require('path')
  const filePath = path.join(process.cwd(), 'workspace/personal-tasks.json')
  const tasks = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf-8')) : []
  const task = { id: require('crypto').randomUUID(), title, dueDate, status: 'pending', createdAt: new Date().toISOString() }
  tasks.push(task)
  fs.writeFileSync(filePath, JSON.stringify(tasks, null, 2))
  return 'Task created: ' + title
}

export async function listTasks(): Promise<string> {
  const fs = require('fs')
  const path = require('path')
  const filePath = path.join(process.cwd(), 'workspace/personal-tasks.json')
  if (!fs.existsSync(filePath)) return 'No tasks yet.'
  const tasks = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  if (tasks.length === 0) return 'No tasks yet.'
  return tasks.map((t: any) => `${t.status === 'done' ? '✅' : '⏳'} ${t.title}${t.dueDate ? ' (due: ' + t.dueDate + ')' : ''}`).join('\n')
}

export async function completeTask(id: string): Promise<string> {
  const fs = require('fs')
  const path = require('path')
  const filePath = path.join(process.cwd(), 'workspace/personal-tasks.json')
  if (!fs.existsSync(filePath)) return 'No tasks found.'
  const tasks = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  const task = tasks.find((t: any) => t.id === id || t.title.toLowerCase().includes(id.toLowerCase()))
  if (!task) return 'Task not found: ' + id
  task.status = 'done'
  fs.writeFileSync(filePath, JSON.stringify(tasks, null, 2))
  return 'Done: ' + task.title
}

export async function generateContent(type: string, brief: string): Promise<string> {
  const { system, user } = wrapWithPersona(`Generate a ${type} based on this brief: ${brief}. Be concise and professional.`)
  // Call Ollama directly
  const http = require('http')
  return new Promise((resolve) => {
    const body = JSON.stringify({ model: 'mistral-nemo:12b', prompt: user, system, stream: false })
    const req = http.request({ hostname: 'localhost', port: 11434, path: '/api/generate', method: 'POST' }, (res: any) => {
      let data = ''
      res.on('data', (c: any) => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data).response || 'No response') } catch { resolve('Generation failed') }
      })
    })
    req.on('error', () => resolve('Ollama offline'))
    req.write(body)
    req.end()
  })
}
