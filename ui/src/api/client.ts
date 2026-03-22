const BASE = '/api'

async function req(method: string, path: string, body?: any) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  })
  return res.json()
}

export const api = {
  // Goals
  submitGoal: (title: string, description: string) =>
    req('POST', '/goals/v2', { title, description }),
  listGoals:  () => req('GET', '/goals/v2'),
  getGoal:    (id: string) => req('GET', `/goals/v2/${id}`),

  // Agents
  listAgents:  () => req('GET', '/agents'),
  getMessages: () => req('GET', '/agents/messages'),
  coordinate:  (goalId: string) => req('POST', '/agents/coordinate', { goalId }),

  // Pilots
  listPilots: () => req('GET', '/pilots'),
  runPilot:   (id: string) => req('POST', `/pilots/${id}/run`),

  // Knowledge
  queryKnowledge: (question: string) =>
    req('POST', '/knowledge/query', { question }),
  listKnowledge:  () => req('GET', '/knowledge'),

  // Memory
  getMemoryStats: () => req('GET', '/memory/stats'),

  // System
  getHealth: () => req('GET', '/system/health'),
  getStatus: () => req('GET', '/system/status'),

  // SSE stream
  stream: () => new EventSource(`${BASE}/stream`)
}
