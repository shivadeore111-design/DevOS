'use client'
// dashboard-next/components/CostBadge.tsx
// Sprint 28: Cost badge showing today's LLM spend.
// Displays "$0.47 today" next to the active provider indicator.
// Click to expand per-provider breakdown.

import { useState, useEffect, useRef } from 'react'

interface DailyCost {
  date:           string
  totalUSD:       number
  systemUSD:      number
  userUSD:        number
  byProvider:     Record<string, number>
  entryCount:     number
  budgetCapUSD:   number
  budgetExceeded: boolean
  lastUpdated:    number
}

export default function CostBadge() {
  const [cost,    setCost]    = useState<DailyCost | null>(null)
  const [open,    setOpen]    = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Initial fetch
  useEffect(() => {
    fetch('http://localhost:4200/api/cost')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setCost(d as DailyCost) })
      .catch(() => {})
  }, [])

  // Listen for cost_update over WebSocket
  useEffect(() => {
    let ws: WebSocket | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      try {
        ws = new WebSocket('ws://localhost:4200')
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data)
            if (msg.type === 'cost_update' && msg.data) {
              setCost(msg.data as DailyCost)
            }
          } catch {}
        }
        ws.onerror = () => {}
        ws.onclose = () => {
          retryTimer = setTimeout(connect, 5000)
        }
      } catch {}
    }
    connect()
    return () => {
      if (ws) { ws.onclose = null; ws.close() }
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (!cost) return null

  const total     = cost.totalUSD
  const exceeded  = cost.budgetExceeded
  const cap       = cost.budgetCapUSD
  const providers = Object.entries(cost.byProvider).sort((a, b) => b[1] - a[1])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Today's LLM cost — click for breakdown"
        style={{
          display:        'inline-flex',
          alignItems:     'center',
          gap:            '4px',
          padding:        '2px 8px',
          borderRadius:   '9999px',
          fontSize:       '11px',
          fontWeight:     500,
          fontFamily:     'monospace',
          border:         '1px solid',
          cursor:         'pointer',
          background:     exceeded ? 'rgba(239,68,68,0.15)' : 'rgba(249,115,22,0.12)',
          borderColor:    exceeded ? '#ef4444'               : 'rgba(249,115,22,0.3)',
          color:          exceeded ? '#ef4444'               : '#f97316',
          transition:     'all 0.2s',
        }}
      >
        <span style={{ opacity: 0.7 }}>💰</span>
        <span>${total.toFixed(4)} today</span>
        {exceeded && <span title="Daily budget exceeded">⚠️</span>}
      </button>

      {open && (
        <div style={{
          position:        'absolute',
          top:             'calc(100% + 6px)',
          right:           0,
          zIndex:          100,
          minWidth:        '200px',
          background:      '#1a1a1a',
          border:          '1px solid rgba(249,115,22,0.3)',
          borderRadius:    '8px',
          padding:         '12px',
          boxShadow:       '0 8px 24px rgba(0,0,0,0.6)',
          fontSize:        '12px',
          color:           '#e8e8e8',
        }}>
          <div style={{ fontWeight: 600, marginBottom: '8px', color: '#f97316' }}>
            Cost breakdown — {cost.date}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ opacity: 0.7 }}>User cost</span>
            <span style={{ fontFamily: 'monospace' }}>${cost.userUSD.toFixed(6)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ opacity: 0.7 }}>System (background)</span>
            <span style={{ fontFamily: 'monospace' }}>${cost.systemUSD.toFixed(6)}</span>
          </div>

          {cap > 0 && (
            <div style={{ marginBottom: '8px', padding: '4px 8px', borderRadius: '4px', background: exceeded ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.1)', color: exceeded ? '#ef4444' : '#22c55e', fontSize: '11px' }}>
              Budget: ${cost.userUSD.toFixed(4)} / ${cap.toFixed(2)} {exceeded ? '— EXCEEDED' : `(${Math.round((cost.userUSD / cap) * 100)}%)`}
            </div>
          )}

          {providers.length > 0 && (
            <>
              <div style={{ opacity: 0.5, fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>By provider</div>
              {providers.map(([p, c]) => (
                <div key={p} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ opacity: 0.8 }}>{p}</span>
                  <span style={{ fontFamily: 'monospace', opacity: 0.9 }}>${c.toFixed(6)}</span>
                </div>
              ))}
            </>
          )}

          <div style={{ marginTop: '8px', opacity: 0.4, fontSize: '10px' }}>
            {cost.entryCount} calls today
          </div>
        </div>
      )}
    </div>
  )
}
