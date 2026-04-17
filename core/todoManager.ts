// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
//
// core/todoManager.ts — Per-session in-memory task list.
//
// Intentionally ephemeral: todos reset on process restart.
// Use aiden.todo.* or the /todo CLI command to manage items.

export interface TodoItem {
  id:        string
  text:      string
  done:      boolean
  priority:  'low' | 'normal' | 'high'
  createdAt: string
  doneAt?:   string
}

let todos: TodoItem[] = []
let seq = 1

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function addTodo(
  text:     string,
  priority: TodoItem['priority'] = 'normal',
): TodoItem {
  const item: TodoItem = {
    id:        String(seq++),
    text:      text.trim(),
    done:      false,
    priority,
    createdAt: new Date().toISOString(),
  }
  todos.push(item)
  return item
}

export function completeTodo(id: string): TodoItem | null {
  const item = todos.find(t => t.id === id)
  if (!item) return null
  item.done   = true
  item.doneAt = new Date().toISOString()
  return item
}

export function removeTodo(id: string): boolean {
  const before = todos.length
  todos = todos.filter(t => t.id !== id)
  return todos.length < before
}

export function clearTodos(): number {
  const count = todos.length
  todos = []
  return count
}

export function listTodos(filter: 'all' | 'pending' | 'done' = 'all'): TodoItem[] {
  if (filter === 'done')    return todos.filter(t =>  t.done)
  if (filter === 'pending') return todos.filter(t => !t.done)
  return [...todos]
}

export function getTodo(id: string): TodoItem | undefined {
  return todos.find(t => t.id === id)
}

// ── Formatting helper ─────────────────────────────────────────────────────────

export function formatTodoList(items: TodoItem[]): string {
  if (!items.length) return 'No items.'
  return items.map(t => {
    const status = t.done ? '✓' : '○'
    const pri    = t.priority !== 'normal' ? ` [${t.priority}]` : ''
    return `[${t.id}] ${status}${pri} ${t.text}`
  }).join('\n')
}
