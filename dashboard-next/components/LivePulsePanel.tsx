'use client'
import { useEffect, useRef, useState } from 'react'

const API = process.env.NEXT_PUBLIC_DEVOS_API || 'http://localhost:4200'

// agent_pulse event shape: { type: 'agent_pulse', agent, role, state, message, timestamp }
// state: 'thinking' | 'acting' | 'done' | 'error'
// browser_task event shape: { type: 'browser_task', taskId, state, liveViewUrl? }

type PulseState = 'thinking' | 'acting' | 'done' | 'error'

interface PulseEntry {
  id:         string
  agent:      string
  role:       string
  state:      PulseState
  message:    string
  timestamp:  string
  // optional LiveView metadata (set for browser tasks)
  taskId?:    string
  liveViewUrl?: string
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
    browser:    '🌐',
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
    browser:    '#0ea5e9',
  }
  return map[role?.toLowerCase()] ?? '#6366f1'
}

// ── noVNC LiveView modal ───────────────────────────────────────

// noVNC CDN — loads the full client as a single HTML page we embed in an iframe
const NOVNC_CDN = 'https://novnc.com/noVNC/vnc.html'

function LiveViewModal({ wsUrl, onClose }: { wsUrl: string; onClose: () => void }) {
  // Build noVNC URL with auto-connect and the WebSocket target embedded
  const iframeSrc = `${NOVNC_CDN}?autoconnect=1&reconnect=1&host=${encodeURIComponent('localhost')}&port=${encodeURIComponent(wsUrl.split(':')[2]?.split('/')[0] ?? '6100')}&path=${encodeURIComponent('websockify')}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative rounded-3xl overflow-hidden"
        style={{
          width:      '900px',
          height:     '620px',
          background: '#0a0f1a',
          border:     '1px solid rgba(14,165,233,0.3)',
          boxShadow:  '0 24px 80px rgba(0,0,0,0.8)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: '1px solid rgba(14,165,233,0.15)', background: 'rgba(14,165,233,0.05)' }}
        >
          <div className="flex items-center space-x-2">
            <span className="text-lg">🌐</span>
            <span className="text-sm font-semibold text-white">Browser LiveView</span>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(14,165,233,0.15)', color: '#0ea5e9' }}
            >
              LIVE
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-white opacity-40 hover:opacity-100 transition-opacity text-xl leading-none"
          >✕</button>
        </div>

        {/* noVNC iframe */}
        <iframe
          src={iframeSrc}
          title="Browser LiveView"
          style={{ width: '100%', height: 'calc(100% - 52px)', border: 'none' }}
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </div>
  )
}

// ── LivePulsePanel ────────────────────────────────────────────

export function LivePulsePanel() {
  const [entries, setEntries]         = useState<PulseEntry[]>([])
  const [connected, setConnected]     = useState(false)
  const [liveViewUrl, setLiveViewUrl] = useState<string | null>(null)
  const bottomRef                     = useRef<HTMLDivElement>(null)

  // ── SSE connection ──────────────────────────────────────────────────────
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
          } else if (event.type === 'browser_task') {
            // Browser task event — may carry a liveViewUrl
            entry = {
              id:          crypto.randomUUID(),
              agent:       'Browser',
              role:        'browser',
              state:       (event.state || 'acting') as PulseState,
              message:     event.message || `Browser task ${event.state || 'running'}: ${event.taskId || ''}`,
              timestamp:   new Date().toISOString(),
              taskId:      event.taskId,
              liveViewUrl: event.liveViewUrl ?? null,
            }
            // If this event carries a live URL, bubble it up to the top
            if (event.liveViewUrl && event.state !== 'done' && event.state !== 'error') {
              setLiveViewUrl(event.liveViewUrl)
            } else if (event.state === 'done' || event.state === 'error') {
              // Clear live view when task completes
              setLiveViewUrl(prev => (prev === event.liveViewUrl ? null : prev))
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

  // ── Auto-scroll to bottom ─────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries])

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <>
      {/* noVNC LiveView modal */}
      {liveViewUrl && (
        <LiveViewModal wsUrl={liveViewUrl} onClose={() => setLiveViewUrl(null)} />
      )}

      <div className="h-full flex flex-col"
        style={{
          background:    'rgba(255,255,255,0.02)',
          borderLeft:    '1px solid rgba(255,255,255,0.06)',
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
          <div className="flex items-center space-x-2">
            {/* Watch Live button — visible when a browser task is active */}
            {liveViewUrl && (
              <button
                onClick={() => setLiveViewUrl(liveViewUrl)}
                className="flex items-center space-x-1 text-xs px-2.5 py-1 rounded-xl font-semibold text-white transition-all hover:opacity-90"
                style={{
                  background: 'linear-gradient(135deg, #0ea5e9, #0ea5e966)',
                  boxShadow:  '0 0 8px rgba(14,165,233,0.4)',
                  animation:  'pulse 2s infinite',
                }}
              >
                <span>👁</span>
                <span>Watch Live</span>
              </button>
            )}
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
              {entries.length}/100
            </span>
          </div>
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
            const isBrowserTask = entry.role === 'browser' && entry.state === 'acting'

            return (
              <div key={entry.id} className="p-3 rounded-2xl"
                style={{
                  background:  'rgba(255,255,255,0.03)',
                  border:      `1px solid ${cfg.glow}`,
                  borderLeft:  `3px solid ${cfg.color}`
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

                {/* Watch Live inline button for browser tasks with a liveViewUrl */}
                {isBrowserTask && entry.liveViewUrl && (
                  <button
                    onClick={() => setLiveViewUrl(entry.liveViewUrl!)}
                    className="mt-2 flex items-center space-x-1 text-xs px-2.5 py-1 rounded-xl font-medium text-white transition-all hover:opacity-90"
                    style={{ background: 'rgba(14,165,233,0.2)', border: '1px solid rgba(14,165,233,0.35)', color: '#38bdf8' }}
                  >
                    <span>👁</span>
                    <span>Watch Live</span>
                  </button>
                )}
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      </div>
    </>
  )
}
