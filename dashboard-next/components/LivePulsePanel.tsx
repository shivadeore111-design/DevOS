'use client'
import { useEffect, useRef, useState } from 'react'

const API = process.env.NEXT_PUBLIC_DEVOS_API || 'http://localhost:4200'

// agent_pulse event shape: { type: 'agent_pulse', agent, role, state, message, timestamp }
// state: 'thinking' | 'acting' | 'done' | 'error'

type PulseState = 'thinking' | 'acting' | 'done' | 'error'

interface PulseEntry {
  id: string
  agent: string
  role: string
  state: PulseState
  message: string
  timestamp: string
}

const STATE_CONFIG: Record<PulseState, { color: string; glow: string; dot: string }> = {
  thinking: { color: '#6366f1', glow: 'rgba(99,102,241,0.25)',  dot: '#818cf8' },
  acting:   { color: '#eab308', glow: 'rgba(234,179,8,0.25)',   dot: '#fbbf24' },
  done:     { color: '#22c55e', glow: 'rgba(34,197,94,0.25)',   dot: '#4ade80' },
  error:    { color: '#ef4444', glow: 'rgba(239,68,68,0.25)',   dot: '#f87171' },
}

/** Role → short 2-char abbreviation for avatar */
function roleAvatar(role: string): string {
  const map: Record<string, string> = {
    ceo:        'CE',
    engineer:   'EN',
    researcher: 'RE',
    planner:    'PL',
    reviewer:   'RV',
    pilot:      'PT',
    devos:      'DV',
  }
  return map[role?.toLowerCase()] ?? role?.slice(0, 2).toUpperCase() ?? '??'
}

/** Role → accent color (distinct per agent type) */
function roleColor(role: string): string {
  const map: Record<string, string> = {
    ceo:        '#6366f1',
    engineer:   '#06b6d4',
    researcher: '#8b5cf6',
    planner:    '#f59e0b',
    reviewer:   '#ec4899',
    pilot:      '#10b981',
    devos:      '#6366f1',
  }
  return map[role?.toLowerCase()] ?? '#6366f1'
}

export function LivePulsePanel() {
  const [entries, setEntries] = useState<PulseEntry[]>([])
  const [connected, setConnected] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // ── SSE connection ─────────────────────────────────────────────────────
  useEffect(() => {
    let es: EventSource
    let retryTimer: ReturnType<typeof setTimeout>

    const connect = () => {
      es = new EventSource(`${API}/api/stream`)
      es.onopen = () => setConnected(true)
      es.onerror = () => {
        setConnected(false)
        es.close()
        retryTimer = setTimeout(connect, 5000)
      }

      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data)
          let entry: PulseEntry | null = null

          if (event.type === 'agent_pulse') {
            // Primary: dedicated LivePulse event
            entry = {
              id:        crypto.randomUUID(),
              agent:     event.agent     || 'DevOS',
              role:      event.role      || event.agent || 'devos',
              state:     (event.state    || 'thinking') as PulseState,
              message:   event.message   || '',
              timestamp: event.timestamp || new Date().toISOString(),
            }
          } else if (event.type === 'agent_thinking') {
            entry = {
              id:        crypto.randomUUID(),
              agent:     event.agent || 'DevOS',
              role:      event.agent || 'devos',
              state:     'thinking',
              message:   event.message || '',
              timestamp: new Date().toISOString(),
            }
          } else if (event.type === 'goal_started') {
            entry = {
              id:        crypto.randomUUID(),
              agent:     'CEO',
              role:      'ceo',
              state:     'acting',
              message:   `Goal started: ${event.title || event.goalId || ''}`,
              timestamp: new Date().toISOString(),
            }
          } else if (event.type === 'goal_completed') {
            entry = {
              id:        crypto.randomUUID(),
              agent:     'CEO',
              role:      'ceo',
              state:     'done',
              message:   `Goal completed: ${event.title || event.goalId || ''}`,
              timestamp: new Date().toISOString(),
            }
          } else if (event.type === 'goal_failed') {
            entry = {
              id:        crypto.randomUUID(),
              agent:     'CEO',
              role:      'ceo',
              state:     'error',
              message:   `Goal failed: ${event.title || event.error || ''}`,
              timestamp: new Date().toISOString(),
            }
          } else if (event.type === 'task_completed') {
            entry = {
              id:        crypto.randomUUID(),
              agent:     event.agent || 'Engineer',
              role:      event.role  || 'engineer',
              state:     'done',
              message:   `✓ ${event.title || event.taskId || 'Task done'}`,
              timestamp: new Date().toISOString(),
            }
          } else if (event.type === 'task_failed') {
            entry = {
              id:        crypto.randomUUID(),
              agent:     event.agent || 'Engineer',
              role:      event.role  || 'engineer',
              state:     'error',
              message:   `✗ ${event.title || event.taskId || 'Task failed'}`,
              timestamp: new Date().toISOString(),
            }
          } else if (event.type === 'mission:complete') {
            entry = {
              id:        crypto.randomUUID(),
              agent:     'CEO',
              role:      'ceo',
              state:     'done',
              message:   `Mission complete: ${event.goal || ''}`,
              timestamp: new Date().toISOString(),
            }
          }

          if (entry) {
            setEntries(prev => [...prev, entry!].slice(-100))  // max 100
          }
        } catch { /* ignore */ }
      }
    }

    connect()
    return () => {
      es?.close()
      clearTimeout(retryTimer)
    }
  }, [])

  // ── Auto-scroll to bottom ──────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries])

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col"
      style={{
        background: 'rgba(255,255,255,0.02)',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)'
      }}>

      {/* Header */}
      <div className="px-4 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-semibold text-white">LivePulse</span>
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-gray-600'}`}
            style={connected ? { boxShadow: '0 0 6px #4ade80', animation: 'pulse 2s infinite' } : {}} />
        </div>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
          {entries.length}/100
        </span>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {!connected && entries.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🔌</p>
            <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>Connecting...</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.15)' }}>Start DevOS server</p>
            <code className="text-xs mt-2 block" style={{ color: 'rgba(99,102,241,0.7)' }}>
              npx ts-node index.ts serve
            </code>
          </div>
        )}
        {connected && entries.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">⚡</p>
            <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>Ready</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.15)' }}>
              Agent activity will appear here
            </p>
          </div>
        )}

        {entries.map(entry => {
          const cfg   = STATE_CONFIG[entry.state] || STATE_CONFIG.thinking
          const color = roleColor(entry.role)
          return (
            <div key={entry.id} className="p-3 rounded-2xl"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${cfg.glow}`,
                borderLeft: `3px solid ${cfg.color}`
              }}>
              {/* Agent avatar + name + time */}
              <div className="flex items-center space-x-2 mb-1.5">
                <div className="w-5 h-5 rounded-md flex items-center justify-center text-white shrink-0"
                  style={{ background: color, fontSize: '9px', fontWeight: 700 }}>
                  {roleAvatar(entry.role)}
                </div>
                <span className="text-xs font-semibold" style={{ color }}>
                  {entry.agent}
                </span>
                {/* State badge */}
                <span className="text-xs px-1.5 py-0.5 rounded-full ml-auto"
                  style={{ background: cfg.glow, color: cfg.dot, fontSize: '10px' }}>
                  {entry.state}
                </span>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
              {/* Message */}
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {entry.message.slice(0, 140)}
              </p>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
