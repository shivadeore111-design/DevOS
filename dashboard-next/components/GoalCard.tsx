'use client'
import { useEffect, useState } from 'react'
import { api } from '../lib/api'

const STATUS_STYLE: Record<string, { bg: string, color: string }> = {
  pending:   { bg: 'var(--devos-border)',  color: 'var(--devos-text)' },
  active:    { bg: 'var(--devos-yellow)',  color: 'black' },
  completed: { bg: 'var(--devos-green)',   color: 'white' },
  failed:    { bg: 'var(--devos-red)',     color: 'white' },
}

export function GoalCard({ goalId }: { goalId: string }) {
  const [data, setData] = useState<any>(null)
  const [selected, setSelected] = useState<any>(null)

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    const load = async () => {
      const d = await api.getGoal(goalId)
      setData(d)
      const allDone = d?.tasks?.every((t: any) =>
        t.status === 'completed' || t.status === 'failed')
      if (allDone) clearInterval(interval)
    }
    load()
    interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  }, [goalId])

  if (!data) return null

  return (
    <div className="mt-2 p-3 rounded-xl border text-xs"
      style={{ background: 'var(--devos-surface)', borderColor: 'var(--devos-border)' }}>
      <div className="inline-block px-2 py-0.5 rounded mb-2 text-white text-xs"
        style={{ background: 'var(--devos-accent)' }}>
        {data.goal?.title || goalId}
      </div>
      <div className="flex flex-wrap gap-2">
        {(data.projects || []).map((p: any) => (
          <div key={p.id} className="border rounded-lg p-2 min-w-32"
            style={{ borderColor: 'var(--devos-border)' }}>
            <p className="font-medium mb-1" style={{ color: 'var(--devos-text)' }}>{p.title}</p>
            <div className="flex flex-wrap gap-1">
              {(data.tasks || [])
                .filter((t: any) => t.projectId === p.id)
                .map((task: any) => {
                  const s = STATUS_STYLE[task.status] || STATUS_STYLE.pending
                  return (
                    <span key={task.id}
                      className="px-2 py-0.5 rounded-full cursor-pointer text-xs"
                      style={{ background: s.bg, color: s.color }}
                      onClick={() => setSelected(selected?.id === task.id ? null : task)}
                      title={task.title}>
                      {task.status === 'active' ? '⏳ ' : ''}{task.title.slice(0, 20)}
                    </span>
                  )
                })}
            </div>
          </div>
        ))}
      </div>
      {selected && (
        <div className="mt-2 p-2 rounded border font-mono text-xs"
          style={{ background: 'var(--devos-bg)', borderColor: 'var(--devos-border)', color: 'var(--devos-muted)' }}>
          <p className="font-bold mb-1" style={{ color: 'var(--devos-text)' }}>{selected.title}</p>
          <p>{selected.result || selected.error || 'No output yet'}</p>
        </div>
      )}
    </div>
  )
}
