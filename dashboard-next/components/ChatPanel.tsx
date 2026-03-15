'use client'
import { useState, useEffect, useRef } from 'react'
import { Send, Sparkles } from 'lucide-react'
import { useStore } from '../lib/store'

interface Message {
  id: string
  role: 'user' | 'devos'
  content: string
  timestamp: string
  type?: 'info' | 'success' | 'error' | 'progress'
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
  const { settings } = useStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sseConnected, setSseConnected] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const name = settings.userName ? `, ${settings.userName}` : ''
    setMessages([{
      id: '0',
      role: 'devos',
      content: `Hey${name}! I'm DevOS — I build and ship software autonomously. What do you want to create today?`,
      timestamp: new Date().toISOString(),
      type: 'info'
    }])
  }, [settings.userName])

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
          const content = formatEvent(event)
          if (!content) return
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'devos',
            content,
            timestamp: new Date().toISOString(),
            type: event.type?.includes('failed') ? 'error' : 'progress'
          }])
        } catch { /* ignore */ }
      }
    }
    connect()
    return () => { esRef.current?.close() }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const formatEvent = (event: any): string | null => {
    if (event.type === 'goal_started') return `🎯 Starting: ${event.title || ''}`
    if (event.type === 'goal_completed') return `✅ Done: ${event.title || ''}`
    if (event.type === 'goal_failed') return `❌ Failed: ${event.error || ''}`
    if (event.type === 'mission:complete') return `🚀 Mission complete: ${event.goal || ''}`
    if (event.type === 'agent_thinking') return `[${event.agent}] ${event.message}`
    if (event.type === 'approval_required') return `⚠️ Needs approval: ${event.actionDescription}`
    return null
  }

  const send = async () => {
    if (!input.trim() || loading) return
    const text = input.trim()
    setInput('')
    setLoading(true)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    setMessages(prev => [...prev, {
      id: Date.now().toString(), role: 'user', content: text, timestamp: new Date().toISOString()
    }])

    const msgId = (Date.now() + 1).toString()
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
        }).then(r => r.json())
        setMessages(prev => prev.map(m => m.id === msgId ? {
          ...m, content: `🚀 Goal created and running. I'll update you as it progresses.${goal?.id ? ` (ID: ${goal.id})` : ''}`
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
            const data = JSON.parse(line.slice(6))
            if (data.token) {
              accumulated += data.token
              setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: accumulated + '▌' } : m))
            }
            if (data.done || data.error) {
              setMessages(prev => prev.map(m => m.id === msgId
                ? { ...m, content: accumulated || (data.error ? `Error: ${data.error}` : 'Done.') } : m))
            }
          } catch { /* ignore */ }
        }
      }
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: accumulated || 'Done.' } : m))
    } catch {
      setMessages(prev => prev.map(m => m.id === msgId
        ? { ...m, content: 'Could not reach DevOS API. Is the server running? (`npx ts-node index.ts serve`)', type: 'error' } : m))
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'transparent' }}>
      <div className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center space-x-3">
          <span className="text-lg font-bold text-white">DevOS</span>
          <div className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-green-400' : 'bg-gray-600'}`}
            style={sseConnected ? { boxShadow: '0 0 8px #4ade80' } : {}} />
        </div>
        {settings.userName && <span className="text-sm text-gray-500">Hey, {settings.userName} 👋</span>}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} items-end space-x-2`}>
            {m.role === 'devos' && (
              <div className="w-8 h-8 rounded-2xl flex items-center justify-center text-sm shrink-0"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>⚡</div>
            )}
            <div className="max-w-xl rounded-3xl px-4 py-3 text-sm"
              style={{
                background: m.role === 'user' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                  : m.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.07)',
                border: m.role === 'user' ? 'none'
                  : m.type === 'error' ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.08)',
                color: 'white', backdropFilter: 'blur(10px)'
              }}>
              <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start items-end space-x-2">
            <div className="w-8 h-8 rounded-2xl flex items-center justify-center text-sm"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>⚡</div>
            <div className="px-4 py-3 rounded-3xl" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex space-x-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-indigo-400"
                    style={{ animation: `bounce 1s ease-in-out ${i * 0.15}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

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

      <div className="px-6 pb-6">
        <div className="flex items-end space-x-3 p-3 rounded-3xl"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)' }}>
          <button onClick={() => setInput(SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)])}
            className="p-2 rounded-2xl transition-colors hover:text-indigo-400 shrink-0"
            style={{ color: 'rgba(255,255,255,0.3)' }}>
            <Sparkles size={18} />
          </button>
          <textarea ref={textareaRef} rows={1}
            className="flex-1 bg-transparent text-white placeholder-gray-600 text-sm resize-none focus:outline-none"
            placeholder="What do you want to build?"
            value={input}
            onChange={e => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          />
          <button onClick={send} disabled={!input.trim() || loading}
            className="p-2 rounded-2xl transition-all hover:scale-110 disabled:opacity-30 shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}>
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
