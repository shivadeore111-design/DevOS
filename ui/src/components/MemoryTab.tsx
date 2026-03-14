import { useEffect, useState } from 'react'
import { api } from '../api/client'

export function MemoryTab() {
  const [entries, setEntries] = useState<any[]>([])
  const [stats, setStats]     = useState<any>(null)
  const [query, setQuery]     = useState('')
  const [answer, setAnswer]   = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      const [e, s] = await Promise.all([api.listKnowledge(), api.getMemoryStats()])
      setEntries((e || []) as any[])
      setStats(s)
    }
    load()
  }, [])

  const search = async () => {
    if (!query.trim()) return
    setLoading(true)
    const result = await api.queryKnowledge(query)
    setAnswer(result.answer || 'No answer found.')
    setLoading(false)
  }

  return (
    <div className="h-full bg-devos-surface rounded-lg border border-devos-border flex flex-col space-y-4 p-4 overflow-y-auto">
      <div>
        <h2 className="text-sm font-semibold text-devos-text mb-3">Knowledge Base</h2>
        {stats && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-devos-bg rounded-lg p-3 border border-devos-border text-center">
              <p className="text-xl font-bold text-devos-accent">{stats.totalEntries || 0}</p>
              <p className="text-xs text-devos-muted">Entries</p>
            </div>
            <div className="bg-devos-bg rounded-lg p-3 border border-devos-border text-center">
              <p className="text-xl font-bold text-devos-green">
                {Math.round((stats.successRate || 0) * 100)}%
              </p>
              <p className="text-xs text-devos-muted">Success Rate</p>
            </div>
            <div className="bg-devos-bg rounded-lg p-3 border border-devos-border text-center">
              <p className="text-xl font-bold text-devos-text">{stats.topPatterns?.length || 0}</p>
              <p className="text-xs text-devos-muted">Patterns</p>
            </div>
          </div>
        )}
        <div className="flex space-x-2 mb-3">
          <input
            className="flex-1 bg-devos-bg border border-devos-border rounded-lg px-3 py-2 text-sm text-devos-text placeholder-devos-muted focus:outline-none focus:border-devos-accent"
            placeholder="Ask the knowledge base..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
          />
          <button
            onClick={search}
            disabled={loading}
            className="bg-devos-accent hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium"
          >
            Ask
          </button>
        </div>
        {answer && (
          <div className="bg-devos-bg border border-devos-border rounded-lg p-3 text-sm text-devos-text mb-3">
            {answer}
          </div>
        )}
      </div>
      <div className="space-y-2">
        {entries.slice(0, 20).map((e: any) => (
          <div key={e.id} className="bg-devos-bg rounded-lg p-3 border border-devos-border">
            <p className="text-sm font-medium text-devos-text">{e.title}</p>
            <p className="text-xs text-devos-muted mt-1 line-clamp-2">{e.content?.slice(0, 120)}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {(e.tags || []).map((tag: string) => (
                <span key={tag} className="text-xs bg-devos-accent/20 text-devos-accent px-1.5 py-0.5 rounded">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
