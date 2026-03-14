import { useEffect, useState } from 'react'
import { api } from '../api/client'

const STATUS_COLOR: Record<string, string> = {
  idle:      'text-devos-muted',
  thinking:  'text-devos-yellow',
  executing: 'text-devos-accent',
  waiting:   'text-devos-yellow',
  error:     'text-devos-red'
}

const STATUS_DOT: Record<string, string> = {
  idle:      'bg-devos-muted',
  thinking:  'bg-devos-yellow animate-pulse',
  executing: 'bg-devos-accent animate-pulse',
  waiting:   'bg-devos-yellow',
  error:     'bg-devos-red'
}

export function AgentPanel() {
  const [agents, setAgents]     = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      const [a, m] = await Promise.all([api.listAgents(), api.getMessages()])
      setAgents((a || []) as any[])
      setMessages(((m || []) as any[]).slice(0, 20))
    }
    load()
    const interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col h-full bg-devos-surface rounded-lg border border-devos-border">
      <div className="px-4 py-3 border-b border-devos-border">
        <h2 className="text-sm font-semibold text-devos-text">Agents</h2>
        <p className="text-xs text-devos-muted">Live activity</p>
      </div>

      {/* Agent status cards */}
      <div className="p-3 space-y-2 border-b border-devos-border">
        {agents.map((agent: any) => (
          <div key={agent.role} className="flex items-center justify-between p-2 bg-devos-bg rounded-lg">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${STATUS_DOT[agent.status] || 'bg-devos-muted'}`} />
              <span className="text-sm font-medium text-devos-text">{agent.name}</span>
            </div>
            <div className="text-right">
              <p className={`text-xs font-medium ${STATUS_COLOR[agent.status] || 'text-devos-muted'}`}>
                {agent.status}
              </p>
              <p className="text-xs text-devos-muted">{agent.completedTasks} done</p>
            </div>
          </div>
        ))}
      </div>

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <p className="text-xs text-devos-muted uppercase tracking-wider mb-2">Message Thread</p>
        {messages.length === 0 && (
          <p className="text-xs text-devos-muted">No messages yet.</p>
        )}
        {messages.map((msg: any) => (
          <div key={msg.id} className="text-xs p-2 bg-devos-bg rounded border border-devos-border">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-devos-accent uppercase">{msg.fromAgent}</span>
              <span className="text-devos-muted">→ {msg.toAgent}</span>
            </div>
            <p className="text-devos-text truncate">{msg.content}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
