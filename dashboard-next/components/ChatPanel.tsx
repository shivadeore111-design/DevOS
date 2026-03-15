'use client'
import { useState, useEffect, useRef } from 'react'
import { Send, Sparkles } from 'lucide-react'
import { api } from '../lib/api'

interface Message {
  id: string
  role: 'user' | 'devos'
  content: string
  timestamp: string
  type?: 'info' | 'success' | 'error' | 'progress'
}

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '0', role: 'devos', content: '👋 DevOS ready. What do you want to build?', timestamp: new Date().toISOString(), type: 'info' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sseConnected, setSseConnected] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load chat history on mount
  useEffect(() => {
    api.getChatHistory().then((history: any) => {
      if (Array.isArray(history) && history.length > 0) {
        setMessages(history.map((m: any) => ({
          id: m.id || Date.now().toString(),
          role: m.role === 'devos' ? 'devos' : 'user',
          content: m.content,
          timestamp: m.timestamp
        })))
      }
    }).catch(() => {})
  }, [])

  // SSE live updates
  useEffect(() => {
    const es = api.stream()
    es.onopen = () => setSseConnected(true)
    es.onerror = () => setSseConnected(false)
    es.onmessage = (e: MessageEvent) => {
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
      } catch {}
    }
    return () => es.close()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const formatEvent = (event: any): string | null => {
    if (event.type === 'goal_started') return `🎯 Goal started: ${event.title || ''}`
    if (event.type === 'goal_completed') return `✅ Done: ${event.title || ''}`
    if (event.type === 'goal_failed') return `❌ Failed: ${event.error || ''}`
    if (event.type === 'mission:complete') return `🚀 Mission complete: ${event.goal || ''}`
    if (event.type === 'agent_thinking') return `[${event.agent}] ${event.message}`
    if (event.type === 'approval_required') return `⚠️ Approval needed: ${event.actionDescription}`
    return null
  }

  const send = async () => {
    if (!input.trim() || loading) return
    const text = input.trim()
    setInput('')
    setLoading(true)

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    }])

    // Stream from /api/chat
    try {
      const res = await api.chatStream(text)
      if (!res.body) throw new Error('No stream')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      const msgId = Date.now().toString()

      setMessages(prev => [...prev, {
        id: msgId, role: 'devos', content: '▌',
        timestamp: new Date().toISOString(), type: 'info'
      }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter((l: string) => l.startsWith('data: '))
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data === '[DONE]' || line.slice(6).trim() === '[DONE]') {
              setMessages(prev => prev.map(m =>
                m.id === msgId ? { ...m, content: accumulated } : m
              ))
              continue
            }
            if (data.chunk) {
              accumulated += data.chunk
              setMessages(prev => prev.map(m =>
                m.id === msgId ? { ...m, content: accumulated + '▌' } : m
              ))
            }
          } catch {}
        }
      }
      // Ensure cursor removed on completion
      setMessages(prev => prev.map(m =>
        m.id === msgId && m.content.endsWith('▌')
          ? { ...m, content: m.content.slice(0, -1) }
          : m
      ))
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now().toString(), role: 'devos',
        content: 'Connection error — is DevOS server running?',
        timestamp: new Date().toISOString(), type: 'error'
      }])
    }
    setLoading(false)
  }

  const surpriseMe = () => {
    const prompts = [
      'Build a REST API with auth and CRUD endpoints',
      'Research the top SaaS trends in 2025',
      'Create a simple web scraper for Hacker News',
      'Build a CLI tool for managing todos',
      'Research competitors to CoachOS'
    ]
    setInput(prompts[Math.floor(Math.random() * prompts.length)])
    textareaRef.current?.focus()
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--devos-bg)' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center space-x-2"
        style={{ borderColor: 'var(--devos-border)' }}>
        <span className="font-semibold" style={{ color: 'var(--devos-text)' }}>DevOS</span>
        <div className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'devos' && (
              <span className="mr-2 text-lg">🤖</span>
            )}
            <div className={`max-w-2xl rounded-xl px-4 py-2 text-sm ${
              m.role === 'user'
                ? 'text-white'
                : m.type === 'error'
                ? 'border'
                : 'border'
            }`} style={{
              background: m.role === 'user'
                ? 'var(--devos-accent)'
                : m.type === 'error'
                ? '#1a0a0a'
                : 'var(--devos-surface)',
              borderColor: m.type === 'error'
                ? 'var(--devos-red)'
                : 'var(--devos-border)',
              color: m.role === 'user' ? 'white' : 'var(--devos-text)'
            }}>
              <p className="whitespace-pre-wrap">{m.content}</p>
              <p className="text-xs mt-1 opacity-50">
                {new Date(m.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--devos-border)' }}>
        <div className="flex items-end space-x-2">
          <button onClick={surpriseMe} className="p-2 rounded-lg transition-colors hover:opacity-80"
            style={{ color: 'var(--devos-muted)' }} title="Surprise me">
            <Sparkles size={18} />
          </button>
          <textarea
            ref={textareaRef}
            rows={1}
            className="flex-1 rounded-xl px-4 py-2 text-sm resize-none focus:outline-none"
            style={{
              background: 'var(--devos-surface)',
              border: '1px solid var(--devos-border)',
              color: 'var(--devos-text)'
            }}
            placeholder="What do you want to build?"
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
          <button onClick={send} disabled={!input.trim() || loading}
            className="p-2 rounded-xl transition-colors disabled:opacity-40"
            style={{ background: 'var(--devos-accent)', color: 'white' }}>
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
