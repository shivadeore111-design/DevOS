'use client'
import { useEffect, useState, useRef } from 'react'
import { api } from '../lib/api'

interface FeedEvent {
  id: string
  type: 'thinking' | 'acting' | 'done' | 'error'
  agent: string
  message: string
  timestamp: string
  missionId?: string
}

const TYPE_COLOR: Record<string, string> = {
  thinking: 'var(--devos-accent)',
  acting: 'var(--devos-yellow)',
  done: 'var(--devos-green)',
  error: 'var(--devos-red)'
}

const AGENT_ABBR: Record<string, string> = {
  CEO: 'CE', Engineer: 'EN', Designer: 'DS',
  QA: 'QA', Research: 'RE', Marketing: 'MK', Deployment: 'DP', Operator: 'OP'
}

export function AgentFeed() {
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const topRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const es = api.stream()
    es.onmessage = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data)
        if (event.type === 'agent_thinking') {
          setEvents(prev => [{
            id: Date.now().toString(),
            type: event.thinkingType || 'thinking',
            agent: event.agent || 'DevOS',
            message: event.message || '',
            timestamp: event.timestamp || new Date().toISOString(),
            missionId: event.missionId
          }, ...prev].slice(0, 100))
        }
      } catch {}
    }
    return () => es.close()
  }, [])

  return (
    <div className="h-full flex flex-col border-l"
      style={{ borderColor: 'var(--devos-border)', background: 'var(--devos-surface)' }}>
      <div className="px-4 py-3 border-b flex items-center space-x-2"
        style={{ borderColor: 'var(--devos-border)' }}>
        <span className="text-sm font-semibold" style={{ color: 'var(--devos-text)' }}>AI Activity</span>
        {events.length > 0 && (
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        )}
        <span className="text-xs ml-auto" style={{ color: 'var(--devos-muted)' }}>{events.length}</span>
      </div>
      <div ref={topRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {events.length === 0 && (
          <p className="text-xs text-center mt-8" style={{ color: 'var(--devos-muted)' }}>
            Waiting for agent activity...
          </p>
        )}
        {events.map(event => (
          <div key={event.id}
            className="rounded-lg p-2 border-l-2 cursor-pointer"
            style={{
              background: 'var(--devos-bg)',
              borderLeftColor: TYPE_COLOR[event.type] || 'var(--devos-border)'
            }}
            onClick={() => setExpanded(expanded === event.id ? null : event.id)}>
            <div className="flex items-center space-x-2 mb-1">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: TYPE_COLOR[event.type], color: 'white' }}>
                {AGENT_ABBR[event.agent] || event.agent.slice(0,2).toUpperCase()}
              </div>
              <span className="text-xs font-medium" style={{ color: 'var(--devos-text)' }}>{event.agent}</span>
              <span className="text-xs ml-auto" style={{ color: 'var(--devos-muted)' }}>
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <p className="text-xs" style={{ color: 'var(--devos-muted)' }}>
              {expanded === event.id ? event.message : event.message.slice(0, 80) + (event.message.length > 80 ? '...' : '')}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
