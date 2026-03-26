"use client"
import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import Onboarding from '../components/Onboarding'

// ── Types ────────────────────────────────────────────────────

interface ActivityItem {
  icon:     string
  agent:    string
  message:  string
  style:    'act' | 'done' | 'error' | 'warn' | 'info' | 'thinking' | 'tool'
  tool?:    string
  command?: string
  output?:  string
}

interface Message {
  role:         'user' | 'devos'
  content:      string
  time:         string
  streaming?:   boolean
  provider?:    string
  activities?:  ActivityItem[]
}

type Tab = 'chat' | 'settings'

// ── Suggestion chips ─────────────────────────────────────────

const CHIPS = [
  'What can you do?',
  'Show system status',
  'Research quantum computing',
  'Run a quick benchmark',
  'Explain my codebase',
]

// ── Provider metadata ─────────────────────────────────────────

const PROVIDER_INFO: Record<string, {
  label: string; color: string; freeUrl: string; defaultModel: string; models: string[]
}> = {
  groq:       { label:'Groq',       color:'#f55036', freeUrl:'https://console.groq.com',                    defaultModel:'llama-3.3-70b-versatile',          models:['llama-3.3-70b-versatile','llama-3.1-70b-versatile','mixtral-8x7b-32768','gemma2-9b-it'] },
  gemini:     { label:'Gemini',     color:'#4285f4', freeUrl:'https://aistudio.google.com/app/apikey',      defaultModel:'gemini-1.5-flash',                 models:['gemini-1.5-flash','gemini-1.5-pro','gemini-2.0-flash-exp'] },
  openrouter: { label:'OpenRouter', color:'#7c3aed', freeUrl:'https://openrouter.ai/keys',                  defaultModel:'meta-llama/llama-3.3-70b-instruct', models:['meta-llama/llama-3.3-70b-instruct','google/gemini-flash-1.5','mistralai/mistral-7b-instruct:free'] },
  cerebras:   { label:'Cerebras',   color:'#059669', freeUrl:'https://cloud.cerebras.ai',                   defaultModel:'llama3.1-8b',                      models:['llama3.1-8b','llama3.3-70b'] },
  nvidia:     { label:'NVIDIA NIM', color:'#76b900', freeUrl:'https://build.nvidia.com/explore/discover',   defaultModel:'meta/llama-3.3-70b-instruct',      models:['meta/llama-3.3-70b-instruct','meta/llama-3.1-405b-instruct','mistralai/mistral-7b-instruct-v0.3'] },
}

// ── Intent detection ─────────────────────────────────────────

function detectMode(text: string): string {
  const lower = text.toLowerCase()
  if (/research|deep|analyze|analyse|compare|report|explain in detail/.test(lower)) return 'deep'
  if (/build|create|make|run|execute|goal|start|launch/.test(lower))               return 'goal'
  return 'speed'
}

// ── Blinking cursor component ─────────────────────────────────

function Cursor() {
  return (
    <span style={{
      display:       'inline-block',
      width:         '2px',
      height:        '14px',
      background:    '#63b3ed',
      marginLeft:    '2px',
      verticalAlign: 'text-bottom',
      animation:     'pulse 1s ease infinite',
    }} />
  )
}

// ── ActivityLog component ─────────────────────────────────────

const STYLE_COLORS: Record<string, string> = {
  act:      '#f97316',
  done:     '#22c55e',
  error:    '#f87171',
  warn:     '#fbbf24',
  info:     '#60a5fa',
  thinking: '#a78bfa',
  tool:     '#34d399',
}

function ActivityLog({ items }: { items: ActivityItem[] }) {
  if (!items.length) return null
  return (
    <div style={{ marginBottom:'10px', display:'flex', flexDirection:'column', gap:'3px' }}>
      {items.map((item, i) => (
        <div key={i} style={{
          display:'flex', alignItems:'flex-start', gap:'8px',
          background:'rgba(255,255,255,0.025)',
          border:`1px solid ${STYLE_COLORS[item.style] ?? '#888'}22`,
          borderRadius:'7px', padding:'6px 10px',
        }}>
          <span style={{ fontSize:'13px', lineHeight:'1.4', flexShrink:0 }}>{item.icon}</span>
          <div style={{ flex:1, minWidth:0 }}>
            <span style={{
              fontSize:'10px', fontFamily:'monospace', fontWeight:600,
              color: STYLE_COLORS[item.style] ?? 'rgba(255,255,255,0.4)',
              marginRight:'6px',
            }}>{item.agent}</span>
            <span style={{
              fontSize:'11px', fontFamily:'monospace',
              color:'rgba(255,255,255,0.55)',
              overflowWrap:'break-word', wordBreak:'break-all',
            }}>{item.message}</span>
            {item.output && (
              <div style={{
                marginTop:'3px', fontSize:'10px', fontFamily:'monospace',
                color:'rgba(255,255,255,0.3)', paddingLeft:'2px',
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
              }}>→ {item.output.slice(0, 100)}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────

export default function Home() {
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null)
  const [userName, setUserName]             = useState('there')

  // ── Session ID — persists across refreshes of this tab, new tab = new session ──
  const [sessionId] = useState<string>(() => {
    if (typeof window === 'undefined') return `session_${Date.now()}`
    const stored = sessionStorage.getItem('devos_session')
    if (stored) return stored
    const newId = `session_${Date.now()}`
    sessionStorage.setItem('devos_session', newId)
    return newId
  })

  // ── Check onboarding status on mount ─────────────────────────
  useEffect(() => {
    fetch('http://localhost:4200/api/onboarding')
      .then(r => r.json())
      .then((d: any) => {
        setOnboardingDone(d.onboardingComplete ?? true)
        if (d.userName && d.userName !== 'there') setUserName(d.userName)
      })
      .catch(() => setOnboardingDone(true))
  }, [])

  const [tab, setTab]               = useState<Tab>('chat')
  const [messages, setMessages]     = useState<Message[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem('devos_chat') || '[]') } catch { return [] }
  })
  const [history, setHistory]       = useState<{role:string;content:string}[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem('devos_history') || '[]') } catch { return [] }
  })
  const [input, setInput]           = useState('')
  const [streaming, setStreaming]   = useState(false)
  const [apiStatus, setApiStatus]   = useState<'online'|'offline'>('offline')
  const [execMode, setExecMode]     = useState<'auto'|'plan'|'chat'>('auto')
  const [model, setModel]           = useState('mistral:7b')
  const [activeModel, setActiveModel] = useState('')

  // ── Settings state ───────────────────────────────────────────
  const [providers, setProviders]           = useState<any[]>([])
  const [routing, setRouting]               = useState<any>({ mode: 'auto', fallbackToOllama: true })
  const [addingProvider, setAddingProvider] = useState<string | null>(null)
  const [newKey, setNewKey]                 = useState('')
  const [newModel, setNewModel]             = useState('')
  const [savingKey, setSavingKey]           = useState(false)
  const [recentPlans, setRecentPlans]       = useState<any[]>([])

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const abortRef  = useRef<AbortController | null>(null)

  // ── Persist messages ────────────────────────────────────────
  useEffect(() => {
    try { localStorage.setItem('devos_chat', JSON.stringify(messages.slice(-50))) } catch {}
  }, [messages])

  // ── Scroll to bottom ────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  // ── API health check ────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch('http://localhost:4200/api/health')
        setApiStatus(r.ok ? 'online' : 'offline')
      } catch { setApiStatus('offline') }
    }
    check()
    const iv = setInterval(check, 10_000)
    return () => clearInterval(iv)
  }, [])


  // ── Read active model + config ──────────────────────────────
  useEffect(() => {
    fetch('http://localhost:4200/api/config')
      .then(r => r.json())
      .then((d: any) => {
        if (d?.activeModel) { setModel(d.activeModel); setActiveModel(d.activeModel) }
        if (d?.userName && d.userName !== 'there') setUserName(d.userName)
      })
      .catch(() => {
        // Fallback to onboarding endpoint
        fetch('http://localhost:4200/api/onboarding')
          .then(r => r.json())
          .then((d: any) => {
            if (d?.activeModel?.activeModel) { setModel(d.activeModel.activeModel); setActiveModel(d.activeModel.activeModel) }
          })
          .catch(() => {})
      })
  }, [])

  // ── Load providers + recent plans when Settings tab opens ──
  useEffect(() => {
    if (tab !== 'settings') return
    fetch('http://localhost:4200/api/providers')
      .then(r => r.json())
      .then((d: any) => {
        setProviders(d.apis || [])
        setRouting(d.routing || { mode: 'auto', fallbackToOllama: true })
      })
      .catch(() => {})
  }, [tab])

  useEffect(() => {
    if (tab !== 'settings') return
    fetch('http://localhost:4200/api/plans/recent')
      .then(r => r.json())
      .then((d: any) => setRecentPlans(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [tab])

  // ── Escape key stops streaming ──────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && streaming) stopStreaming()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [streaming])

  // ── Stop streaming ──────────────────────────────────────────
  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
    setMessages(prev => prev.map((m, i) =>
      i === prev.length - 1 ? { ...m, streaming: false } : m
    ))
  }, [])

  // ── Settings helpers ─────────────────────────────────────────
  const saveKey = async (providerID: string) => {
    if (!newKey.trim()) return
    setSavingKey(true)
    try {
      await fetch('http://localhost:4200/api/providers/add', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ provider: providerID, key: newKey.trim(), model: newModel || undefined }),
      })
      setNewKey('')
      setNewModel('')
      setAddingProvider(null)
      const d = await fetch('http://localhost:4200/api/providers').then(r => r.json()) as any
      setProviders(d.apis || [])
    } catch {}
    setSavingKey(false)
  }

  const toggleProvider = async (name: string, enabled: boolean) => {
    await fetch(`http://localhost:4200/api/providers/${encodeURIComponent(name)}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ enabled }),
    }).catch(() => {})
    setProviders(prev => prev.map((p: any) => p.name === name ? { ...p, enabled } : p))
  }

  const deleteProvider = async (name: string) => {
    if (!window.confirm(`Remove ${name}?`)) return
    await fetch(`http://localhost:4200/api/providers/${encodeURIComponent(name)}`, { method: 'DELETE' }).catch(() => {})
    setProviders(prev => prev.filter((p: any) => p.name !== name))
  }

  const resetLimits = async () => {
    await fetch('http://localhost:4200/api/providers/reset-limits', { method: 'POST' }).catch(() => {})
    setProviders(prev => prev.map((p: any) => ({ ...p, rateLimited: false })))
  }

  // ── Send message ────────────────────────────────────────────
  const send = useCallback(async (override?: string) => {
    const msg = (override ?? input).trim()
    if (!msg || streaming) return
    setInput('')
    if (inputRef.current) { inputRef.current.style.height = 'auto' }

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    setMessages(prev => [...prev, { role: 'user', content: msg, time }])
    setStreaming(true)

    const mode       = detectMode(msg)
    const newHistory = [...history, { role: 'user', content: msg }]
    setHistory(newHistory)

    setMessages(prev => [...prev, { role: 'devos', content: '', time, streaming: true }])

    try {
      if (mode === 'goal') {
        const r    = await fetch('http://localhost:4200/api/goals', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ title: msg, description: msg }),
        })
        const data  = await r.json()
        const reply = data.message || 'Goal started — watch the activity feed below.'
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { role: 'devos', content: reply, time, streaming: false }
          return next
        })
        const updatedHistory = [...newHistory, { role: 'assistant', content: reply }]
        setHistory(updatedHistory)
        try { localStorage.setItem('devos_history', JSON.stringify(updatedHistory.slice(-20))) } catch {}
        setStreaming(false)
        setTimeout(() => inputRef.current?.focus(), 50)
        return
      }

      const controller = new AbortController()
      abortRef.current = controller

      const r = await fetch('http://localhost:4200/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: msg, history: newHistory.slice(-10), mode: execMode, sessionId }),
        signal:  controller.signal,
      })

      if (!r.ok || !r.body) throw new Error('Stream failed')

      const reader  = r.body.getReader()
      const decoder = new TextDecoder()
      let   buf     = ''
      let   full    = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const payload = JSON.parse(line.slice(6))
            if (payload.error) {
              setMessages(prev => {
                const next = [...prev]
                next[next.length - 1] = { role: 'devos', content: payload.error, time, streaming: false }
                return next
              })
              break
            }
            // Structured activity event from execute intent
            if (payload.activity) {
              const item = payload.activity as ActivityItem
              setMessages(prev => {
                const next = [...prev]
                const last = next[next.length - 1]
                next[next.length - 1] = {
                  ...last,
                  activities: [...(last.activities || []), item],
                  streaming: !payload.done,
                  provider: payload.done ? (payload.provider || last.provider) : last.provider,
                }
                return next
              })
            }
            if (payload.token) {
              full += payload.token
              setMessages(prev => {
                const next = [...prev]
                next[next.length - 1] = { role: 'devos', content: full, time, streaming: true }
                return next
              })
            }
            if (payload.done && !payload.activity) {
              setMessages(prev => {
                const next = [...prev]
                next[next.length - 1] = {
                  role: 'devos', content: full, time, streaming: false,
                  provider: payload.provider || next[next.length - 1]?.provider,
                }
                return next
              })
            }
          } catch {}
        }
      }

      // Seal message
      setMessages(prev => {
        const next = [...prev]
        if (next[next.length - 1]?.streaming) {
          next[next.length - 1] = { ...next[next.length - 1], streaming: false }
        }
        return next
      })

      const updatedHistory = [...newHistory, { role: 'assistant', content: full }]
      setHistory(updatedHistory)
      try { localStorage.setItem('devos_history', JSON.stringify(updatedHistory.slice(-20))) } catch {}

    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = {
            role: 'devos',
            content: "I can't reach the DevOS API. Make sure the server is running.",
            time, streaming: false,
          }
          return next
        })
      }
    }

    setStreaming(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [input, streaming, history])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const clearChat = () => {
    setMessages([])
    setHistory([])
    localStorage.removeItem('devos_chat')
    localStorage.removeItem('devos_history')
    fetch('http://localhost:4200/api/memory', { method: 'DELETE' }).catch(() => {})
  }

  // ── Loading splash ────────────────────────────────────────────
  if (onboardingDone === null) return (
    <div style={{
      height:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'#060d1f', color:'rgba(255,255,255,0.25)',
      fontFamily:'monospace', fontSize:'12px',
    }}>
      loading...
    </div>
  )

  // ── First-run onboarding ──────────────────────────────────────
  if (!onboardingDone) return (
    <Onboarding onComplete={(name) => { setUserName(name); setOnboardingDone(true) }} />
  )

  // ── Render ───────────────────────────────────────────────────
  return (
    <div style={{
      height:        '100vh',
      display:       'flex',
      flexDirection: 'column',
      background:    'radial-gradient(ellipse at 30% 20%, #0a1628 0%, #060d1f 50%, #030812 100%)',
      color:         '#e8e8e8',
      overflow:      'hidden',
    }}>

      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav style={{
        flexShrink:   0,
        height:       '48px',
        display:      'flex',
        alignItems:   'center',
        padding:      '0 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background:   'rgba(6,13,31,0.9)',
        gap:          '10px',
      }}>
        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <div style={{
            width:'28px', height:'28px',
            background:'rgba(99,179,237,0.15)',
            border:'1px solid rgba(99,179,237,0.3)',
            borderRadius:'7px',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#63b3ed" strokeWidth="2">
              <rect x="3"  y="3"  width="7" height="7" rx="1"/>
              <rect x="14" y="3"  width="7" height="7" rx="1"/>
              <rect x="3"  y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </div>
          <span style={{ fontSize:'14px', fontWeight:700 }}>DevOS</span>
          <span style={{ fontSize:'10px', color:'#f97316', fontFamily:'monospace' }}>v1.0</span>
        </div>

        {/* API dot */}
        <div style={{ display:'flex', alignItems:'center', gap:'5px', marginLeft:'8px' }}>
          <div style={{
            width:'6px', height:'6px', borderRadius:'50%',
            background: apiStatus === 'online' ? '#22c55e' : '#f87171',
          }}/>
          <span style={{ fontSize:'11px', fontFamily:'monospace', color: apiStatus === 'online' ? '#22c55e' : '#f87171' }}>
            {apiStatus === 'online' ? `${providers.filter(p => p.enabled && !p.rateLimited).length || '0'} APIs live` : 'server offline'}
          </span>
        </div>
        {activeModel && (
          <span style={{
            fontSize:'10px', fontFamily:'monospace',
            color:'rgba(255,255,255,0.2)', marginLeft:'8px',
          }}>
            {activeModel}
          </span>
        )}

        {/* Tabs */}
        <div style={{ display:'flex', gap:'4px', marginLeft:'16px' }}>
          {(['chat', 'settings'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              fontSize:'11px', fontFamily:'monospace',
              color:      tab === t ? '#63b3ed' : 'rgba(255,255,255,0.3)',
              background: tab === t ? 'rgba(99,179,237,0.1)' : 'transparent',
              border:     tab === t ? '1px solid rgba(99,179,237,0.25)' : '1px solid transparent',
              borderRadius:'4px', padding:'3px 10px', cursor:'pointer',
              transition:'all .15s',
            }}>{t}</button>
          ))}
        </div>

        {/* Right actions */}
        <div style={{ marginLeft:'auto', display:'flex', gap:'6px' }}>
          {tab === 'chat' && (
            <button onClick={clearChat} style={{
              fontSize:'10px', fontFamily:'monospace',
              color:'rgba(255,255,255,0.3)', background:'transparent',
              border:'1px solid rgba(255,255,255,0.08)',
              borderRadius:'4px', padding:'3px 8px', cursor:'pointer',
            }}>clear chat</button>
          )}
        </div>
      </nav>

      {/* ── BODY ────────────────────────────────────────────── */}
      {tab === 'settings' ? (

        /* ── SETTINGS PANEL ─────────────────────────────────── */
        <div style={{ flex:1, overflowY:'auto', padding:'24px 16px' }}>
          <div style={{ maxWidth:'640px', margin:'0 auto', display:'flex', flexDirection:'column', gap:'16px' }}>

            {/* Recent Tasks */}
            {recentPlans.length > 0 && (
              <div style={{ marginBottom: '8px' }}>
                <div style={{
                  fontSize: '10px', fontFamily: 'monospace',
                  color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase',
                  letterSpacing: '.1em', marginBottom: '8px',
                }}>
                  Recent Tasks ({recentPlans.length})
                </div>
                {recentPlans.map((p: any) => (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 12px', marginBottom: '4px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace',
                  }}>
                    <span style={{
                      color: p.status === 'done' ? '#22c55e' : p.status === 'failed' ? '#f87171' : '#63b3ed',
                      flexShrink: 0,
                    }}>
                      {p.status === 'done' ? '✓' : p.status === 'failed' ? '✗' : '▶'}
                    </span>
                    <span style={{
                      flex: 1, color: 'rgba(255,255,255,0.6)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {String(p.goal).slice(0, 50)}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '9px', flexShrink: 0 }}>
                      {p.completedPhases}/{p.phases} phases
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Header */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h2 style={{ fontSize:'17px', fontWeight:700 }}>API Keys</h2>
              <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                <span style={{ fontSize:'10px', fontFamily:'monospace', color:'rgba(255,255,255,0.3)' }}>
                  routing: {routing.mode || 'auto'}
                </span>
                <button onClick={resetLimits} style={{
                  fontSize:'10px', fontFamily:'monospace', padding:'4px 10px',
                  background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
                  borderRadius:'6px', color:'rgba(255,255,255,0.4)', cursor:'pointer',
                }}>reset limits</button>
              </div>
            </div>

            {/* Info banner */}
            <div style={{
              background:'rgba(99,179,237,0.06)', border:'1px solid rgba(99,179,237,0.15)',
              borderRadius:'10px', padding:'12px 14px',
              fontSize:'12px', fontFamily:'monospace',
              color:'rgba(255,255,255,0.5)', lineHeight:'1.7',
            }}>
              ⚡ Auto-routing enabled — DevOS cycles through available APIs automatically.<br/>
              When one hits its rate limit, it switches to the next one instantly.<br/>
              Add multiple keys per provider for maximum free usage.
            </div>

            {/* Existing APIs */}
            {providers.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                <div style={{
                  fontSize:'10px', fontFamily:'monospace', color:'rgba(255,255,255,0.25)',
                  textTransform:'uppercase', letterSpacing:'.1em', marginBottom:'4px',
                }}>
                  Configured APIs ({providers.filter((p: any) => p.enabled && !p.rateLimited).length} active)
                </div>
                {providers.map((api: any) => (
                  <div key={api.name} style={{
                    display:'flex', alignItems:'center', gap:'10px',
                    background:'rgba(255,255,255,0.04)',
                    border: `1px solid ${api.rateLimited ? 'rgba(248,113,113,0.2)' : api.enabled ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius:'10px', padding:'12px 14px',
                  }}>
                    {/* Status dot */}
                    <div style={{
                      width:'8px', height:'8px', borderRadius:'50%', flexShrink:0,
                      background: api.rateLimited ? '#f87171' : api.enabled ? '#22c55e' : '#555',
                    }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        <span style={{ fontSize:'12px', fontWeight:600 }}>{api.name}</span>
                        {api.rateLimited && (
                          <span style={{
                            fontSize:'9px', fontFamily:'monospace', padding:'1px 6px',
                            background:'rgba(248,113,113,0.12)', border:'1px solid rgba(248,113,113,0.2)',
                            borderRadius:'3px', color:'#f87171',
                          }}>rate limited</span>
                        )}
                      </div>
                      <div style={{ fontSize:'10px', fontFamily:'monospace', color:'rgba(255,255,255,0.3)', marginTop:'2px' }}>
                        {PROVIDER_INFO[api.provider]?.label || api.provider} · {api.model || '—'} · used {api.usageCount || 0}×
                      </div>
                    </div>
                    {/* Toggle */}
                    <button onClick={() => toggleProvider(api.name, !api.enabled)} style={{
                      padding:'4px 10px', borderRadius:'5px', fontSize:'10px', fontFamily:'monospace',
                      border:'1px solid rgba(255,255,255,0.08)', cursor:'pointer',
                      background: api.enabled ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
                      color: api.enabled ? '#22c55e' : 'rgba(255,255,255,0.3)',
                    }}>{api.enabled ? 'on' : 'off'}</button>
                    {/* Delete */}
                    <button onClick={() => deleteProvider(api.name)} style={{
                      width:'26px', height:'26px', borderRadius:'5px', fontSize:'14px',
                      border:'1px solid rgba(255,255,255,0.06)', cursor:'pointer',
                      background:'transparent', color:'rgba(255,255,255,0.2)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>×</button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new API — one card per provider */}
            <div style={{
              fontSize:'10px', fontFamily:'monospace', color:'rgba(255,255,255,0.25)',
              textTransform:'uppercase', letterSpacing:'.1em',
            }}>Add API Key</div>

            {Object.entries(PROVIDER_INFO).map(([id, info]) => (
              <div key={id} style={{
                background:'rgba(255,255,255,0.03)',
                border:'1px solid rgba(255,255,255,0.07)',
                borderRadius:'12px', overflow:'hidden',
              }}>
                {/* Provider header — click to expand */}
                <div
                  onClick={() => setAddingProvider(addingProvider === id ? null : id)}
                  style={{ display:'flex', alignItems:'center', gap:'10px', padding:'14px 16px', cursor:'pointer' }}
                >
                  <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:info.color, flexShrink:0 }}/>
                  <span style={{ fontSize:'13px', fontWeight:600, flex:1 }}>{info.label}</span>
                  <span style={{ fontSize:'10px', fontFamily:'monospace', color:'rgba(255,255,255,0.25)' }}>
                    {providers.filter((p: any) => p.provider === id).length} key{providers.filter((p: any) => p.provider === id).length !== 1 ? 's' : ''} added
                  </span>
                  <span style={{
                    fontSize:'10px', color:'rgba(255,255,255,0.2)',
                    display:'inline-block',
                    transform: addingProvider === id ? 'rotate(180deg)' : 'none',
                    transition:'transform .2s',
                  }}>▼</span>
                </div>

                {/* Expanded form */}
                {addingProvider === id && (
                  <div style={{
                    padding:'0 16px 16px', paddingTop:'14px',
                    borderTop:'1px solid rgba(255,255,255,0.06)',
                    display:'flex', flexDirection:'column', gap:'10px',
                  }}>
                    <a href={info.freeUrl} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize:'10px', fontFamily:'monospace', color:'#63b3ed', textDecoration:'none' }}>
                      Get free API key → {info.freeUrl.replace('https://', '')}
                    </a>
                    <input
                      autoFocus
                      value={newKey}
                      onChange={e => setNewKey(e.target.value)}
                      placeholder={`Paste ${info.label} API key...`}
                      type="password"
                      style={{
                        padding:'10px 12px', width:'100%', boxSizing:'border-box',
                        background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)',
                        borderRadius:'8px', color:'#e8e8e8', fontSize:'12px',
                        fontFamily:'monospace', outline:'none',
                      }}
                    />
                    <select
                      value={newModel || info.defaultModel}
                      onChange={e => setNewModel(e.target.value)}
                      style={{
                        padding:'8px 10px',
                        background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.1)',
                        borderRadius:'8px', color:'#e8e8e8', fontSize:'12px',
                        fontFamily:'monospace', outline:'none',
                      }}
                    >
                      {info.models.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <div style={{ display:'flex', gap:'8px' }}>
                      <button onClick={() => { setAddingProvider(null); setNewKey(''); setNewModel('') }} style={{
                        flex:1, padding:'9px', borderRadius:'8px', fontSize:'12px',
                        border:'1px solid rgba(255,255,255,0.08)', background:'transparent',
                        color:'rgba(255,255,255,0.3)', cursor:'pointer', fontFamily:'monospace',
                      }}>Cancel</button>
                      <button
                        onClick={() => saveKey(id)}
                        disabled={!newKey.trim() || savingKey}
                        style={{
                          flex:2, padding:'9px', borderRadius:'8px', fontSize:'12px', fontWeight:600,
                          border:'none', fontFamily:'monospace',
                          cursor:     newKey.trim() ? 'pointer' : 'default',
                          background: newKey.trim() ? '#63b3ed' : 'rgba(255,255,255,0.05)',
                          color:      newKey.trim() ? '#000'    : 'rgba(255,255,255,0.2)',
                        }}
                      >
                        {savingKey ? 'Saving...' : 'Save Key →'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Model switcher */}
            <div style={{
              background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)',
              borderRadius:'10px', padding:'14px 16px',
              display:'flex', justifyContent:'space-between', alignItems:'center',
            }}>
              <div>
                <div style={{ fontSize:'12px', fontWeight:600, marginBottom:'3px' }}>Switch Model Setup</div>
                <div style={{ fontSize:'11px', fontFamily:'monospace', color:'rgba(255,255,255,0.3)' }}>
                  Re-run the model selection wizard
                </div>
              </div>
              <button onClick={() => setOnboardingDone(false)} style={{
                padding:'7px 14px', borderRadius:'7px', fontSize:'11px', fontFamily:'monospace',
                border:'1px solid rgba(255,255,255,0.1)', background:'transparent',
                color:'rgba(255,255,255,0.4)', cursor:'pointer', transition:'all .15s',
              }}
                onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = 'rgba(99,179,237,0.35)'; (e.target as HTMLElement).style.color = '#63b3ed' }}
                onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.4)' }}
              >Re-run →</button>
            </div>

            {/* System status */}
            <div style={{
              background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)',
              borderRadius:'10px', padding:'14px',
            }}>
              <div style={{ fontSize:'12px', fontWeight:600, marginBottom:'10px' }}>System Status</div>
              {[
                { label:'API Server',   value: apiStatus === 'online' ? 'online :4200' : 'offline', ok: apiStatus === 'online' },
                { label:'Ollama',       value: 'localhost:11434', ok: true },
                { label:'Routing',      value: routing.mode || 'auto', ok: true },
                { label:'Active Model', value: model, ok: true },
              ].map(item => (
                <div key={item.label} style={{
                  display:'flex', justifyContent:'space-between',
                  padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,0.04)',
                  fontSize:'11px', fontFamily:'monospace',
                }}>
                  <span style={{ color:'rgba(255,255,255,0.35)' }}>{item.label}</span>
                  <span style={{ color: item.ok ? '#22c55e' : '#f87171' }}>{item.value}</span>
                </div>
              ))}
            </div>

            {/* About */}
            <div style={{ fontSize:'11px', fontFamily:'monospace', color:'rgba(255,255,255,0.2)', textAlign:'center', paddingBottom:'8px' }}>
              © 2026 Shiva Deore · DevOS v1.0 · Sprint 34
            </div>

          </div>
        </div>

      ) : (

        /* ── CHAT PANEL ─────────────────────────────────────── */
        <>
          {/* Scrollable message area */}
          <div style={{
            flex:1, overflowY:'auto', overflowX:'hidden',
            display:'flex', flexDirection:'column', alignItems:'center',
            padding:'24px 16px 16px',
          }}>
            <div style={{ width:'100%', maxWidth:'680px', display:'flex', flexDirection:'column', gap:'16px' }}>

              {/* Hero — only when no messages */}
              {messages.length === 0 && (
                <div style={{ textAlign:'center', paddingTop:'60px', paddingBottom:'20px' }}>
                  <div style={{
                    width:'64px', height:'64px', margin:'0 auto 20px',
                    background:'rgba(99,179,237,0.1)', border:'1px solid rgba(99,179,237,0.2)',
                    borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#63b3ed" strokeWidth="1.5">
                      <circle cx="12" cy="8" r="3"/>
                      <path d="M6 20v-2a6 6 0 0 1 12 0v2"/>
                    </svg>
                  </div>
                  <h1 style={{ fontSize:'28px', fontWeight:800, marginBottom:'8px' }}>Hi {userName}, I'm DevOS.</h1>
                  <p style={{ fontSize:'14px', color:'rgba(255,255,255,0.4)', lineHeight:'1.6', marginBottom:'28px' }}>
                    Your personal AI OS — running 100% on your machine.<br/>
                    Just tell me what you want to do.
                  </p>
                  {/* Suggestion chips */}
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'8px', justifyContent:'center' }}>
                    {CHIPS.map(chip => (
                      <button key={chip} onClick={() => send(chip)} style={{
                        fontSize:'12px', fontFamily:'inherit',
                        color:'rgba(255,255,255,0.55)', background:'rgba(255,255,255,0.05)',
                        border:'1px solid rgba(255,255,255,0.1)',
                        borderRadius:'20px', padding:'6px 14px',
                        cursor:'pointer', transition:'all .15s',
                      }}
                        onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(99,179,237,0.1)'; (e.target as HTMLElement).style.color = '#63b3ed'; (e.target as HTMLElement).style.borderColor = 'rgba(99,179,237,0.3)' }}
                        onMouseLeave={e => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.55)'; (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)' }}
                      >{chip}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              {messages.map((msg, i) => (
                <div key={i} style={{ display:'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth:     '78%', padding:'10px 14px',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background:   msg.role === 'user' ? 'rgba(99,179,237,0.15)' : 'rgba(255,255,255,0.05)',
                    border:       msg.role === 'user' ? '1px solid rgba(99,179,237,0.2)' : '1px solid rgba(255,255,255,0.07)',
                    fontSize:'14px', lineHeight:'1.6', color:'#e8e8e8',
                  }} className={msg.role === 'devos' ? 'msg-bubble' : ''}>
                    {msg.role === 'devos'
                      ? <>
                          {/* Inline activity log — shown for execute intent responses */}
                          {msg.activities && msg.activities.length > 0 && (
                            <ActivityLog items={msg.activities} />
                          )}
                          {msg.content
                            ? <ReactMarkdown>{msg.content}</ReactMarkdown>
                            : (!msg.activities || msg.activities.length === 0)
                              ? <span style={{ color:'rgba(255,255,255,0.25)', fontSize:'13px' }}>thinking…</span>
                              : null
                          }
                          {msg.streaming && <Cursor />}
                          {!msg.streaming && msg.provider && (
                            <div style={{
                              fontSize:'9px', fontFamily:'monospace',
                              color:'rgba(255,255,255,0.2)', marginTop:'4px', paddingLeft:'2px',
                            }}>
                              via {msg.provider}
                            </div>
                          )}
                        </>
                      : msg.content
                    }
                  </div>
                </div>
              ))}


              {/* Scroll anchor */}
              <div ref={bottomRef} style={{ height:'8px' }} />
            </div>
          </div>

          {/* ── INPUT BAR ───────────────────────────────────── */}
          <div style={{
            flexShrink:0, padding:'12px 16px 16px',
            background:'rgba(6,13,31,0.95)', borderTop:'1px solid rgba(255,255,255,0.05)',
          }}>
            <div style={{ maxWidth:'680px', margin:'0 auto' }}>
              {/* ── Mode pills ─────────────────────────────────── */}
            <div style={{ display:'flex', gap:'4px', marginBottom:'6px' }}>
              {(['auto','plan','chat'] as const).map(m => (
                <button key={m} onClick={() => setExecMode(m)} style={{
                  fontSize:'9px', fontFamily:'JetBrains Mono, monospace',
                  padding:'2px 8px', borderRadius:'10px', border:'none',
                  cursor:'pointer', transition:'all .15s',
                  background: execMode === m ? 'rgba(99,179,237,0.2)' : 'rgba(255,255,255,0.04)',
                  color: execMode === m ? '#63b3ed' : 'rgba(255,255,255,0.2)',
                }}>
                  {m === 'auto' ? '⚡ auto' : m === 'plan' ? '📋 plan only' : '💬 chat only'}
                </button>
              ))}
            </div>
            <div style={{
                display:'flex', alignItems:'flex-end', gap:'10px',
                background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.09)',
                borderRadius:'14px', padding:'10px 12px',
              }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => {
                    setInput(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                  }}
                  onKeyDown={handleKey}
                  placeholder="Ask anything or tell me what to do…"
                  rows={1}
                  disabled={streaming}
                  style={{
                    flex:1, background:'transparent', border:'none',
                    color: streaming ? 'rgba(232,232,232,0.5)' : '#e8e8e8',
                    fontSize:'14px', lineHeight:'1.5',
                    resize:'none', fontFamily:'inherit',
                    minHeight:'24px', maxHeight:'120px', overflowY:'auto',
                  }}
                />
                {/* Send / Stop button */}
                {streaming ? (
                  <button onClick={stopStreaming} title="Stop (Esc)" style={{
                    width:'34px', height:'34px', flexShrink:0,
                    background:'rgba(248,113,113,0.15)', border:'1px solid rgba(248,113,113,0.35)',
                    borderRadius:'8px', cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#f87171">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                    </svg>
                  </button>
                ) : (
                  <button onClick={() => send()} disabled={!input.trim()} style={{
                    width:'34px', height:'34px', flexShrink:0,
                    background: input.trim() ? '#63b3ed' : 'rgba(255,255,255,0.05)',
                    border:'none', borderRadius:'8px',
                    cursor: input.trim() ? 'pointer' : 'default',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    transition:'all .15s',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke={input.trim() ? '#000' : 'rgba(255,255,255,0.2)'} strokeWidth="2.5">
                      <line x1="22" y1="2" x2="11" y2="13"/>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  </button>
                )}
              </div>
              {/* Status bar */}
              <div style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                marginTop:'6px', fontSize:'10px', fontFamily:'monospace',
                color:'rgba(255,255,255,0.15)',
              }}>
                <span>DevOS runs locally · your data never leaves this machine</span>
                <span style={{ color: streaming ? '#f97316' : 'rgba(255,255,255,0.12)' }}>
                  {streaming ? '● streaming · Esc to stop' : model}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
