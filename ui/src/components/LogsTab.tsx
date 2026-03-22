import { useEffect, useState } from 'react'

export function LogsTab() {
  const [logs, setLogs] = useState<{ time: string; text: string; type: string }[]>([])

  useEffect(() => {
    const es = new EventSource('/api/stream')
    es.onmessage = (e) => {
      const event = JSON.parse(e.data)
      setLogs(prev => [{
        time: new Date().toLocaleTimeString(),
        text: JSON.stringify(event),
        type: event.type || 'info'
      }, ...prev].slice(0, 200))
    }
    return () => es.close()
  }, [])

  return (
    <div className="h-full bg-devos-surface rounded-lg border border-devos-border flex flex-col">
      <div className="px-4 py-3 border-b border-devos-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-devos-text">Logs</h2>
        <span className="text-xs text-devos-muted">{logs.length} events</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 font-mono space-y-1">
        {logs.length === 0 && (
          <p className="text-xs text-devos-muted">Waiting for events...</p>
        )}
        {logs.map((log, i) => (
          <div key={i} className="text-xs flex space-x-2">
            <span className="text-devos-muted shrink-0">{log.time}</span>
            <span className={
              log.type.includes('failed') || log.type.includes('error') ? 'text-devos-red' :
              log.type.includes('completed') ? 'text-devos-green' :
              'text-devos-text'
            }>{log.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
