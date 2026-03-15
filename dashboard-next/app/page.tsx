'use client'
import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { LeftSidebar } from '../components/LeftSidebar'
import { ChatPanel } from '../components/ChatPanel'
import { AgentFeed } from '../components/AgentFeed'
import { SetupWizard } from '../components/SetupWizard'

const API = process.env.NEXT_PUBLIC_DEVOS_API || 'http://localhost:4200'

function GoalsView() {
  const [goals, setGoals] = useState<any[]>([])
  const [loaded, setLoaded] = useState(false)
  useState(() => {
    fetch(`${API}/api/goals/v2`).then(r => r.json())
      .then(d => { setGoals(Array.isArray(d) ? d : []); setLoaded(true) })
      .catch(() => setLoaded(true))
  })
  return (
    <div className="p-6 overflow-y-auto h-full">
      <h2 className="text-xl font-bold text-white mb-4">Goals</h2>
      {!loaded && <p style={{ color: 'rgba(255,255,255,0.3)' }}>Loading...</p>}
      {loaded && goals.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)' }}>No goals yet. Chat to create one.</p>}
      <div className="space-y-3">
        {goals.map(g => (
          <div key={g.id} className="p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-white font-medium text-sm">{g.title}</p>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{
                background: g.status === 'completed' ? 'rgba(34,197,94,0.2)' : g.status === 'failed' ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.2)',
                color: g.status === 'completed' ? '#4ade80' : g.status === 'failed' ? '#f87171' : '#a5b4fc'
              }}>{g.status}</span>
            </div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{g.id}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function MissionsView() {
  const [missions, setMissions] = useState<any[]>([])
  const [loaded, setLoaded] = useState(false)
  useState(() => {
    fetch(`${API}/api/missions`).then(r => r.json())
      .then(d => { setMissions(Array.isArray(d) ? d : []); setLoaded(true) })
      .catch(() => setLoaded(true))
  })
  return (
    <div className="p-6 overflow-y-auto h-full">
      <h2 className="text-xl font-bold text-white mb-4">Missions</h2>
      {!loaded && <p style={{ color: 'rgba(255,255,255,0.3)' }}>Loading...</p>}
      {loaded && missions.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)' }}>No missions yet.</p>}
      <div className="space-y-3">
        {missions.map(m => (
          <div key={m.id} className="p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-white font-medium text-sm">{m.goal}</p>
            <div className="flex items-center space-x-3 mt-2">
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{m.status}</span>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{m.tasksDone || 0}/{m.tasksTotal || 0} tasks</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AgentsView() {
  const [agents, setAgents] = useState<any[]>([])
  useState(() => {
    fetch(`${API}/api/agents`).then(r => r.json())
      .then(d => setAgents(Array.isArray(d) ? d : []))
      .catch(() => {})
  })
  const STATUS_COLOR: Record<string, string> = { idle: '#4ade80', thinking: '#6366f1', executing: '#eab308', error: '#ef4444' }
  return (
    <div className="p-6 overflow-y-auto h-full">
      <h2 className="text-xl font-bold text-white mb-4">Agents</h2>
      <div className="grid grid-cols-2 gap-3">
        {agents.map(a => (
          <div key={a.id} className="p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-2 h-2 rounded-full"
                style={{ background: STATUS_COLOR[a.status] || '#4ade80', boxShadow: `0 0 6px ${STATUS_COLOR[a.status] || '#4ade80'}` }} />
              <p className="text-white font-medium text-sm">{a.name}</p>
            </div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{a.status}</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>{a.completedTasks} completed</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  const { activeView, settings, isSetupOpen, setIsSetupOpen, mounted } = useStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (mounted && !settings.isSetupComplete) {
      setIsSetupOpen(true)
    }
  }, [mounted])

  return (
    <div className="h-screen flex overflow-hidden relative"
      style={{ background: 'linear-gradient(135deg, #0a0a1a 0%, #0f0a1f 50%, #0a0f1a 100%)' }}>

      {/* Background glow effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent)', filter: 'blur(60px)' }} />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)', filter: 'blur(60px)' }} />
      </div>

      {isSetupOpen && <SetupWizard />}

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setSidebarOpen(false)}
          style={{ background: 'rgba(0,0,0,0.5)' }} />
      )}

      <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative z-40 md:z-auto w-56 h-full transition-transform duration-300`}>
        <LeftSidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0 relative">
        <div className="md:hidden px-4 py-3 flex items-center"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="mr-3 text-white">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span className="font-bold text-white">DevOS</span>
        </div>

        <div className="flex-1 overflow-hidden">
          {activeView === 'chat'     && <ChatPanel />}
          {activeView === 'goals'    && <GoalsView />}
          {activeView === 'missions' && <MissionsView />}
          {activeView === 'agents'   && <AgentsView />}
          {(activeView === 'pilots' || activeView === 'memory') && (
            <div className="p-6 text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
              <p className="text-4xl mb-3">🚧</p>
              <p>Coming soon</p>
            </div>
          )}
        </div>
      </div>

      <div className="hidden lg:block w-72 shrink-0">
        <AgentFeed />
      </div>
    </div>
  )
}
