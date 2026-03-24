"use client"
import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'

// ── Types ────────────────────────────────────────────────────

interface Message {
  role:       'user' | 'devos'
  content:    string
  time:       string
  streaming?: boolean
}

interface AgentEvent {
  id:      string
  agent:   string
  message: string
  type:    'thinking' | 'acting' | 'done' | 'error'
  time:    string
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
      display:         'inline-block',
      width:           '2px',
      height:          '14px',
      background:      '#63b3ed',
      marginLeft:      '2px',
      verticalAlign:   'text-bottom',
      animation:       'pulse 1s ease infinite',
    }} />
  )
}

// ── Main component ────────────────────────────────────────────

export default function Home() {
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
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([
    { id:'1', agent:'CEO Agent',    message:'Goal logged: Dashboard redesign',  type:'done',     time:'just now' },
    { id:'2', agent:'Dev Agent',    message:'ts-node compile running...',        type:'acting',   time:'1m ago'   },
    { id:'3', agent:'Memory Agent', message:'Warm layer near capacity',          type:'thinking', time:'3m ago'   },
  ])
  const [model, setModel]           = useState('mistral:7b')

  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)
  const abortRef   = useRef<AbortController | null>(null)

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

  // ── SSE agent events ────────────────────────────────────────
  useEffect(() => {
    try {
      const es = new EventSource('http://localhost:4200/api/stream')
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data.type === 'ping') return
          setAgentEvents(prev => [{
            id:      Date.now().toString(),
            agent:   data.agent    || 'DevOS',
            message: data.message  || '',
            type:    data.eventType || 'acting',
            time:    'just now',
          }, ...prev].slice(0, 10))
        } catch {}
      }
      return () => es.close()
    } catch {}
  }, [])

  // ── Read model from config ──────────────────────────────────
  useEffect(() => {
    fetch('http://localhost:4200/api/models')
      .then(r => r.json())
      .then(d => { if (d?.compatible?.[0]) setModel(d.compatible[0]) })
      .catch(() => {})
  }, [])

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
    // seal the last message (remove streaming flag)
    setMessages(prev => prev.map((m, i) =>
      i === prev.length - 1 ? { ...m, streaming: false } : m
    ))
  }, [])

  // ── Send message ────────────────────────────────────────────
  const send = useCallback(async (override?: string) => {
    const msg = (override ?? input).trim()
    if (!msg || streaming) return
    setInput('')
    if (inputRef.current) { inputRef.current.style.height = 'auto' }

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    setMessages(prev => [...prev, { role: 'user', content: msg, time }])
    setStreaming(true)

    const mode        = detectMode(msg)
    const newHistory  = [...history, { role: 'user', content: msg }]
    setHistory(newHistory)

    // Add empty DevOS message that will be filled token by token
    setMessages(prev => [...prev, { role: 'devos', content: '', time, streaming: true }])

    try {
      if (mode === 'goal') {
        // Goals don't stream — fire and forget
        const r = await fetch('http://localhost:4200/api/goals', {
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

      // Streaming fetch for chat modes
      const controller   = new AbortController()
      abortRef.current   = controller

      const r = await fetch('http://localhost:4200/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: msg, mode, history: newHistory.slice(-10) }),
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
            if (payload.token) {
              full += payload.token
              setMessages(prev => {
                const next = [...prev]
                next[next.length - 1] = { role: 'devos', content: full, time, streaming: true }
                return next
              })
            }
            if (payload.done) {
              setMessages(prev => {
                const next = [...prev]
                next[next.length - 1] = { role: 'devos', content: full, time, streaming: false }
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
      if (err?.name === 'AbortError') {
        // stopped by user — message already sealed by stopStreaming
      } else {
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = {
            role: 'devos',
            content: "I can't reach the DevOS API. Make sure the server is running.",
            time,
            streaming: false,
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
  }

  // ── Colours ──────────────────────────────────────────────────
  const dotColor: Record<string, string> = {
    thinking: '#60a5fa', acting: '#f97316', done: '#22c55e', error: '#f87171',
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div style={{
      height:          '100vh',
      display:         'flex',
      flexDirection:   'column',
      background:      'radial-gradient(ellipse at 30% 20%, #0a1628 0%, #060d1f 50%, #030812 100%)',
      color:           '#e8e8e8',
      overflow:        'hidden',
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
            {apiStatus === 'online' ? '31 agents live' : 'server offline'}
          </span>
        </div>

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

        /* ── SETTINGS PANEL ────────────────────────────────── */
        <div style={{
          flex:1, overflowY:'auto',
          display:'flex', justifyContent:'center',
          padding:'32px 16px',
        }}>
          <div style={{ width:'100%', maxWidth:'560px', display:'flex', flexDirection:'column', gap:'20px' }}>

            {/* Status card */}
            <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', padding:'20px' }}>
              <div style={{ fontSize:'11px', fontFamily:'monospace', color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:'14px' }}>System Status</div>
              {[
                { label:'API Server',   value: apiStatus === 'online' ? '● online  :4200' : '● offline', ok: apiStatus === 'online' },
                { label:'Ollama',       value: apiStatus === 'online' ? '● running :11434' : '● unreachable', ok: apiStatus === 'online' },
                { label:'Active Model', value: model, ok: true },
                { label:'Data Privacy', value:'100% local — no cloud', ok: true },
              ].map(row => (
                <div key={row.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize:'13px', color:'rgba(255,255,255,0.5)' }}>{row.label}</span>
                  <span style={{ fontSize:'12px', fontFamily:'monospace', color: row.ok ? '#22c55e' : '#f87171' }}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* Quick commands */}
            <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', padding:'20px' }}>
              <div style={{ fontSize:'11px', fontFamily:'monospace', color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:'14px' }}>Quick Commands</div>
              {[
                { cmd:'devos setup',    desc:'Run first-boot configuration wizard' },
                { cmd:'devos doctor',   desc:'Check all subsystem health' },
                { cmd:'devos models',   desc:'List compatible local models' },
                { cmd:'ollama serve',   desc:'Start Ollama inference server' },
                { cmd:'ollama pull mistral:7b', desc:'Download default model' },
              ].map(row => (
                <div key={row.cmd} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                  <code style={{ fontSize:'11px', fontFamily:'monospace', color:'#93c5fd', background:'rgba(255,255,255,0.06)', padding:'2px 6px', borderRadius:'4px', flexShrink:0 }}>{row.cmd}</code>
                  <span style={{ fontSize:'12px', color:'rgba(255,255,255,0.4)' }}>{row.desc}</span>
                </div>
              ))}
            </div>

            {/* About */}
            <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', padding:'20px' }}>
              <div style={{ fontSize:'11px', fontFamily:'monospace', color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:'12px' }}>About DevOS</div>
              <p style={{ fontSize:'13px', lineHeight:'1.7', color:'rgba(255,255,255,0.5)', marginBottom:'10px' }}>
                DevOS is a sovereign AI operating system. All models run locally via Ollama — your data never leaves this machine.
              </p>
              <p style={{ fontSize:'12px', fontFamily:'monospace', color:'rgba(255,255,255,0.25)' }}>
                © 2026 Shiva Deore · v1.0 · Sprint 28
              </p>
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
                    background:'rgba(99,179,237,0.1)',
                    border:'1px solid rgba(99,179,237,0.2)',
                    borderRadius:'50%',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#63b3ed" strokeWidth="1.5">
                      <circle cx="12" cy="8" r="3"/>
                      <path d="M6 20v-2a6 6 0 0 1 12 0v2"/>
                    </svg>
                  </div>
                  <h1 style={{ fontSize:'28px', fontWeight:800, marginBottom:'8px' }}>Hi, I'm DevOS.</h1>
                  <p style={{ fontSize:'14px', color:'rgba(255,255,255,0.4)', lineHeight:'1.6', marginBottom:'28px' }}>
                    Your personal AI OS — running 100% on your machine.<br/>
                    Just tell me what you want to do.
                  </p>

                  {/* Suggestion chips */}
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'8px', justifyContent:'center' }}>
                    {CHIPS.map(chip => (
                      <button key={chip} onClick={() => send(chip)} style={{
                        fontSize:'12px', fontFamily:'inherit',
                        color:'rgba(255,255,255,0.55)',
                        background:'rgba(255,255,255,0.05)',
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
                    maxWidth:     '78%',
                    padding:      '10px 14px',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background:   msg.role === 'user' ? 'rgba(99,179,237,0.15)' : 'rgba(255,255,255,0.05)',
                    border:       msg.role === 'user' ? '1px solid rgba(99,179,237,0.2)' : '1px solid rgba(255,255,255,0.07)',
                    fontSize:     '14px',
                    lineHeight:   '1.6',
                    color:        '#e8e8e8',
                  }} className={msg.role === 'devos' ? 'msg-bubble' : ''}>
                    {msg.role === 'devos'
                      ? <>
                          {msg.content
                            ? <ReactMarkdown>{msg.content}</ReactMarkdown>
                            : <span style={{ color: 'rgba(255,255,255,0.25)', fontSize:'13px' }}>thinking…</span>
                          }
                          {msg.streaming && <Cursor />}
                        </>
                      : msg.content
                    }
                  </div>
                </div>
              ))}

              {/* Agent Activity */}
              {agentEvents.length > 0 && messages.length > 0 && (
                <div style={{ marginTop:'8px' }}>
                  <div style={{ fontSize:'9px', fontFamily:'monospace', color:'rgba(255,255,255,0.2)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:'6px' }}>Agent Activity</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                    {agentEvents.slice(0, 3).map(ev => (
                      <div key={ev.id} style={{
                        display:'flex', alignItems:'center', gap:'10px',
                        background:'rgba(255,255,255,0.03)',
                        border:'1px solid rgba(255,255,255,0.05)',
                        borderRadius:'8px', padding:'8px 12px',
                      }}>
                        <div style={{ width:'6px', height:'6px', borderRadius:'50%', background: dotColor[ev.type] || '#888', flexShrink:0 }}/>
                        <span style={{ fontSize:'12px', fontWeight:600, minWidth:'100px', flexShrink:0 }}>{ev.agent}</span>
                        <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.message}</span>
                        <span style={{ fontSize:'10px', fontFamily:'monospace', color:'rgba(255,255,255,0.2)', flexShrink:0 }}>{ev.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Scroll anchor */}
              <div ref={bottomRef} style={{ height:'8px' }} />
            </div>
          </div>

          {/* ── INPUT BAR ───────────────────────────────────── */}
          <div style={{
            flexShrink:  0,
            padding:     '12px 16px 16px',
            background:  'rgba(6,13,31,0.95)',
            borderTop:   '1px solid rgba(255,255,255,0.05)',
          }}>
            <div style={{ maxWidth:'680px', margin:'0 auto' }}>
              <div style={{
                display:'flex', alignItems:'flex-end', gap:'10px',
                background:'rgba(255,255,255,0.05)',
                border:'1px solid rgba(255,255,255,0.09)',
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
                    background:'rgba(248,113,113,0.15)',
                    border:'1px solid rgba(248,113,113,0.35)',
                    borderRadius:'8px', cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    transition:'all .15s',
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
                marginTop:'6px',
                fontSize:'10px', fontFamily:'monospace',
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
