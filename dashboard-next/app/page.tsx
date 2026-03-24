"use client"
import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'

interface Message {
  role: 'user' | 'devos'
  content: string
  time: string
}

interface AgentEvent {
  id: string
  agent: string
  message: string
  type: 'thinking' | 'acting' | 'done' | 'error'
  time: string
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem('devos_chat') || '[]') } catch { return [] }
  })
  const [history, setHistory] = useState<{role:string,content:string}[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem('devos_history') || '[]') } catch { return [] }
  })
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [apiStatus, setApiStatus] = useState<'online'|'offline'>('offline')
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([
    { id:'1', agent:'CEO Agent', message:'Goal logged: Dashboard redesign', type:'done', time:'just now' },
    { id:'2', agent:'Dev Agent', message:'ts-node compile running...', type:'acting', time:'1m ago' },
    { id:'3', agent:'Memory Agent', message:'Warm layer near capacity', type:'thinking', time:'3m ago' },
  ])
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const chatRef = useRef<HTMLDivElement>(null)

  // Save messages
  useEffect(() => {
    try {
      localStorage.setItem('devos_chat', JSON.stringify(messages.slice(-50)))
    } catch {}
  }, [messages])

  // Auto scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  // API health check
  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch('http://localhost:4200/api/health')
        setApiStatus(r.ok ? 'online' : 'offline')
      } catch { setApiStatus('offline') }
    }
    check()
    const iv = setInterval(check, 10000)
    return () => clearInterval(iv)
  }, [])

  // SSE agent events
  useEffect(() => {
    try {
      const es = new EventSource('http://localhost:4200/api/stream')
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data.type === 'ping') return
          setAgentEvents(prev => [{
            id: Date.now().toString(),
            agent: data.agent || 'DevOS',
            message: data.message || '',
            type: data.eventType || 'acting',
            time: 'just now'
          }, ...prev].slice(0, 10))
        } catch {}
      }
      return () => es.close()
    } catch {}
  }, [])

  // Auto-detect intent — no mode buttons needed
  function detectMode(text: string): string {
    const lower = text.toLowerCase()
    if (lower.includes('research') || lower.includes('deep') || lower.includes('analyze') || lower.includes('compare') || lower.includes('report')) return 'deep'
    if (lower.includes('build') || lower.includes('create') || lower.includes('make') || lower.includes('run') || lower.includes('execute') || lower.includes('goal')) return 'goal'
    return 'speed'
  }

  const send = async () => {
    if (!input.trim() || thinking) return
    const msg = input.trim()
    setInput('')
    const time = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
    setMessages(prev => [...prev, { role:'user', content: msg, time }])
    setThinking(true)

    const mode = detectMode(msg)
    const newHistory = [...history, { role:'user', content: msg }]
    setHistory(newHistory)

    try {
      const endpoint = mode === 'goal' ? 'http://localhost:4200/api/goals' : 'http://localhost:4200/api/chat'
      const body = mode === 'goal'
        ? JSON.stringify({ title: msg, description: msg })
        : JSON.stringify({ message: msg, mode, history: newHistory.slice(-10) })

      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      })
      const data = await r.json()
      const reply = data.reply || data.message || (mode === 'goal' ? 'Goal started — watch the activity feed below.' : 'Done.')
      const updatedHistory = [...newHistory, { role:'assistant', content: reply }]
      setHistory(updatedHistory)
      try { localStorage.setItem('devos_history', JSON.stringify(updatedHistory.slice(-20))) } catch {}
      setMessages(prev => [...prev, { role:'devos', content: reply, time }])
    } catch {
      setMessages(prev => [...prev, {
        role:'devos',
        content: 'I cannot reach the DevOS API. Make sure the server is running.',
        time
      }])
    }
    setThinking(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const clearChat = () => {
    setMessages([])
    setHistory([])
    localStorage.removeItem('devos_chat')
    localStorage.removeItem('devos_history')
  }

  const dotColor: Record<string,string> = {
    thinking:'#60a5fa', acting:'#f97316', done:'#22c55e', error:'#f87171'
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'radial-gradient(ellipse at 30% 20%, #0a1628 0%, #060d1f 50%, #030812 100%)',
      color: '#e8e8e8',
      overflow: 'hidden',
    }}>

      {/* NAV — fixed height, never grows */}
      <nav style={{
        flexShrink: 0,
        height: '48px',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(6,13,31,0.9)',
        gap: '10px',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <div style={{
            width:'28px', height:'28px',
            background:'rgba(99,179,237,0.15)',
            border:'1px solid rgba(99,179,237,0.3)',
            borderRadius:'7px',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#63b3ed" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </div>
          <span style={{ fontSize:'14px', fontWeight:700 }}>DevOS</span>
          <span style={{ fontSize:'10px', color:'#f97316', fontFamily:'monospace' }}>v1.0</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'5px', marginLeft:'8px' }}>
          <div style={{
            width:'6px', height:'6px', borderRadius:'50%',
            background: apiStatus === 'online' ? '#22c55e' : '#f87171',
          }}/>
          <span style={{ fontSize:'11px', fontFamily:'monospace', color: apiStatus === 'online' ? '#22c55e' : '#f87171' }}>
            {apiStatus === 'online' ? '31 agents live' : 'server offline'}
          </span>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:'6px' }}>
          <button onClick={clearChat} style={{
            fontSize:'10px', fontFamily:'monospace',
            color:'rgba(255,255,255,0.3)', background:'transparent',
            border:'1px solid rgba(255,255,255,0.08)',
            borderRadius:'4px', padding:'3px 8px', cursor:'pointer'
          }}>clear chat</button>
        </div>
      </nav>

      {/* CHAT AREA — takes all remaining space, scrollable */}
      <div ref={chatRef} style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 16px 16px',
      }}>
        <div style={{ width: '100%', maxWidth: '680px', display:'flex', flexDirection:'column', gap:'16px' }}>

          {/* HERO — only when no messages */}
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
              <p style={{ fontSize:'14px', color:'rgba(255,255,255,0.4)', lineHeight:'1.6' }}>
                Your personal AI OS — running 100% on your machine.<br/>
                Just tell me what you want to do.
              </p>
            </div>
          )}

          {/* MESSAGES */}
          {messages.map((msg, i) => (
            <div key={i} style={{
              display:'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                maxWidth: '78%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: msg.role === 'user'
                  ? 'rgba(99,179,237,0.15)'
                  : 'rgba(255,255,255,0.05)',
                border: msg.role === 'user'
                  ? '1px solid rgba(99,179,237,0.2)'
                  : '1px solid rgba(255,255,255,0.07)',
                fontSize: '14px',
                lineHeight: '1.6',
                color: '#e8e8e8',
              }} className={msg.role === 'devos' ? 'msg-bubble' : ''}>
                {msg.role === 'devos'
                  ? <ReactMarkdown>{msg.content}</ReactMarkdown>
                  : msg.content
                }
              </div>
            </div>
          ))}

          {/* THINKING INDICATOR */}
          {thinking && (
            <div style={{ display:'flex', justifyContent:'flex-start' }}>
              <div style={{
                padding:'10px 16px',
                borderRadius:'16px 16px 16px 4px',
                background:'rgba(255,255,255,0.05)',
                border:'1px solid rgba(255,255,255,0.07)',
                display:'flex', gap:'5px', alignItems:'center'
              }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    width:'5px', height:'5px', borderRadius:'50%',
                    background:'rgba(255,255,255,0.35)',
                    animation:`pulse 1.2s ease ${i*0.2}s infinite`
                  }}/>
                ))}
              </div>
            </div>
          )}

          {/* AGENT ACTIVITY */}
          {agentEvents.length > 0 && (
            <div style={{ marginTop:'8px' }}>
              <div style={{
                fontSize:'9px', fontFamily:'monospace',
                color:'rgba(255,255,255,0.2)', textTransform:'uppercase',
                letterSpacing:'.1em', marginBottom:'6px'
              }}>Agent Activity</div>
              <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                {agentEvents.slice(0,3).map(ev => (
                  <div key={ev.id} style={{
                    display:'flex', alignItems:'center', gap:'10px',
                    background:'rgba(255,255,255,0.03)',
                    border:'1px solid rgba(255,255,255,0.05)',
                    borderRadius:'8px', padding:'8px 12px',
                  }}>
                    <div style={{
                      width:'6px', height:'6px', borderRadius:'50%',
                      background: dotColor[ev.type] || '#888',
                      flexShrink:0,
                    }}/>
                    <span style={{ fontSize:'12px', fontWeight:600, minWidth:'100px', flexShrink:0 }}>{ev.agent}</span>
                    <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.message}</span>
                    <span style={{ fontSize:'10px', fontFamily:'monospace', color:'rgba(255,255,255,0.2)', flexShrink:0 }}>{ev.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SCROLL ANCHOR */}
          <div ref={bottomRef} style={{ height:'8px' }} />
        </div>
      </div>

      {/* INPUT BAR — fixed at bottom, never overlaps chat */}
      <div style={{
        flexShrink: 0,
        padding: '12px 16px 16px',
        background: 'rgba(6,13,31,0.95)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
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
              placeholder="Ask anything or tell me what to do..."
              rows={1}
              style={{
                flex:1, background:'transparent', border:'none',
                color:'#e8e8e8', fontSize:'14px', lineHeight:'1.5',
                resize:'none', fontFamily:'inherit', minHeight:'24px',
                maxHeight:'120px', overflowY:'auto',
              }}
            />
            <button onClick={send} disabled={thinking || !input.trim()}
              style={{
                width:'34px', height:'34px', flexShrink:0,
                background: input.trim() ? '#63b3ed' : 'rgba(255,255,255,0.05)',
                border:'none', borderRadius:'8px', cursor: input.trim() ? 'pointer' : 'default',
                display:'flex', alignItems:'center', justifyContent:'center',
                transition:'all .15s',
              }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke={input.trim() ? '#000' : 'rgba(255,255,255,0.2)'} strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
          <div style={{
            textAlign:'center', marginTop:'6px',
            fontSize:'10px', fontFamily:'monospace',
            color:'rgba(255,255,255,0.15)'
          }}>
            DevOS runs locally · your data never leaves this machine
          </div>
        </div>
      </div>
    </div>
  )
}
