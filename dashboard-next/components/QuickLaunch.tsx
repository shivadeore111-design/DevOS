'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Zap, Target, Flag, X } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_DEVOS_API || 'http://localhost:4200'

interface QuickItem {
  id: string
  label: string
  description?: string
  icon: string
  category: 'goal' | 'skill' | 'action'
  query: string
}

const QUICK_ACTIONS: QuickItem[] = [
  { id: 'qa-build', label: 'Build something new', description: 'Start a new coding goal', icon: '⚡', category: 'action', query: 'Build ' },
  { id: 'qa-research', label: 'Research a topic', description: 'Deep research goal', icon: '🔍', category: 'action', query: 'Research ' },
  { id: 'qa-deploy', label: 'Deploy to production', description: 'Ship current project', icon: '🚀', category: 'action', query: 'Deploy ' },
  { id: 'qa-debug', label: 'Debug an issue', description: 'Fix a bug or error', icon: '🐛', category: 'action', query: 'Debug ' },
  { id: 'qa-status', label: 'Check system status', description: 'What is currently running', icon: '📊', category: 'action', query: 'What is currently running?' },
  { id: 'qa-review', label: 'Review recent work', description: 'Summarize recent goals', icon: '📋', category: 'action', query: 'Summarize what I have built recently.' },
]

interface Props {
  onClose: () => void
  onSelect: (query: string) => void
}

export function QuickLaunch({ onClose, onSelect }: Props) {
  const [search, setSearch]       = useState('')
  const [items, setItems]         = useState<QuickItem[]>(QUICK_ACTIONS)
  const [cursor, setCursor]       = useState(0)
  const [loading, setLoading]     = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef  = useRef<HTMLDivElement>(null)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Load recent goals + skills and merge with quick actions
  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`${API}/api/goals/v2`).then(r => r.json()).catch(() => []),
      fetch(`${API}/api/skills`).then(r => r.json()).catch(() => []),
    ]).then(([goals, skills]) => {
      const goalItems: QuickItem[] = (Array.isArray(goals) ? goals.slice(0, 8) : [])
        .map((g: any) => ({
          id:          `goal-${g.id}`,
          label:       g.title || g.id,
          description: `Goal · ${g.status}`,
          icon:        '🎯',
          category:    'goal' as const,
          query:       g.title || g.id,
        }))

      const skillItems: QuickItem[] = (Array.isArray(skills) ? skills.slice(0, 6) : [])
        .map((s: any) => ({
          id:          `skill-${s.id || s.name}`,
          label:       s.name || s.id,
          description: `Skill · ${s.type || s.description || ''}`,
          icon:        '🧩',
          category:    'skill' as const,
          query:       `Use the ${s.name} skill to `,
        }))

      setItems([...QUICK_ACTIONS, ...goalItems, ...skillItems])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // Filter items based on search query
  const filtered = search.trim()
    ? items.filter(item =>
        item.label.toLowerCase().includes(search.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(search.toLowerCase())
      )
    : items

  // Keep cursor in bounds
  useEffect(() => {
    setCursor(c => Math.min(c, Math.max(0, filtered.length - 1)))
  }, [filtered.length])

  // Keyboard navigation
  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor(c => Math.min(c + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor(c => Math.max(c - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = filtered[cursor]
      if (item) select(item)
      else if (search.trim()) onSelect(search.trim())
    } else if (e.key === 'Escape') {
      onClose()
    }
  }, [filtered, cursor, search])

  const select = (item: QuickItem) => {
    onSelect(item.query)
  }

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-cursor="true"]') as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  const categoryLabel: Record<string, string> = {
    action: 'Quick Actions',
    goal:   'Recent Goals',
    skill:  'Skills',
  }

  // Group filtered items
  const groups: Record<string, QuickItem[]> = {}
  for (const item of filtered) {
    if (!groups[item.category]) groups[item.category] = []
    groups[item.category].push(item)
  }
  const groupOrder = ['action', 'goal', 'skill'] as const

  let absoluteIndex = 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>

      <div className="w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl"
        style={{
          background: 'rgba(15,10,30,0.97)',
          border: '1px solid rgba(99,102,241,0.3)',
          boxShadow: '0 0 60px rgba(99,102,241,0.2)'
        }}>

        {/* Search input */}
        <div className="flex items-center space-x-3 px-4 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Search size={18} style={{ color: 'rgba(255,255,255,0.4)' }} />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-gray-600"
            placeholder="Search goals, skills, quick actions…"
            value={search}
            onChange={e => { setSearch(e.target.value); setCursor(0) }}
            onKeyDown={handleKey}
          />
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70"
            style={{ color: 'rgba(255,255,255,0.3)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-96 overflow-y-auto p-2">
          {loading && (
            <p className="text-center text-xs py-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Loading…
            </p>
          )}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>No results</p>
              {search.trim() && (
                <button
                  className="mt-3 px-4 py-2 rounded-xl text-sm text-white transition-all hover:opacity-80"
                  style={{ background: 'rgba(99,102,241,0.3)', border: '1px solid rgba(99,102,241,0.4)' }}
                  onClick={() => onSelect(search.trim())}>
                  Send "{search.trim()}" to chat
                </button>
              )}
            </div>
          )}

          {!loading && groupOrder.map(cat => {
            const group = groups[cat]
            if (!group || group.length === 0) return null
            return (
              <div key={cat} className="mb-3">
                <p className="text-xs px-3 py-1.5 font-semibold uppercase tracking-wider"
                  style={{ color: 'rgba(255,255,255,0.25)' }}>
                  {categoryLabel[cat]}
                </p>
                {group.map(item => {
                  const idx = absoluteIndex++
                  const isActive = cursor === idx
                  return (
                    <button
                      key={item.id}
                      data-cursor={isActive ? 'true' : undefined}
                      className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-2xl text-left transition-all"
                      style={{
                        background: isActive ? 'rgba(99,102,241,0.2)' : 'transparent',
                        border: isActive ? '1px solid rgba(99,102,241,0.35)' : '1px solid transparent'
                      }}
                      onMouseEnter={() => setCursor(idx)}
                      onClick={() => select(item)}>
                      <span className="text-lg shrink-0">{item.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{item.label}</p>
                        {item.description && (
                          <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            {item.description}
                          </p>
                        )}
                      </div>
                      {isActive && (
                        <span className="text-xs shrink-0 px-1.5 py-0.5 rounded"
                          style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.06)' }}>
                          ↵
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between px-4 py-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center space-x-4 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>⌘K</span>
        </div>
      </div>
    </div>
  )
}
