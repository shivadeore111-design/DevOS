'use client'
// dashboard-next/components/Sidebar.tsx
// Sprint 30: Aiden identity panel — level, title, XP progress bar, streak.
// Subscribes to SSE 'identity_update' events from api/server.ts.

import { useEffect, useState } from 'react'

interface AidenIdentity {
  level:         number
  title:         string
  xp:            number
  skillsLearned: number
  streakDays:    number
  topStrength:   string
  xpToNextLevel: number
  xpProgress:    number
  lastUpdated:   string
}

// Level colour scheme
const LEVEL_COLORS: Record<number, string> = {
  1: '#6b7280',  // gray
  2: '#3b82f6',  // blue
  3: '#22c55e',  // green
  4: '#f97316',  // orange
  5: '#eab308',  // gold
}

export default function Sidebar() {
  const [identity, setIdentity] = useState<AidenIdentity | null>(null)

  useEffect(() => {
    // Initial fetch
    fetch('http://localhost:4200/api/identity')
      .then(r => r.ok ? r.json() : null)
      .then((data: AidenIdentity | null) => { if (data) setIdentity(data) })
      .catch(() => {})

    // SSE subscription
    const es = new EventSource('http://localhost:4200/api/stream')
    es.addEventListener('identity_update', (e: MessageEvent) => {
      try { setIdentity(JSON.parse(e.data) as AidenIdentity) } catch {}
    })
    es.onerror = () => { es.close() }

    return () => { es.close() }
  }, [])

  if (!identity) return null

  const color      = LEVEL_COLORS[identity.level] ?? '#6b7280'
  const barPercent = Math.round(identity.xpProgress * 100)

  return (
    <div style={{
      background:   '#111',
      border:       '1px solid #222',
      borderRadius: '10px',
      padding:      '14px 16px',
      fontFamily:   'monospace',
      fontSize:     '13px',
      color:        '#e8e8e8',
      minWidth:     '220px',
    }}>
      {/* Name + level badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <span style={{ color, fontWeight: 700, fontSize: '14px' }}>Aiden</span>
        <span style={{
          background:   color + '22',
          border:       `1px solid ${color}55`,
          borderRadius: '4px',
          color,
          fontSize:     '11px',
          padding:      '1px 6px',
        }}>
          Lv {identity.level} {identity.title}
        </span>
      </div>

      {/* XP progress bar */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px', color: '#6b7280' }}>
          <span>{identity.xp} XP</span>
          {identity.level < 5 && <span>+{identity.xpToNextLevel} to next</span>}
        </div>
        <div style={{ background: '#222', borderRadius: '4px', height: '5px', overflow: 'hidden' }}>
          <div style={{
            background:    color,
            width:         `${barPercent}%`,
            height:        '100%',
            borderRadius:  '4px',
            transition:    'width 0.6s ease',
          }} />
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <Stat label="skills"   value={String(identity.skillsLearned)} color={color} />
        <Stat label="streak"   value={`${identity.streakDays}d`}      color={color} />
        <Stat label="strength" value={identity.topStrength}            color={color} />
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <span style={{ color, fontSize: '13px', fontWeight: 600 }}>{value}</span>
      <span style={{ color: '#4b5563', fontSize: '10px' }}>{label}</span>
    </div>
  )
}
