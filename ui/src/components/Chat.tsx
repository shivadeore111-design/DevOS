import { useState, useEffect, useRef } from 'react'
import { api } from '../api/client'

interface Message {
  id: string
  role: 'user' | 'devos'
  content: string
  type?: 'progress' | 'success' | 'error' | 'info'
  timestamp: Date
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'devos',
      content: '👋 DevOS ready. Describe what you want to build.',
      type: 'info',
      timestamp: new Date()
    }
  ])
  const [input, setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // SSE live updates
  useEffect(() => {
    const es = api.stream()
    es.onmessage = (e) => {
      const event   = JSON.parse(e.data)
      const content = formatEvent(event)
      if (!content) return
      setMessages(prev => [...prev, {
        id:        Date.now().toString(),
        role:      'devos',
        content,
        type:      event.type?.includes('failed') ? 'error' : 'progress',
        timestamp: new Date()
      }])
    }
    return () => es.close()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const formatEvent = (event: any): string | null => {
    if (event.type === 'goal_started')    return `🎯 Goal started: ${event.title || ''}`
    if (event.type === 'goal_completed')  return `✅ Goal completed: ${event.title || ''}`
    if (event.type === 'goal_failed')     return `❌ Goal failed: ${event.error || ''}`
    if (event.type === 'task_completed')  return `✓ ${event.title || 'Task done'}`
    if (event.type === 'agent_message')   return `[${event.from?.toUpperCase()}] ${event.content}`
    if (event.type === 'action_executed') return `⚡ ${event.action || ''}`
    return null
  }

  const send = async () => {
    if (!input.trim() || loading) return
    const text = input.trim()
    setInput('')
    setLoading(true)

    setMessages(prev => [...prev, {
      id:        Date.now().toString(),
      role:      'user',
      content:   text,
      timestamp: new Date()
    }])

    const lower = text.toLowerCase()

    if (lower.startsWith('research ') || lower.startsWith('find ')) {
      const result = await api.queryKnowledge(text)
      setMessages(prev => [...prev, {
        id:        Date.now().toString(),
        role:      'devos',
        content:   result.answer || 'No results found.',
        type:      'info',
        timestamp: new Date()
      }])
    } else {
      // Default: treat as goal
      const words = text.split(' ')
      const title = words.slice(0, 6).join(' ')
      const result = await api.submitGoal(title, text)
      setMessages(prev => [...prev, {
        id:        Date.now().toString(),
        role:      'devos',
        content:   `🚀 Goal created (${result.id || 'queued'}). Executing now — watch the activity stream.`,
        type:      'success',
        timestamp: new Date()
      }])
    }

    setLoading(false)
  }

  return (
    <div className="flex flex-col h-full bg-devos-surface rounded-lg border border-devos-border">
      {/* Header */}
      <div className="px-4 py-3 border-b border-devos-border">
        <h2 className="text-sm font-semibold text-devos-text">Chat</h2>
        <p className="text-xs text-devos-muted">Command center</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
              m.role === 'user'
                ? 'bg-devos-accent text-white'
                : m.type === 'error'
                ? 'bg-red-950 text-devos-red border border-red-800'
                : m.type === 'success'
                ? 'bg-green-950 text-devos-green border border-green-800'
                : 'bg-devos-bg text-devos-text border border-devos-border'
            }`}>
              <p className="whitespace-pre-wrap">{m.content}</p>
              <p className="text-xs opacity-50 mt-1">
                {m.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-devos-bg border border-devos-border rounded-lg px-3 py-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-devos-accent rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-devos-accent rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-devos-accent rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-devos-border">
        <div className="flex space-x-2">
          <input
            className="flex-1 bg-devos-bg border border-devos-border rounded-lg px-3 py-2 text-sm text-devos-text placeholder-devos-muted focus:outline-none focus:border-devos-accent"
            placeholder="Describe what you want to build..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
          />
          <button
            onClick={send}
            disabled={loading}
            className="bg-devos-accent hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
