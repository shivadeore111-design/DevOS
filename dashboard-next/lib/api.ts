const BASE = process.env.NEXT_PUBLIC_DEVOS_API || 'http://localhost:4200'

async function req(method: string, path: string, body?: any) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store'
  })
  if (!res.ok) return null
  return res.json().catch(() => null)
}

export const api = {
  getHealth: () => req('GET', '/api/system/health'),
  getStatus: () => req('GET', '/api/system/status'),
  listGoals: () => req('GET', '/api/goals/v2'),
  getGoal: (id: string) => req('GET', `/api/goals/v2/${id}`),
  submitGoal: (title: string, description: string) =>
    req('POST', '/api/goals/v2', { title, description, async: true }),
  listMissions: () => req('GET', '/api/missions'),
  getMission: (id: string) => req('GET', `/api/missions/${id}`),
  startMission: (goal: string, description: string) =>
    req('POST', '/api/missions', { goal, description }),
  listAgents: () => req('GET', '/api/agents'),
  getMessages: () => req('GET', '/api/agents/messages'),
  listPilots: () => req('GET', '/api/pilots'),
  runPilot: (id: string) => req('POST', `/api/pilots/${id}/run`),
  queryKnowledge: (question: string) =>
    req('POST', '/api/knowledge/query', { question }),
  listKnowledge: () => req('GET', '/api/knowledge'),
  getMemoryStats: () => req('GET', '/api/memory/stats'),
  getChatHistory: () => req('GET', '/api/chat/history'),
  getProactive: () => req('GET', '/api/chat/proactive'),
  stream: () => new EventSource(`${BASE}/api/stream`),
  chatStream: (message: string) => {
    return fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    })
  }
}
