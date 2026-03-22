import { useEffect, useState } from 'react'
import { api } from '../api/client'

const STATUS_BADGE: Record<string, string> = {
  pending:   'bg-gray-800 text-gray-400',
  active:    'bg-indigo-900 text-indigo-300',
  completed: 'bg-green-900 text-green-300',
  failed:    'bg-red-900 text-red-300',
  paused:    'bg-yellow-900 text-yellow-300'
}

export function ProjectsTab() {
  const [goals, setGoals]       = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)

  useEffect(() => {
    const load = async () => {
      const g = await api.listGoals()
      setGoals(Array.isArray(g) ? g : g?.goals || g?.data || [])
    }
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [])

  const select = async (goal: any) => {
    const detail = await api.getGoal(goal.goalId ?? goal.id)
    setSelected(detail)
  }

  return (
    <div className="flex h-full bg-devos-surface rounded-lg border border-devos-border overflow-hidden">
      {/* Goal list */}
      <div className="w-64 border-r border-devos-border flex flex-col">
        <div className="px-4 py-3 border-b border-devos-border">
          <h2 className="text-sm font-semibold text-devos-text">Goals</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {goals.length === 0 && (
            <p className="text-xs text-devos-muted p-2">No goals yet. Chat to create one.</p>
          )}
          {goals.map((goal: any) => (
            <button
              key={goal.goalId ?? goal.id}
              onClick={() => select(goal)}
              className={`w-full text-left p-2 rounded-lg transition-colors ${
                selected?.goal?.id === (goal.goalId ?? goal.id) ? 'bg-devos-accent/20' : 'hover:bg-devos-bg'
              }`}
            >
              <p className="text-sm text-devos-text truncate">{goal.title}</p>
              <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_BADGE[goal.status] || ''}`}>
                {goal.status}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Goal detail */}
      <div className="flex-1 overflow-y-auto p-4">
        {!selected && (
          <div className="flex items-center justify-center h-full">
            <p className="text-devos-muted text-sm">Select a goal to see details</p>
          </div>
        )}
        {selected && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-devos-text">{selected.goal?.title}</h3>
              <p className="text-sm text-devos-muted mt-1">{selected.goal?.description}</p>
            </div>
            {(selected.projects || []).map((project: any) => (
              <div key={project.id} className="bg-devos-bg rounded-lg p-3 border border-devos-border">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-devos-text">{project.title}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_BADGE[project.status] || ''}`}>
                    {project.status}
                  </span>
                </div>
                <div className="space-y-1">
                  {(selected.tasks || [])
                    .filter((t: any) => t.projectId === project.id)
                    .map((task: any) => (
                      <div key={task.id} className="flex items-center space-x-2 text-xs text-devos-muted">
                        <span>
                          {task.status === 'completed' ? '✅' : task.status === 'failed' ? '❌' : '⏳'}
                        </span>
                        <span>{task.title}</span>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
