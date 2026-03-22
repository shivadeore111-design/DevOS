'use client'
import { useEffect, useState } from 'react'

const API = process.env.NEXT_PUBLIC_DEVOS_API || 'http://localhost:4200'

interface Task {
  id: string
  title: string
  status: 'pending' | 'running' | 'done' | 'failed' | 'completed' | 'active' | 'error'
  projectId?: string
  result?: string
  error?: string
}

interface Project {
  id: string
  title: string
}

interface GoalData {
  goal?: { id: string; title: string; status: string }
  projects?: Project[]
  tasks?: Task[]
  status?: string
  title?: string
}

// ── Status → pill style ────────────────────────────────────────────────────
const TASK_STYLE: Record<string, { bg: string; color: string }> = {
  pending:   { bg: 'rgba(107,114,128,0.25)',  color: '#9ca3af' },   // gray
  running:   { bg: 'rgba(234,179,8,0.25)',     color: '#fbbf24' },   // yellow
  active:    { bg: 'rgba(234,179,8,0.25)',     color: '#fbbf24' },   // yellow
  done:      { bg: 'rgba(34,197,94,0.25)',     color: '#4ade80' },   // green
  completed: { bg: 'rgba(34,197,94,0.25)',     color: '#4ade80' },   // green
  failed:    { bg: 'rgba(239,68,68,0.25)',     color: '#f87171' },   // red
  error:     { bg: 'rgba(239,68,68,0.25)',     color: '#f87171' },   // red
}

function isRunning(data: GoalData): boolean {
  const runningStatuses = new Set(['running', 'active', 'pending'])
  if (data.goal?.status && runningStatuses.has(data.goal.status)) return true
  if (data.status && runningStatuses.has(data.status)) return true
  return (data.tasks || []).some(t => runningStatuses.has(t.status))
}

export function MissionCard({ goalId }: { goalId: string }) {
  const [data, setData]       = useState<GoalData | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [selected, setSelected] = useState<Task | null>(null)

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>

    const load = async () => {
      try {
        const d: GoalData = await fetch(`${API}/api/goals/v2/${goalId}`).then(r => r.json())
        setData(d)
        // Stop polling once all tasks are terminal
        if (!isRunning(d)) {
          clearInterval(interval)
        }
      } catch { /* ignore */ }
    }

    load()
    interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  }, [goalId])

  if (!data) {
    return (
      <div className="mt-2 p-3 rounded-2xl text-xs"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-indigo-400"
            style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
          <span style={{ color: 'rgba(255,255,255,0.4)' }}>Loading goal…</span>
        </div>
      </div>
    )
  }

  const title    = data.goal?.title || data.title || goalId
  const projects = data.projects || []
  const tasks    = data.tasks    || []
  const status   = data.goal?.status || data.status || 'pending'
  const running  = isRunning(data)

  const doneCount = tasks.filter(t => t.status === 'done' || t.status === 'completed').length
  const totalCount = tasks.length

  const goalStyle = TASK_STYLE[status] || TASK_STYLE.pending

  return (
    <div className="mt-2 rounded-2xl overflow-hidden"
      style={{ border: '1px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.05)' }}>

      {/* Header */}
      <button
        className="w-full px-4 py-3 flex items-center justify-between text-left"
        onClick={() => setExpanded(e => !e)}>
        <div className="flex items-center space-x-2 min-w-0">
          {running && (
            <div className="w-2 h-2 rounded-full bg-yellow-400 shrink-0"
              style={{ animation: 'pulse 1.2s ease-in-out infinite' }} />
          )}
          <span className="text-sm font-semibold text-white truncate">{title}</span>
        </div>
        <div className="flex items-center space-x-2 shrink-0 ml-2">
          {totalCount > 0 && (
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {doneCount}/{totalCount}
            </span>
          )}
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: goalStyle.bg, color: goalStyle.color }}>
            {status}
          </span>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          {/* Progress bar */}
          {totalCount > 0 && (
            <div className="mb-3 h-1.5 rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.round((doneCount / totalCount) * 100)}%`,
                  background: 'linear-gradient(90deg, #6366f1, #22c55e)'
                }} />
            </div>
          )}

          {/* Project blocks → task pills */}
          {projects.length > 0 ? (
            <div className="space-y-3">
              {projects.map(p => {
                const projectTasks = tasks.filter(t => t.projectId === p.id)
                return (
                  <div key={p.id}>
                    <p className="text-xs font-medium mb-1.5"
                      style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {p.title}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {projectTasks.map(task => {
                        const s = TASK_STYLE[task.status] || TASK_STYLE.pending
                        return (
                          <button
                            key={task.id}
                            className="text-xs px-2.5 py-1 rounded-full transition-all hover:opacity-80"
                            style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}30` }}
                            onClick={() => setSelected(selected?.id === task.id ? null : task)}
                            title={task.title}>
                            {(task.status === 'running' || task.status === 'active') && '⏳ '}
                            {task.title.slice(0, 24)}{task.title.length > 24 ? '…' : ''}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : tasks.length > 0 ? (
            /* No project grouping — just task pills flat */
            <div className="flex flex-wrap gap-1.5">
              {tasks.map(task => {
                const s = TASK_STYLE[task.status] || TASK_STYLE.pending
                return (
                  <button
                    key={task.id}
                    className="text-xs px-2.5 py-1 rounded-full transition-all hover:opacity-80"
                    style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}30` }}
                    onClick={() => setSelected(selected?.id === task.id ? null : task)}
                    title={task.title}>
                    {(task.status === 'running' || task.status === 'active') && '⏳ '}
                    {task.title.slice(0, 24)}{task.title.length > 24 ? '…' : ''}
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              No tasks yet — planning in progress…
            </p>
          )}

          {/* Task detail panel on click */}
          {selected && (
            <div className="mt-3 p-3 rounded-xl text-xs font-mono"
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="font-bold mb-1 text-white">{selected.title}</p>
              <p style={{ color: 'rgba(255,255,255,0.5)' }}>
                {selected.result || selected.error || 'No output yet.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
