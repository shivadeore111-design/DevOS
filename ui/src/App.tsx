import { useState, useEffect } from 'react'
import { Chat }        from './components/Chat'
import { AgentPanel }  from './components/AgentPanel'
import { ProjectsTab } from './components/ProjectsTab'
import { LogsTab }     from './components/LogsTab'
import { MemoryTab }   from './components/MemoryTab'
import { api }         from './api/client'

type Tab = 'projects' | 'logs' | 'memory'

export default function App() {
  const [tab, setTab]       = useState<Tab>('projects')
  const [health, setHealth] = useState<any>(null)

  useEffect(() => {
    api.getHealth().then(setHealth).catch(() => {})
    const interval = setInterval(() => {
      api.getHealth().then(setHealth).catch(() => {})
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'projects', label: 'Projects' },
    { id: 'logs',     label: 'Logs'     },
    { id: 'memory',   label: 'Memory'   }
  ]

  return (
    <div className="h-screen bg-devos-bg text-devos-text flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="h-12 border-b border-devos-border flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center space-x-3">
          <span className="text-base font-bold text-devos-accent tracking-tight">DevOS</span>
          <span className="text-xs text-devos-muted">Mission Control</span>
        </div>
        <div className="flex items-center space-x-4">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`text-sm px-3 py-1 rounded transition-colors ${
                tab === t.id
                  ? 'bg-devos-accent/20 text-devos-accent'
                  : 'text-devos-muted hover:text-devos-text'
              }`}
            >
              {t.label}
            </button>
          ))}
          <div className="flex items-center space-x-1.5">
            <div className={`w-2 h-2 rounded-full ${health?.status === 'ok' ? 'bg-devos-green' : 'bg-devos-red'}`} />
            <span className="text-xs text-devos-muted">
              {health?.status === 'ok' ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden p-3 gap-3">
        {/* Chat — always visible */}
        <div className="w-96 shrink-0 flex flex-col">
          <Chat />
        </div>

        {/* Agent panel — always visible */}
        <div className="w-72 shrink-0 flex flex-col">
          <AgentPanel />
        </div>

        {/* Tab content — fills remaining space */}
        <div className="flex-1 overflow-hidden">
          {tab === 'projects' && <ProjectsTab />}
          {tab === 'logs'     && <LogsTab />}
          {tab === 'memory'   && <MemoryTab />}
        </div>
      </div>
    </div>
  )
}
