'use client'
import { useEffect, useState } from 'react'
import { Target, Flag, Users, Cpu, Brain, BookOpen, Settings, Zap,
         CheckSquare, Layout, Search, ToggleLeft, ToggleRight } from 'lucide-react'
import { useStore, ActiveView, DevOSMode } from '../lib/store'

const API = process.env.NEXT_PUBLIC_DEVOS_API || 'http://localhost:4200'

export function LeftSidebar() {
  const { activeView, setActiveView, devosMode, setDevosMode,
          settings, setIsSetupOpen, mounted } = useStore()
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [health, setHealth] = useState<'ok' | 'error'>('error')

  useEffect(() => {
    const load = async () => {
      try {
        if (devosMode === 'builder') {
          const [missions, goals, agents, skills, h] = await Promise.all([
            fetch(`${API}/api/missions`).then(r => r.json()).catch(() => []),
            fetch(`${API}/api/goals/v2`).then(r => r.json()).catch(() => []),
            fetch(`${API}/api/agents`).then(r => r.json()).catch(() => []),
            fetch(`${API}/api/skills`).then(r => r.json()).catch(() => []),
            fetch(`${API}/api/system/health`).then(r => r.json()).catch(() => ({}))
          ])
          setCounts({
            missions: Array.isArray(missions) ? missions.length : 0,
            goals:    Array.isArray(goals)    ? goals.length    : 0,
            agents:   Array.isArray(agents)   ? agents.length   : 0,
            skills:   Array.isArray(skills)   ? skills.length   : 0,
          })
          setHealth(h?.status === 'ok' ? 'ok' : 'error')
        } else {
          // Personal mode counts
          const [tasks, agents, h] = await Promise.all([
            fetch(`${API}/api/personal/tasks`).then(r => r.json()).catch(() => []),
            fetch(`${API}/api/agents`).then(r => r.json()).catch(() => []),
            fetch(`${API}/api/system/health`).then(r => r.json()).catch(() => ({}))
          ])
          setCounts({
            tasks:  Array.isArray(tasks)  ? tasks.filter((t: any) => t.status !== 'done').length : 0,
            agents: Array.isArray(agents) ? agents.length : 0,
          })
          setHealth(h?.status === 'ok' ? 'ok' : 'error')
        }
      } catch { /* ignore */ }
    }
    load()
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [devosMode])

  type NavItem = {
    icon: React.ComponentType<{ size?: number }>
    label: string
    view: ActiveView
    key: string
    badge?: boolean
  }

  const builderItems: NavItem[] = [
    { icon: Target,   label: 'Missions',   view: 'missions',    key: 'missions', badge: true },
    { icon: Flag,     label: 'Goals',      view: 'goals',       key: 'goals',    badge: true },
    { icon: Users,    label: 'Agents',     view: 'agents',      key: 'agents',   badge: true },
    { icon: Cpu,      label: 'Skills',     view: 'skills',      key: 'skills',   badge: true },
    { icon: Brain,    label: 'Memory',     view: 'memory',      key: 'memory',   badge: false },
    { icon: BookOpen, label: 'Knowledge',  view: 'knowledge',   key: 'knowledge',badge: false },
  ]

  const personalItems: NavItem[] = [
    { icon: CheckSquare, label: 'Tasks',       view: 'tasks',       key: 'tasks',   badge: true  },
    { icon: Layout,      label: 'Life Canvas', view: 'life-canvas', key: 'canvas',  badge: false },
    { icon: Users,       label: 'Agents',      view: 'agents',      key: 'agents',  badge: true  },
    { icon: Search,      label: 'Research',    view: 'research',    key: 'research',badge: false },
  ]

  const navItems = devosMode === 'personal' ? personalItems : builderItems

  return (
    <aside className="h-full flex flex-col p-4"
      style={{
        background: 'rgba(255,255,255,0.03)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)'
      }}>

      {/* Logo */}
      <div className="mb-8 px-2">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>D</div>
          <span className="text-white font-bold text-lg">DevOS</span>
          {/* Mode badge */}
          <span className="text-xs px-1.5 py-0.5 rounded-lg"
            style={{
              background: devosMode === 'personal' ? 'rgba(234,179,8,0.2)' : 'rgba(99,102,241,0.2)',
              color:      devosMode === 'personal' ? '#fbbf24' : '#a5b4fc',
            }}>
            {devosMode}
          </span>
        </div>
        {mounted && settings.userName && (
          <p className="text-gray-600 text-xs mt-1">Hey, {settings.userName}</p>
        )}
      </div>

      {/* Chat button */}
      <button onClick={() => setActiveView('chat')}
        className="w-full p-3 rounded-2xl mb-4 text-left text-sm font-medium transition-all"
        style={{
          background: activeView === 'chat'
            ? 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3))'
            : 'rgba(255,255,255,0.05)',
          border: activeView === 'chat'
            ? '1px solid rgba(99,102,241,0.5)'
            : '1px solid rgba(255,255,255,0.06)',
          color: activeView === 'chat' ? 'white' : 'rgba(255,255,255,0.5)'
        }}>
        <div className="flex items-center space-x-2">
          <Zap size={15} />
          <span>Chat</span>
        </div>
      </button>

      {/* Nav items */}
      <nav className="flex-1 space-y-1">
        {navItems.map(item => {
          const count   = counts[item.key] ?? 0
          const isActive = activeView === item.view
          return (
            <button key={item.view} onClick={() => setActiveView(item.view)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl transition-all text-sm"
              style={{
                background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: isActive ? 'white' : 'rgba(255,255,255,0.4)'
              }}>
              <div className="flex items-center space-x-2">
                <item.icon size={15} />
                <span>{item.label}</span>
              </div>
              {item.badge && count > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(99,102,241,0.3)', color: '#a5b4fc' }}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Bottom: mode toggle + settings + API status */}
      <div className="space-y-3 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Mode toggle */}
        <button
          onClick={() => setDevosMode(devosMode === 'builder' ? 'personal' : 'builder')}
          className="w-full flex items-center space-x-2 px-3 py-2 rounded-2xl text-sm transition-all hover:text-white"
          style={{ color: 'rgba(255,255,255,0.3)' }}
          title={`Switch to ${devosMode === 'builder' ? 'personal' : 'builder'} mode`}>
          {devosMode === 'builder' ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
          <span>{devosMode === 'builder' ? 'Switch to Personal' : 'Switch to Builder'}</span>
        </button>

        <button onClick={() => setIsSetupOpen(true)}
          className="w-full flex items-center space-x-2 px-3 py-2 rounded-2xl text-sm transition-all hover:text-white"
          style={{ color: 'rgba(255,255,255,0.3)' }}>
          <Settings size={14} />
          <span>Settings</span>
        </button>

        {/* API status dot */}
        <div className="flex items-center space-x-2 px-3">
          <div
            className={`w-2 h-2 rounded-full ${health === 'ok' ? 'bg-green-400' : 'bg-red-500'}`}
            style={health === 'ok' ? { boxShadow: '0 0 6px #4ade80' } : {}}
          />
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {health === 'ok' ? 'API Online' : 'API Offline'}
          </span>
        </div>

        <p className="text-xs px-3" style={{ color: 'rgba(255,255,255,0.15)' }}>v1.0.0</p>
      </div>
    </aside>
  )
}
