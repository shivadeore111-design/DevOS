import fs from 'fs'
import path from 'path'

const AUDIT_PATH = path.join(process.cwd(), 'workspace', 'audit', 'audit.jsonl')

export type AuditEntry = {
  id: string
  ts: number
  action: 'chat' | 'tool' | 'plan' | 'system'
  tool?: string
  input?: string
  output?: string
  durationMs: number
  success: boolean
  error?: string
  goal?: string
  traceId?: string
}

export class AuditTrail {
  constructor() {
    fs.mkdirSync(path.dirname(AUDIT_PATH), { recursive: true })
  }

  record(entry: Omit<AuditEntry, 'id' | 'ts'>): void {
    const full: AuditEntry = {
      id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      ts: Date.now(),
      ...entry,
    }
    fs.appendFileSync(AUDIT_PATH, JSON.stringify(full) + '\n')
  }

  getToday(): AuditEntry[] {
    if (!fs.existsSync(AUDIT_PATH)) return []
    const today = new Date().toDateString()
    return fs.readFileSync(AUDIT_PATH, 'utf-8')
      .trim().split('\n').filter(Boolean)
      .map(l => { try { return JSON.parse(l) } catch { return null } })
      .filter(e => e && new Date(e.ts).toDateString() === today)
  }

  formatSummary(entries: AuditEntry[]): string {
    if (entries.length === 0) return 'No activity today.'
    const success = entries.filter(e => e.success).length
    const failed  = entries.length - success
    const tools: Record<string, number> = {}
    for (const e of entries) {
      if (e.tool) tools[e.tool] = (tools[e.tool] || 0) + 1
    }
    const topTools = Object.entries(tools)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([t, c]) => `  ${t}: ${c}x`).join('\n')
    const failures = entries.filter(e => !e.success).slice(-3)
      .map(e => `  - ${e.tool || e.action}: ${e.error || 'unknown error'}`).join('\n')

    return `DevOS Activity — ${new Date().toLocaleDateString()}
Actions: ${entries.length} total | ${success} succeeded | ${failed} failed
Avg duration: ${Math.round(entries.reduce((s, e) => s + e.durationMs, 0) / entries.length)}ms

Top tools:
${topTools || '  none'}
${failures ? `\nRecent failures:\n${failures}` : ''}`
  }
}

export const auditTrail = new AuditTrail()
