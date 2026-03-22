'use client'
import { useState, useEffect, useCallback } from 'react'
import { Menu, X, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { useStore } from '../lib/store'
import { LeftSidebar } from '../components/LeftSidebar'
import { ChatPanel } from '../components/ChatPanel'
import { LivePulsePanel } from '../components/LivePulsePanel'
import { SetupWizard } from '../components/SetupWizard'
import { QuickLaunch } from '../components/QuickLaunch'

const API = process.env.NEXT_PUBLIC_DEVOS_API || 'http://localhost:4200'

// ── View-specific sub-panels rendered in the center when navigated ───────────

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
          <div key={`goal-${i}-${g.id || ''}`}
            className="p-4 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-white font-medium text-sm">{g.title}</p>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{
                background: g.status === 'completed' ? 'rgba(34,197,94,0.2)'
                  : g.status === 'failed' ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.2)',
                color: g.status === 'completed' ? '#4ade80'
                  : g.status === 'failed' ? '#f87171' : '#a5b4fc'
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
    idle: '#4ade80', thinking: '#6366f1', executing: '#eab308', error: '#ef4444'
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

function SkillsView() {
  const [skills, setSkills] = useState<any[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch(`${API}/api/skills`)
      .then(r => r.json())
      .then(d => { setSkills(Array.isArray(d) ? d : []); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [])

  return (
    <div className="p-6 overflow-y-auto h-full">
      <h2 className="text-xl font-bold text-white mb-4">Skills</h2>
      {!loaded && <p style={{ color: 'rgba(255,255,255,0.3)' }}>Loading...</p>}
      {loaded && skills.length === 0 && (
        <p style={{ color: 'rgba(255,255,255,0.3)' }}>No skills registered yet.</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {skills.map((s, i) => (
          <div key={s.id || s.name || i}
            className="p-4 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-white font-medium text-sm">{s.name}</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.description || s.type}</p>
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
            { label: 'Entries',      value: stats.totalEntries ?? entries.length ?? 0 },
            { label: 'Success Rate', value: `${Math.round((stats.successRate ?? 0) * 100)}%` },
            { label: 'Patterns',     value: stats.topPatterns?.length ?? 0 }
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

function KnowledgeView() {
  const [entries, setEntries] = useState<any[]>([])
  const [loaded, setLoaded] = useState(false)
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState('')
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    fetch(`${API}/api/knowledge`)
      .then(r => r.json())
      .then(d => { setEntries(Array.isArray(d) ? d : []); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [])

  const search = async () => {
    if (!query.trim()) return
    setSearching(true)
    fetch(`${API}/api/knowledge/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: query })
    }).then(r => r.json())
      .then(d => setAnswer(d.answer || 'No answer found.'))
      .catch(() => setAnswer('Query failed.'))
      .finally(() => setSearching(false))
  }

  return (
    <div className="p-6 overflow-y-auto h-full">
      <h2 className="text-xl font-bold text-white mb-4">Knowledge</h2>
      <div className="flex space-x-2 mb-6">
        <input
          className="flex-1 px-4 py-2 rounded-2xl text-white text-sm focus:outline-none"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
          placeholder="Query the knowledge base..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
        />
        <button onClick={search} disabled={searching}
          className="px-4 py-2 rounded-2xl text-white text-sm disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
          {searching ? '...' : 'Search'}
        </button>
      </div>
      {answer && (
        <div className="p-4 rounded-2xl mb-6 text-sm text-white"
          style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)' }}>
          {answer}
        </div>
      )}
      {!loaded && <p style={{ color: 'rgba(255,255,255,0.3)' }}>Loading...</p>}
      <div className="space-y-2">
        {loaded && entries.length === 0 && (
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
            No knowledge entries yet.
          </p>
        )}
        {entries.map((e: any, i: number) => (
          <div key={e.id || i} className="p-3 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-sm font-medium text-white">{e.title}</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {(e.content || '').slice(0, 120)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main layout ──────────────────────────────────────────────────────────────

export default function Home() {
  const { activeView, settings, isSetupOpen, setIsSetupOpen, mounted } = useStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [pulseOpen, setPulseOpen] = useState(true)
  const [quickLaunchOpen, setQuickLaunchOpen] = useState(false)

  // Setup wizard auto-open
  useEffect(() => {
    if (mounted && !settings.isSetupComplete) {
      setIsSetupOpen(true)
    }
  }, [mounted])

  // Cmd+K / Ctrl+K → QuickLaunch
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setQuickLaunchOpen(prev => !prev)
      }
      if (e.key === 'Escape') setQuickLaunchOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleQuickSelect = useCallback((text: string) => {
    window.dispatchEvent(new CustomEvent('devos:quicklaunch', { detail: { query: text } }))
    setQuickLaunchOpen(false)
  }, [])

  return (
    <div className="h-screen flex overflow-hidden relative"
      style={{ background: 'linear-gradient(135deg, #0a0a1a 0%, #0f0a1f 50%, #0a0f1a 100%)' }}>

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent)', filter: 'blur(60px)' }} />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)', filter: 'blur(60px)' }} />
      </div>

      {/* Modals */}
      {isSetupOpen && <SetupWizard />}
      {quickLaunchOpen && (
        <QuickLaunch
          onClose={() => setQuickLaunchOpen(false)}
          onSelect={handleQuickSelect}
        />
      )}

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          style={{ background: 'rgba(0,0,0,0.5)' }} />
      )}

      {/* ── Left sidebar  w-64 ── */}
      <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative z-40 md:z-auto w-64 h-full transition-transform duration-300 shrink-0`}>
        <LeftSidebar />
      </div>

      {/* ── Center panel  flex-1 ── */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Mobile header */}
        <div className="md:hidden px-4 py-3 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-white">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span className="font-bold text-white">DevOS</span>
          <button onClick={() => setPulseOpen(p => !p)} className="text-white opacity-50 hover:opacity-100">
            {pulseOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          {/* Chat is always the main center — other views slide in */}
          {activeView === 'chat'      && <ChatPanel />}
          {activeView === 'goals'     && <GoalsView />}
          {activeView === 'missions'  && <MissionsView />}
          {activeView === 'agents'    && <AgentsView />}
          {activeView === 'skills'    && <SkillsView />}
          {activeView === 'memory'    && <MemoryView />}
          {activeView === 'knowledge' && <KnowledgeView />}
        </div>
      </div>

      {/* ── Right LivePulse panel  w-80 collapsible ── */}
      <div className={`hidden md:flex flex-col shrink-0 transition-all duration-300 overflow-hidden ${pulseOpen ? 'w-80' : 'w-10'}`}>
        {/* Collapse toggle */}
        <button
          onClick={() => setPulseOpen(p => !p)}
          className="absolute right-0 mt-3 mr-1 z-10 p-1.5 rounded-xl transition-all hover:opacity-80"
          style={{ color: 'rgba(255,255,255,0.3)' }}
          title={pulseOpen ? 'Collapse LivePulse' : 'Expand LivePulse'}>
          {pulseOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
        </button>
        {pulseOpen && <LivePulsePanel />}
      </div>
    </div>
  )
}
