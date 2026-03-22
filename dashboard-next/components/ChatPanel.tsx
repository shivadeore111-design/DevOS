'use client'
import { useState, useEffect, useRef } from 'react'
import { Send, Sparkles } from 'lucide-react'
import { useStore } from '../lib/store'
import { MissionCard } from './MissionCard'

interface Message {
  id: string
  role: 'user' | 'devos'
  content: string
  timestamp: string
  type?: 'info' | 'success' | 'error' | 'progress'
  goalId?: string  // when set, MissionCard renders below message
}

const API = process.env.NEXT_PUBLIC_DEVOS_API || 'http://localhost:4200'

const SUGGESTIONS = [
  'Build a REST API with auth and CRUD endpoints',
  'Research the top SaaS trends in 2025',
  'Create a Node.js CLI tool for managing todos',
  'Build a web scraper for Hacker News',
  'Research competitors to CoachOS fitness app'
]

export function ChatPanel() {
  const { settings, mounted, devosMode } = useStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sseConnected, setSseConnected] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const esRef = useRef<EventSource | null>(null)
  const historyLoadedRef = useRef(false)

  // ── Load chat history on mount ───────────────────────────────────────────
  useEffect(() => {
    if (!mounted || historyLoadedRef.current) return
    historyLoadedRef.current = true

    fetch(`${API}/api/chat/history`)
      .then(r => r.ok ? r.json() : null)
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const historical: Message[] = data.map((m: any) => ({
            id: m.id || crypto.randomUUID(),
            role: m.role === 'user' ? 'user' : 'devos',
            content: m.content || m.message || '',
            timestamp: m.timestamp || m.createdAt || new Date().toISOString(),
            type: m.type || 'info',
            goalId: m.goalId
          }))
          setMessages(historical)
          return
        }
        // Fallback: personalised briefing or default greeting
        const name = settings.userName ? `, ${settings.userName}` : ''
        const fallback = `Hey${name}! I'm DevOS — I build and ship software autonomously. What do you want to create today?`
        fetch(`${API}/api/personal/briefing`)
          .then(r => r.ok ? r.json() : null)
          .then(d => {
            setMessages([{
              id: crypto.randomUUID(),
              role: 'devos',
              content: d?.briefing || fallback,
              timestamp: new Date().toISOString(),
              type: 'info'
            }])
          })
          .catch(() => {
            setMessages([{
              id: crypto.randomUUID(),
              role: 'devos',
              content: fallback,
              timestamp: new Date().toISOString(),
              type: 'info'
            }])
          })
      })
      .catch(() => {
        const name = settings.userName ? `, ${settings.userName}` : ''
        setMessages([{
          id: crypto.randomUUID(),
          role: 'devos',
          content: `Hey${name}! I'm DevOS — I build and ship software autonomously. What do you want to create today?`,
          timestamp: new Date().toISOString(),
          type: 'info'
        }])
      })
  }, [mounted])

  // ── SSE stream: agent events → inline messages ────────────────────────────
  useEffect(() => {
    const connect = () => {
      const es = new EventSource(`${API}/api/stream`)
      esRef.current = es
      es.onopen = () => setSseConnected(true)
      es.onerror = () => {
        setSseConnected(false)
        setTimeout(connect, 5000)
      }
      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data)
          const item = buildChatItem(event)
          if (!item) return
          setMessages(prev => [...prev, item])
        } catch { /* ignore */ }
      }
    }
    connect()
    return () => { esRef.current?.close() }
  }, [])

  // ── QuickLaunch injection ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const query = (e as CustomEvent).detail?.query
      if (query) {
        setInput(query)
        textareaRef.current?.focus()
      }
    }
    window.addEventListener('devos:quicklaunch', handler)
    return () => window.removeEventListener('devos:quicklaunch', handler)
  }, [])

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Build inline chat items from SSE events ───────────────────────────────
  function buildChatItem(event: any): Message | null {
    if (event.type === 'goal_started') {
      return {
        id: crypto.randomUUID(),
        role: 'devos',
        content: `🎯 Goal started: ${event.title || event.goalId || ''}`,
        timestamp: new Date().toISOString(),
        type: 'info',
        goalId: event.goalId || event.id
      }
    }
    if (event.type === 'goal_completed') return msg(`✅ Done: ${event.title || event.goalId || ''}`, 'success')
    if (event.type === 'goal_failed')    return msg(`❌ Failed: ${event.error || event.goalId || ''}`, 'error')
    if (event.type === 'mission:complete') return msg(`🚀 Mission complete: ${event.goal || ''}`, 'success')
    if (event.type === 'approval_required') return msg(`⚠️ Needs approval: ${event.actionDescription}`, 'info')
    return null
  }

  function msg(content: string, type: Message['type']): Message {
    return { id: crypto.randomUUID(), role: 'devos', content, timestamp: new Date().toISOString(), type }
  }

  // ── Send ──────────────────────────────────────────────────────────────────
  const send = async () => {
    if (!input.trim() || loading) return
    const text = input.trim()
    setInput('')
    setLoading(true)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    setMessages(prev => [...prev, {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role: 'user', content: text, timestamp: new Date().toISOString()
    }])

    const msgId = `devos-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setMessages(prev => [...prev, {
      id: msgId, role: 'devos', content: '▌', timestamp: new Date().toISOString(), type: 'info'
    }])

    try {
      const res = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      })

      if (!res.ok || !res.body) {
        const goal = await fetch(`${API}/api/goals/v2`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: text.slice(0, 60), description: text, async: true })
        }).then(r => r.json()).catch(() => ({}))
        setMessages(prev => prev.map(m => m.id === msgId ? {
          ...m,
          content: `🚀 Goal created and running. I'll update you as it progresses.${goal?.id ? ` (ID: ${goal.id})` : ''}`,
          goalId: goal?.id
        } : m))
        setLoading(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          try {
            const raw = line.slice(6).trim()
            if (raw === '[DONE]') {
              setMessages(prev => prev.map(m =>
                m.id === msgId ? { ...m, content: accumulated || 'Done.' } : m
              ))
              break
            }
            const data = JSON.parse(raw)
            const token = data.chunk || data.token || ''
            if (token) {
              accumulated += token
              setMessages(prev => prev.map(m =>
                m.id === msgId ? { ...m, content: accumulated + '▌' } : m
              ))
            }
            // goal_started inside stream → add MissionCard
            if (data.type === 'goal_started' && data.goalId) {
              setMessages(prev => {
                const updated = prev.map(m =>
                  m.id === msgId ? { ...m, content: accumulated || 'On it.', goalId: data.goalId } : m
                )
                return updated
              })
            }
            if (data.error) {
              setMessages(prev => prev.map(m =>
                m.id === msgId ? { ...m, content: `Error: ${data.error}`, type: 'error' } : m
              ))
              break
            }
            if (data.done) {
              setMessages(prev => prev.map(m =>
                m.id === msgId ? { ...m, content: accumulated || 'Done.' } : m
              ))
              break
            }
          } catch { /* ignore */ }
        }
      }
      setMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, content: accumulated || 'Done.' } : m
      ))
    } catch {
      setMessages(prev => prev.map(m => m.id === msgId
        ? { ...m, content: 'Could not reach DevOS API. Is the server running?', type: 'error' } : m))
    }
    setLoading(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full" style={{ background: 'transparent' }}>
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center space-x-3">
          <span className="text-lg font-bold text-white">DevOS</span>
          <div className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-green-400' : 'bg-gray-600'}`}
            style={sseConnected ? { boxShadow: '0 0 8px #4ade80' } : {}} />
        </div>
        <div className="flex items-center space-x-3">
          {mounted && settings.userName && (
            <span className="text-sm text-gray-500">Hey, {settings.userName} 👋</span>
          )}
          <span className="hidden md:inline text-xs rounded-lg px-2 py-1"
            style={{ color: 'rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            ⌘K
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} items-end space-x-2`}>
            {m.role === 'devos' && (
              <div className="w-8 h-8 rounded-2xl flex items-center justify-center text-sm shrink-0"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>⚡</div>
            )}
            <div className="max-w-xl w-full">
              <div className="rounded-3xl px-4 py-3 text-sm"
                style={{
                  background: m.role === 'user' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                    : m.type === 'error' ? 'rgba(239,68,68,0.15)'
                    : m.type === 'success' ? 'rgba(34,197,94,0.1)'
                    : 'rgba(255,255,255,0.07)',
                  border: m.role === 'user' ? 'none'
                    : m.type === 'error' ? '1px solid rgba(239,68,68,0.3)'
                    : m.type === 'success' ? '1px solid rgba(34,197,94,0.2)'
                    : '1px solid rgba(255,255,255,0.08)',
                  color: 'white',
                  backdropFilter: 'blur(10px)'
                }}>
                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
              </div>
              {/* MissionCard renders below the message when a goalId is attached */}
              {m.goalId && <MissionCard goalId={m.goalId} />}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start items-end space-x-2">
            <div className="w-8 h-8 rounded-2xl flex items-center justify-center text-sm"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>⚡</div>
            <div className="px-4 py-3 rounded-3xl"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex space-x-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-indigo-400"
                    style={{ animation: `bounce 1s ease-in-out ${i * 0.15}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick suggestions */}
      {messages.length <= 1 && (
        <div className="px-6 pb-3">
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.slice(0, 3).map((s, i) => (
              <button key={i} onClick={() => setInput(s)}
                className="text-xs px-3 py-1.5 rounded-full text-gray-400 transition-all hover:text-white"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {s.slice(0, 40)}...
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-6 pb-6">
        <div className="flex items-end space-x-3 p-3 rounded-3xl"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)' }}>
          <button onClick={() => setInput(SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)])}
            className="p-2 rounded-2xl transition-colors hover:text-indigo-400 shrink-0"
            style={{ color: 'rgba(255,255,255,0.3)' }}>
            <Sparkles size={18} />
          </button>
          <textarea
            ref={textareaRef}
            rows={1}
            className="flex-1 bg-transparent text-white placeholder-gray-600 text-sm resize-none focus:outline-none"
            placeholder={devosMode === 'personal' ? 'What do you want to do today?' : 'What do you want to build? (Enter to send, Shift+Enter for newline)'}
            value={input}
            onChange={e => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="p-2 rounded-2xl transition-all hover:scale-110 disabled:opacity-30 shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}>
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
