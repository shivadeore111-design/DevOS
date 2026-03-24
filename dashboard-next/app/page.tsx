"use client"
import { useState, useEffect, useRef } from 'react'

interface AgentEvent {
  id: string
  agent: string
  message: string
  type: 'thinking' | 'acting' | 'done' | 'error'
  time: string
}

interface Message {
  role: 'user' | 'devos'
  content: string
  time: string
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([
    { id:'1', agent:'CEO Agent', message:'Goal logged: Dashboard redesign', type:'done', time:'just now' },
    { id:'2', agent:'Dev Agent', message:'ts-node compile running...', type:'acting', time:'1m ago' },
    { id:'3', agent:'Memory Agent', message:'Warm layer near capacity', type:'thinking', time:'3m ago' },
  ])
  const [apiStatus, setApiStatus] = useState<'online'|'offline'>('offline')
  const [searchMode, setSearchMode] = useState<'speed'|'balanced'|'deep'>('balanced')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior:'smooth' })
  }, [messages])

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
            message: data.message || data.text || '',
            type: data.type || 'acting',
            time: 'just now'
          }, ...prev].slice(0, 20))
        } catch {}
      }
      return () => es.close()
    } catch {}
  }, [])

  const send = async () => {
    if (!input.trim() || thinking) return
    const msg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role:'user', content:msg, time:'just now' }])
    setThinking(true)
    try {
      const r = await fetch('http://localhost:4200/api/chat', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ message: msg, mode: searchMode })
      })
      const data = await r.json()
      setMessages(prev => [...prev, { role:'devos', content: data.reply || 'Done.', time:'just now' }])
    } catch {
      setMessages(prev => [...prev, { role:'devos', content:'API offline. Run: devos serve', time:'just now' }])
    }
    setThinking(false)
    inputRef.current?.focus()
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const dotColor: Record<string,string> = {
    thinking:'#60a5fa', acting:'#f97316', done:'#22c55e', error:'#f87171'
  }

  const showHero = messages.length === 0

  return (
    <div style={{
        minHeight:'100vh',
        background:'radial-gradient(ellipse at 30% 20%, #0a1628 0%, #060d1f 50%, #030812 100%)',
        display:'flex',
        flexDirection:'column',
      }}>

        {/* NAV */}
        <nav style={{
          height:'52px',
          display:'flex',
          alignItems:'center',
          padding:'0 28px',
          borderBottom:'1px solid rgba(255,255,255,0.06)',
          backdropFilter:'blur(12px)',
          position:'sticky',
          top:0,
          zIndex:10,
          background:'rgba(6,13,31,0.8)',
        }}>
          {/* Logo */}
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{
              width:'32px', height:'32px',
              background:'rgba(99,179,237,0.15)',
              border:'1px solid rgba(99,179,237,0.3)',
              borderRadius:'8px',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#63b3ed" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
            </div>
            <span style={{ fontSize:'16px', fontWeight:700 }}>DevOS</span>
          </div>

          {/* Nav links */}
          <div style={{ display:'flex', gap:'4px', marginLeft:'32px' }}>
            {['doctor','agents','memory'].map(link => (
              <a key={link} href={`http://localhost:4200/api/${link}`} target="_blank"
                style={{ fontSize:'13px', color:'rgba(255,255,255,0.5)', textDecoration:'none',
                  padding:'5px 12px', borderRadius:'6px', transition:'all .15s' }}
                onMouseEnter={e => (e.currentTarget.style.color='#e8e8e8')}
                onMouseLeave={e => (e.currentTarget.style.color='rgba(255,255,255,0.5)')}
              >{link}</a>
            ))}
          </div>

          {/* Status badge */}
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'7px',
            background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.25)',
            borderRadius:'20px', padding:'5px 14px' }}>
            <div style={{ width:'6px', height:'6px', borderRadius:'50%',
              background: apiStatus === 'online' ? '#22c55e' : '#f87171',
              animation:'pulse 2s infinite' }}/>
            <span style={{ fontSize:'12px', fontFamily:'JetBrains Mono, monospace',
              color: apiStatus === 'online' ? '#22c55e' : '#f87171' }}>
              {apiStatus === 'online' ? '31 agents live' : 'server offline'}
            </span>
          </div>
        </nav>

        {/* MAIN */}
        <main style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center',
          padding:'0 20px 120px', overflowY:'auto' }}>

          {/* HERO */}
          {showHero && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
              paddingTop:'80px', animation:'fadeIn .5s ease' }}>
              <div style={{
                width:'72px', height:'72px',
                background:'rgba(99,179,237,0.1)',
                border:'1px solid rgba(99,179,237,0.2)',
                borderRadius:'50%',
                display:'flex', alignItems:'center', justifyContent:'center',
                marginBottom:'24px',
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#63b3ed" strokeWidth="1.5">
                  <circle cx="12" cy="8" r="3"/>
                  <path d="M6 20v-2a6 6 0 0 1 12 0v2"/>
                  <circle cx="8" cy="11" r="1" fill="#63b3ed"/>
                  <circle cx="16" cy="11" r="1" fill="#63b3ed"/>
                </svg>
              </div>
              <h1 style={{ fontSize:'36px', fontWeight:800, marginBottom:'10px', textAlign:'center' }}>
                Hi, I'm DevOS.
              </h1>
              <p style={{ fontSize:'16px', color:'rgba(255,255,255,0.45)', textAlign:'center', maxWidth:'400px' }}>
                Your personal AI OS — what should we do today?
              </p>
            </div>
          )}

          {/* MESSAGES */}
          {messages.length > 0 && (
            <div style={{ width:'100%', maxWidth:'680px', paddingTop:'32px', display:'flex',
              flexDirection:'column', gap:'16px' }}>
              {messages.map((msg, i) => (
                <div key={i} className="msg-in" style={{
                  display:'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}>
                  <div style={{
                    maxWidth:'80%',
                    padding:'12px 16px',
                    borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    background: msg.role === 'user'
                      ? 'rgba(99,179,237,0.15)'
                      : 'rgba(255,255,255,0.06)',
                    border: msg.role === 'user'
                      ? '1px solid rgba(99,179,237,0.25)'
                      : '1px solid rgba(255,255,255,0.08)',
                    fontSize:'14px',
                    lineHeight:'1.6',
                    color:'#e8e8e8',
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="msg-in" style={{ display:'flex', justifyContent:'flex-start' }}>
                  <div style={{
                    padding:'12px 16px', borderRadius:'18px 18px 18px 4px',
                    background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)',
                    display:'flex', gap:'6px', alignItems:'center'
                  }}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{
                        width:'6px', height:'6px', borderRadius:'50%',
                        background:'rgba(255,255,255,0.4)',
                        animation:`pulse 1.2s ease ${i*0.2}s infinite`
                      }}/>
                    ))}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef}/>
            </div>
          )}
        </main>

        {/* FIXED BOTTOM */}
        <div style={{
          position:'fixed', bottom:0, left:0, right:0,
          padding:'16px 20px 20px',
          background:'linear-gradient(to top, #060d1f 60%, transparent)',
        }}>
          <div style={{ maxWidth:'680px', margin:'0 auto', display:'flex', flexDirection:'column', gap:'12px' }}>

            {/* INPUT BOX */}
            <div style={{
              background:'rgba(255,255,255,0.06)',
              border:'1px solid rgba(255,255,255,0.1)',
              borderRadius:'16px',
              padding:'16px',
              backdropFilter:'blur(20px)',
            }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask anything, set a goal, or run a command..."
                rows={1}
                style={{
                  width:'100%', background:'transparent', border:'none',
                  color:'#e8e8e8', fontSize:'15px', lineHeight:'1.5',
                  resize:'none', fontFamily:'inherit',
                }}
              />
              {/* Mode selector */}
              <div style={{ display:'flex', gap:'4px', marginBottom:'8px' }}>
                {(['speed','balanced','deep'] as const).map(m => (
                  <button key={m} onClick={() => setSearchMode(m)}
                    style={{
                      padding:'3px 10px', borderRadius:'12px', fontSize:'11px',
                      fontFamily:'JetBrains Mono, monospace', cursor:'pointer', border:'none',
                      background: searchMode === m ? 'rgba(99,179,237,0.25)' : 'rgba(255,255,255,0.05)',
                      color: searchMode === m ? '#63b3ed' : 'rgba(255,255,255,0.35)',
                      transition:'all .15s',
                    }}
                  >{m === 'speed' ? '⚡ speed' : m === 'balanced' ? '⚖ balanced' : '🔬 deep'}</button>
                ))}
              </div>

              <div style={{ display:'flex', alignItems:'center', marginTop:'12px', gap:'8px' }}>
                {[
                  { label:'⊙ new goal', val:'' },
                  { label:'+ run agent', val:'run agent ' },
                  { label:'✉ doctor', val:'devos doctor' },
                ].map(q => (
                  <button key={q.label} onClick={() => { setInput(q.val); inputRef.current?.focus() }}
                    style={{
                      background:'rgba(255,255,255,0.06)',
                      border:'1px solid rgba(255,255,255,0.1)',
                      borderRadius:'20px', padding:'5px 12px',
                      color:'rgba(255,255,255,0.5)', fontSize:'12px',
                      cursor:'pointer', fontFamily:'inherit',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color='#e8e8e8')}
                    onMouseLeave={e => (e.currentTarget.style.color='rgba(255,255,255,0.5)')}
                  >{q.label}</button>
                ))}
                <div style={{ marginLeft:'auto', display:'flex', gap:'8px' }}>
                  <button onClick={send} disabled={thinking || !input.trim()}
                    style={{
                      width:'36px', height:'36px',
                      background: input.trim() ? 'rgba(99,179,237,0.8)' : 'rgba(255,255,255,0.06)',
                      border:'1px solid rgba(255,255,255,0.1)',
                      borderRadius:'10px', cursor:'pointer',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      transition:'all .15s',
                    }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke={input.trim() ? '#fff' : 'rgba(255,255,255,0.3)'} strokeWidth="2">
                      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* AGENT ACTIVITY */}
            {agentEvents.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                <div style={{ fontSize:'10px', fontFamily:'JetBrains Mono, monospace',
                  color:'rgba(255,255,255,0.25)', letterSpacing:'.1em',
                  textTransform:'uppercase', marginBottom:'4px' }}>Agent Activity</div>
                {agentEvents.slice(0,3).map(ev => (
                  <div key={ev.id} style={{
                    display:'flex', alignItems:'center', gap:'10px',
                    background:'rgba(255,255,255,0.04)',
                    border:'1px solid rgba(255,255,255,0.06)',
                    borderRadius:'10px', padding:'10px 14px',
                    animation:'fadeIn .3s ease',
                  }}>
                    <div style={{ width:'7px', height:'7px', borderRadius:'50%',
                      background: dotColor[ev.type], flexShrink:0,
                      animation: ev.type === 'acting' ? 'pulse 1.5s infinite' : 'none' }}/>
                    <span style={{ fontSize:'13px', fontWeight:600, color:'#e8e8e8',
                      minWidth:'110px', flexShrink:0 }}>{ev.agent}</span>
                    <span style={{ fontSize:'12px', color:'rgba(255,255,255,0.45)',
                      flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {ev.message}
                    </span>
                    <span style={{ fontSize:'11px', fontFamily:'JetBrains Mono, monospace',
                      color:'rgba(255,255,255,0.25)', flexShrink:0 }}>{ev.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* STATUS BAR SPACER */}
        <div style={{ height:'32px' }}/>
        <div style={{
          position:'fixed', bottom:0, left:0, right:0, height:'28px',
          borderTop:'1px solid rgba(255,255,255,0.05)',
          background:'rgba(6,13,31,0.95)',
          display:'flex', alignItems:'center', justifyContent:'center', gap:'16px',
          zIndex:5,
        }}>
          {([
            ['API', '4200', apiStatus === 'online'],
            ['Ollama', '11434', true],
            ['UI', '3000', true],
            ['v1.0', '', true],
          ] as [string, string, boolean][]).map(([label, port, ok]) => (
            <span key={label} style={{
              fontSize:'10px', fontFamily:'JetBrains Mono, monospace',
              color: ok ? 'rgba(255,255,255,0.3)' : 'rgba(248,113,113,0.6)',
            }}>
              {label}{port ? ` :${port}` : ''}
            </span>
          ))}
        </div>
      </div>
  )
}
