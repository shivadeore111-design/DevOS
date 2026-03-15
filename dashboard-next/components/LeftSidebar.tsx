'use client'
import { useEffect, useState } from 'react'
import { Target, Flag, Users, Zap, Brain, BookOpen } from 'lucide-react'
import { api } from '../lib/api'

export function LeftSidebar() {
  const [counts, setCounts] = useState<Record<string, number | string>>({})
  const [health, setHealth] = useState<'ok' | 'error'>('error')

  useEffect(() => {
    const load = async () => {
      const [goals, missions, agents, pilots, h] = await Promise.all([
        api.listGoals(), api.listMissions(), api.listAgents(),
        api.listPilots(), api.getHealth()
      ])
      setCounts({
        missions: Array.isArray(missions) ? missions.length : 0,
        goals: Array.isArray(goals) ? goals.length : 0,
        agents: Array.isArray(agents) ? agents.length : 0,
        pilots: Array.isArray(pilots) ? pilots.length : 0,
      })
      setHealth(h?.status === 'ok' ? 'ok' : 'error')
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  const navItems = [
    { icon: Target, label: 'Missions', key: 'missions' },
    { icon: Flag, label: 'Goals', key: 'goals' },
    { icon: Users, label: 'Agents', key: 'agents' },
    { icon: Zap, label: 'Pilots', key: 'pilots' },
    { icon: Brain, label: 'Memory', key: 'memory', count: 'Active' },
    { icon: BookOpen, label: 'Knowledge', key: 'knowledge', count: 'Ready' },
  ]

  return (
    <aside className="h-full flex flex-col border-r p-4"
      style={{ borderColor: 'var(--devos-border)', background: 'var(--devos-surface)' }}>
      <div className="mb-6">
        <span className="text-xl font-bold" style={{ color: 'var(--devos-text)' }}>DevOS</span>
        <span className="ml-2 text-xs px-2 py-0.5 rounded"
          style={{ background: 'var(--devos-accent)', color: 'white' }}>AI OS</span>
      </div>
      <nav className="flex-1 space-y-1">
        {navItems.map(item => (
          <div key={item.key} className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
            style={{ color: 'var(--devos-text)' }}>
            <div className="flex items-center space-x-2">
              <item.icon size={16} style={{ color: 'var(--devos-muted)' }} />
              <span className="text-sm">{item.label}</span>
            </div>
            <span className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: 'var(--devos-border)', color: 'var(--devos-muted)' }}>
              {item.count ?? counts[item.key] ?? 0}
            </span>
          </div>
        ))}
      </nav>
      <div className="pt-4 border-t" style={{ borderColor: 'var(--devos-border)' }}>
        <div className="flex items-center space-x-2 mb-1">
          <div className={`w-2 h-2 rounded-full ${health === 'ok' ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs" style={{ color: 'var(--devos-muted)' }}>
            {health === 'ok' ? 'Online' : 'Offline'}
          </span>
        </div>
        <p className="text-xs" style={{ color: 'var(--devos-muted)' }}>v0.4.0 — Built with DevOS</p>
      </div>
    </aside>
  )
}
