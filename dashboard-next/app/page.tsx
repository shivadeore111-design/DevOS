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

  useEffect(() => {
    fetch(`${API}/api/goals/v2`)
      .then(r => r.json())
      .then(d => { setGoals(Array.isArray(d) ? d : []); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [])

  return (
    <div className="p-6 overflow-y-auto h-full">
      <h2 className="text-xl font-bold text-white mb-4">Goals</h2>
      {!loaded && <p style={{ color: 'rgba(255,255,255,0.3)' }}>Loading...</p>}
      {loaded && goals.length === 0 && (
        <p style={{ color: 'rgba(255,255,255,0.3)' }}>No goals yet. Chat to create one.</p>
      )}
      <div className="space-y-3">
        {goals.map((g, i) => (
          <div key={`goal-${i}-${g.id || ""}`}
            className="p-4 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-white font-medium text-sm">{g.title}</p>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{
                background: g.status === 'completed'
                  ? 'rgba(34,197,94,0.2)'
                  : g.status === 'failed'
                  ? 'rgba(239,68,68,0.2)'
                  : 'rgba(99,102,241,0.2)',
                color: g.status === 'completed'
                  ? '#4ade80'
                  : g.status === 'failed'
                  ? '#f87171'
                  : '#a5b4fc'
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

  useEffect(() => {
    fetch(`${API}/api/missions`)
      .then(r => r.json())
      .then(d => { setMissions(Array.isArray(d) ? d : []); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [])

  return (
    <div className="p-6 overflow-y-auto h-full">
      <h2 className="text-xl font-bold text-white mb-4">Missions</h2>
      {!loaded && <p style={{ color: 'rgba(255,255,255,0.3)' }}>Loading...</p>}
      {loaded && missions.length === 0 && (
        <p style={{ color: 'rgba(255,255,255,0.3)' }}>No missions yet.</p>
      )}
      <div className="space-y-3">
        {missions.map((m, i) => (
          <div key={m.id || m.goal || i}
            className="p-4 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-white font-medium text-sm">{m.goal}</p>
            <div className="flex items-center space-x-3 mt-2">
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{m.status}</span>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {m.tasksDone || 0}/{m.tasksTotal || 0} tasks
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AgentsView() {
  const [agents, setAgents] = useState<any[]>([])

  useEffect(() => {
    fetch(`${API}/api/agents`)
      .then(r => r.json())
      .then(d => setAgents(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  const STATUS_COLOR: Record<string, string> = {
    idle: '#4ade80',
    thinking: '#6366f1',
    executing: '#eab308',
    error: '#ef4444'
  }

  return (
    <div className="p-6 overflow-y-auto h-full">
      <h2 className="text-xl font-bold text-white mb-4">Agents</h2>
      <div className="grid grid-cols-2 gap-3">
        {agents.map((a, i) => (
          <div key={a.id || a.role || i}
            className="p-4 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-2 h-2 rounded-full"
                style={{
                  background: STATUS_COLOR[a.status] || '#4ade80',
                  boxShadow: `0 0 6px ${STATUS_COLOR[a.status] || '#4ade80'}`
                }} />
              <p className="text-white font-medium text-sm">{a.name}</p>
            </div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{a.status}</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
              {a.completedTasks} completed
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function PilotsView() {
  const [pilots, setPilots] = useState<any[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch(`${API}/api/pilots`)
      .then(r => r.json())
      .then(d => { setPilots(Array.isArray(d) ? d : []); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [])

  const runPilot = async (id: string) => {
    await fetch(`${API}/api/pilots/${id}/run`, { method: 'POST' })
    alert('Pilot started!')
  }

  const togglePilot = async (id: string, enabled: boolean) => {
    await fetch(`${API}/api/pilots/${id}/${enabled ? 'disable' : 'enable'}`, { method: 'POST' })
    setPilots(prev => prev.map(p => p.id === id ? { ...p, enabled: !enabled } : p))
  }

  return (
    <div className="p-6 overflow-y-auto h-full">
      <h2 className="text-xl font-bold text-white mb-2">Pilots</h2>
      <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.3)' }}>
        Autonomous scheduled agents that run in the background
      </p>
      {!loaded && <p style={{ color: 'rgba(255,255,255,0.3)' }}>Loading...</p>}
      <div className="grid grid-cols-1 gap-3">
        {pilots.map((p, i) => (
          <div key={p.id || i} className="p-4 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${p.enabled ? 'bg-green-400' : 'bg-gray-600'}`}
                  style={p.enabled ? { boxShadow: '0 0 6px #4ade80' } : {}} />
                <p className="text-white font-medium text-sm">{p.name}</p>
              </div>
              <div className="flex space-x-2">
                <button onClick={() => runPilot(p.id)}
                  className="text-xs px-3 py-1 rounded-xl text-white transition-all hover:opacity-80"
                  style={{ background: 'rgba(99,102,241,0.4)' }}>
                  Run Now
                </button>
                <button onClick={() => togglePilot(p.id, p.enabled)}
                  className="text-xs px-3 py-1 rounded-xl transition-all hover:opacity-80"
                  style={{
                    background: p.enabled ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)',
                    color: p.enabled ? '#f87171' : '#4ade80'
                  }}>
                  {p.enabled ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
            <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>{p.description}</p>
            <div className="flex items-center space-x-3">
              {p.schedule && (
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
                  ⏱ {p.schedule}
                </span>
              )}
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>{p.id}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MemoryView() {
  const [entries, setEntries] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/knowledge`).then(r => r.json()).catch(() => []),
      fetch(`${API}/api/memory/stats`).then(r => r.json()).catch(() => ({}))
    ]).then(([knowledgeEntries, memStats]) => {
      setEntries(Array.isArray(knowledgeEntries) ? knowledgeEntries.slice(0, 20) : [])
      setStats(memStats)
    })
  }, [])

  const search = async () => {
    if (!query.trim()) return
    setLoading(true)
    fetch(`${API}/api/knowledge/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: query })
    }).then(r => r.json())
      .then(d => setAnswer(d.answer || 'No answer found.'))
      .catch(() => setAnswer('Query failed.'))
      .finally(() => setLoading(false))
  }

  return (
    <div className="p-6 overflow-y-auto h-full">
      <h2 className="text-xl font-bold text-white mb-2">Memory</h2>
      {stats && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Entries',     value: stats.totalEntries ?? entries.length ?? 0 },
            { label: 'Success Rate', value: `${Math.round((stats.successRate ?? 0) * 100)}%` },
            { label: 'Patterns',    value: stats.topPatterns?.length ?? 0 }
          ].map(s => (
            <div key={s.label} className="p-3 rounded-2xl text-center"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-xl font-bold" style={{ color: '#6366f1' }}>{s.value}</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}
      <div className="flex space-x-2 mb-4">
        <input
          className="flex-1 px-4 py-2 rounded-2xl text-white text-sm focus:outline-none"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
          placeholder="Ask the knowledge base..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
        />
        <button onClick={search} disabled={loading}
          className="px-4 py-2 rounded-2xl text-white text-sm disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
          {loading ? '...' : 'Ask'}
        </button>
      </div>
      {answer && (
        <div className="p-3 rounded-2xl mb-4 text-sm text-white"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {answer}
        </div>
      )}
      <div className="space-y-2">
        {entries.length === 0 && (
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
            No knowledge entries yet. Run goals to build memory.
          </p>
        )}
        {entries.map((e: any, i: number) => (
          <div key={e.id || i} className="p-3 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-sm font-medium text-white">{e.title}</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {(e.content || '').slice(0, 100)}
            </p>
            <div className="flex flex-wrap gap-1 mt-2">
              {(e.tags || []).slice(0, 4).map((tag: string) => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}>{tag}</span>
              ))}
            </div>
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
        <div className="fixed inset-0 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          style={{ background: 'rgba(0,0,0,0.5)' }} />
      )}

      {/* Left sidebar */}
      <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative z-40 md:z-auto w-56 h-full transition-transform duration-300`}>
        <LeftSidebar />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Mobile header */}
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
          {activeView === 'pilots' && <PilotsView />}
          {activeView === 'memory' && <MemoryView />}
        </div>
      </div>

      {/* Right agent feed */}
      <div className="hidden lg:block w-72 shrink-0">
        <AgentFeed />
      </div>
    </div>
  )
}
