'use client'
import { useEffect, useState } from 'react'

const API = process.env.NEXT_PUBLIC_DEVOS_API || 'http://localhost:4200'

interface FeedItem {
  id: string
  type: 'thinking' | 'acting' | 'done' | 'error' | 'goal' | 'mission'
  agent?: string
  message: string
  timestamp: string
}

const TYPE_CONFIG: Record<string, { color: string, glow: string, label: string }> = {
  thinking: { color: '#6366f1', glow: 'rgba(99,102,241,0.3)',  label: 'Thinking' },
  acting:   { color: '#eab308', glow: 'rgba(234,179,8,0.3)',   label: 'Acting'   },
  done:     { color: '#22c55e', glow: 'rgba(34,197,94,0.3)',   label: 'Done'     },
  error:    { color: '#ef4444', glow: 'rgba(239,68,68,0.3)',   label: 'Error'    },
  goal:     { color: '#6366f1', glow: 'rgba(99,102,241,0.3)',  label: 'Goal'     },
  mission:  { color: '#8b5cf6', glow: 'rgba(139,92,246,0.3)', label: 'Mission'  },
}

export function AgentFeed() {
  const [items, setItems] = useState<FeedItem[]>([])
  const [connected, setConnected] = useState(false)

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
          const type = event.type || 'info'
          let item: FeedItem | null = null

          if (type === 'agent_thinking') {
            item = {
              id:        crypto.randomUUID(),
              type:      event.thinkingType || 'thinking',
              agent:     event.agent || 'DevOS',
              message:   event.message || '',
              timestamp: new Date().toISOString()
            }
          } else if (type === 'goal_started') {
            item = {
              id:        crypto.randomUUID(),
              type:      'acting',
              agent:     'CEO',
              message:   `🎯 Goal started: ${event.title || event.goalId || ''}`,
              timestamp: new Date().toISOString()
            }
          } else if (type === 'goal_completed') {
            item = {
              id:        crypto.randomUUID(),
              type:      'done',
              agent:     'CEO',
              message:   `✅ Goal completed: ${event.title || event.goalId || ''}`,
              timestamp: new Date().toISOString()
            }
          } else if (type === 'goal_failed') {
            item = {
              id:        crypto.randomUUID(),
              type:      'error',
              agent:     'CEO',
              message:   `❌ Goal failed: ${event.title || event.goalId || ''}`,
              timestamp: new Date().toISOString()
            }
          } else if (type === 'task_completed') {
            item = {
              id:        crypto.randomUUID(),
              type:      'done',
              agent:     'Engineer',
              message:   `✓ ${event.title || event.taskId || 'Task done'}`,
              timestamp: new Date().toISOString()
            }
          } else if (type === 'task_failed') {
            item = {
              id:        crypto.randomUUID(),
              type:      'error',
              agent:     'Engineer',
              message:   `✗ ${event.title || event.taskId || 'Task failed'}`,
              timestamp: new Date().toISOString()
            }
          } else if (type === 'mission:complete') {
            item = {
              id:        crypto.randomUUID(),
              type:      'done',
              agent:     'CEO',
              message:   `🚀 Mission complete: ${event.goal || ''}`,
              timestamp: new Date().toISOString()
            }
          } else if (type === 'pilot_completed') {
            item = {
              id:        crypto.randomUUID(),
              type:      'done',
              agent:     'Pilot',
              message:   `🔍 Pilot run complete: ${event.pilotId || ''}`,
              timestamp: new Date().toISOString()
            }
          }

          if (item) setItems(prev => [item!, ...prev].slice(0, 100))
        } catch {}
      }
    }

    connect()
    return () => { es?.close(); clearTimeout(retryTimer) }
  }, [])

  return (
    <div className="h-full flex flex-col"
      style={{
        background: 'rgba(255,255,255,0.02)',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)'
      }}>

      <div className="px-4 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-semibold text-white">Activity</span>
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-gray-600'}`}
            style={connected ? { boxShadow: '0 0 6px #4ade80' } : {}} />
        </div>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>{items.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {!connected && items.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🔌</p>
            <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>Connecting...</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.15)' }}>Start DevOS server</p>
            <code className="text-xs mt-2 block" style={{ color: 'rgba(99,102,241,0.7)' }}>npx ts-node index.ts serve</code>
          </div>
        )}
        {connected && items.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">⚡</p>
            <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>Ready</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.15)' }}>Activity will appear here</p>
          </div>
        )}
        {items.map(item => {
          const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.thinking
          return (
            <div key={item.id} className="p-3 rounded-2xl"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${cfg.glow}`,
                borderLeft: `3px solid ${cfg.color}`
              }}>
              {item.agent && (
                <div className="flex items-center space-x-1.5 mb-1">
                  <div className="w-4 h-4 rounded-lg flex items-center justify-center"
                    style={{ background: cfg.color, color: 'white', fontSize: '8px' }}>
                    {item.agent.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-xs font-medium" style={{ color: cfg.color }}>{item.agent}</span>
                  <span className="text-xs ml-auto" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {item.message.slice(0, 120)}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
