// ============================================================
// DevOS — Aiden Skill Registry Worker
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
// Route: skills.taracod.com/*
// KV binding: AIDEN_SKILLS  key format: skill:<name>
//
// Endpoints:
//   GET  /skills              → list all (paginated)
//   GET  /skills/search?q=X  → BM25 search
//   GET  /skills/:name        → skill manifest + SKILL.md
//   GET  /skills/:name/files  → SKILL.md + extra files
//   POST /skills              → publish (requires X-License-Key header)

// ── Tiny router (no npm in Workers — hand-rolled) ───────────

function matchRoute(method, pathname, routes) {
  for (const [m, pattern, handler] of routes) {
    if (m !== method && m !== '*') continue
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$')
    const match = pathname.match(re)
    if (match) return { handler, params: match.groups || {} }
  }
  return null
}

// ── CORS ────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-License-Key',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

// ── BM25-lite ────────────────────────────────────────────────

function bm25Score(query, text, k1 = 1.5, b = 0.75, avgDocLen = 200) {
  const qtoks = query.toLowerCase().split(/\W+/).filter(Boolean)
  const dtoks = text.toLowerCase().split(/\W+/)
  const dl    = dtoks.length
  let score   = 0
  for (const t of qtoks) {
    const tf  = dtoks.filter(w => w === t).length
    const idf = Math.log((1 + 1) / (0.5 + tf > 0 ? 1 : 0.5) + 1)
    score += idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (dl / avgDocLen)))
  }
  return score
}

// ── Helpers ──────────────────────────────────────────────────

function safeName(name) {
  return name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase().slice(0, 64)
}

function summary(s) {
  return {
    name:        s.name,
    version:     s.version,
    author:      s.author,
    description: s.description,
    tools_used:  s.tools_used || [],
    tags:        s.tags       || [],
    downloads:   s.downloads  || 0,
    created:     s.created,
    updated:     s.updated,
  }
}

// ── Route handlers ───────────────────────────────────────────

async function listSkills(req, env) {
  const url    = new URL(req.url)
  const page   = Math.max(1, parseInt(url.searchParams.get('page')  || '1'))
  const limit  = Math.min(50, parseInt(url.searchParams.get('limit') || '20'))

  const list   = await env.AIDEN_SKILLS.list({ prefix: 'skill:' })
  const keys   = list.keys.map(k => k.name.replace('skill:', ''))
  const paged  = keys.slice((page - 1) * limit, page * limit)

  const skills = (await Promise.all(
    paged.map(async name => {
      const raw = await env.AIDEN_SKILLS.get(`skill:${name}`)
      if (!raw) return null
      try { return summary(JSON.parse(raw)) } catch { return null }
    })
  )).filter(Boolean)

  return json({ skills, total: keys.length, page, limit, pages: Math.ceil(keys.length / limit) })
}

async function searchSkills(req, env) {
  const url = new URL(req.url)
  const q   = (url.searchParams.get('q') || '').trim()
  if (!q) return json({ error: 'q parameter required' }, 400)

  const list    = await env.AIDEN_SKILLS.list({ prefix: 'skill:' })
  const scored  = []

  for (const key of list.keys) {
    const raw = await env.AIDEN_SKILLS.get(key.name)
    if (!raw) continue
    try {
      const s     = JSON.parse(raw)
      const corpus = [s.name, s.description, (s.tools_used || []).join(' ')].join(' ')
      const score = bm25Score(q, corpus)
      if (score > 0) scored.push({ ...summary(s), _score: score })
    } catch {}
  }

  scored.sort((a, b) => b._score - a._score)
  return json(scored.slice(0, 10).map(({ _score, ...rest }) => rest))
}

async function getSkill(req, env, params) {
  const raw = await env.AIDEN_SKILLS.get(`skill:${params.name}`)
  if (!raw) return json({ error: `Skill "${params.name}" not found` }, 404)
  try {
    const s = JSON.parse(raw)
    // Include skill_json manifest if present (agentskills.io compatibility)
    const resp = { ...summary(s), content: s.content, files: s.files || {} }
    if (s.skill_json) resp.skill_json = s.skill_json
    return json(resp)
  } catch { return json({ error: 'Corrupt skill data' }, 500) }
}

async function getSkillFiles(req, env, params) {
  const raw = await env.AIDEN_SKILLS.get(`skill:${params.name}`)
  if (!raw) return json({ error: `Skill "${params.name}" not found` }, 404)
  try {
    const s = JSON.parse(raw)
    const resp = { name: s.name, content: s.content, files: s.files || {} }
    if (s.skill_json) resp.files['skill.json'] = JSON.stringify(s.skill_json, null, 2)
    return json(resp)
  } catch { return json({ error: 'Corrupt skill data' }, 500) }
}

async function publishSkill(req, env) {
  const license = req.headers.get('X-License-Key') || ''
  if (!license) return json({ error: 'X-License-Key header required (Pro feature)' }, 401)

  let body
  try { body = await req.json() }
  catch { return json({ error: 'Invalid JSON body' }, 400) }

  const { name, version, author, description, tools_used, content, files, skill_json, tags } = body
  if (!name)        return json({ error: 'name is required' },        400)
  if (!description) return json({ error: 'description is required' }, 400)
  if (!content)     return json({ error: 'content (SKILL.md) is required' }, 400)

  const key      = `skill:${safeName(name)}`
  const existing = await env.AIDEN_SKILLS.get(key)
  const prev     = existing ? JSON.parse(existing) : {}

  const skill = {
    name:        safeName(name),
    version:     version     || '1.0.0',
    author:      author      || 'anonymous',
    description: description.slice(0, 300),
    tools_used:  Array.isArray(tools_used) ? tools_used : [],
    tags:        Array.isArray(tags) ? tags : (skill_json?.tags || []),
    content,
    files:       files || {},
    downloads:   prev.downloads || 0,
    created:     prev.created   || new Date().toISOString(),
    updated:     new Date().toISOString(),
    ...(skill_json && { skill_json }),
  }

  await env.AIDEN_SKILLS.put(key, JSON.stringify(skill))
  return json({
    success: true,
    name:    skill.name,
    url:     `https://skills.taracod.com/skills/${skill.name}`,
  }, 201)
}

// ── Route table ──────────────────────────────────────────────

const ROUTES = [
  ['GET',  '/skills/search',       (req, env, params) => searchSkills(req, env)],
  ['GET',  '/skills',              (req, env, params) => listSkills(req, env)],
  ['GET',  '/skills/:name/files',  getSkillFiles],
  ['GET',  '/skills/:name',        getSkill],
  ['POST', '/skills',              (req, env, params) => publishSkill(req, env)],
]

// ── Entry point ──────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url      = new URL(request.url)
    const method   = request.method.toUpperCase()
    const pathname = url.pathname.replace(/\/$/, '') || '/'

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS })
    }

    const route = matchRoute(method, pathname, ROUTES)
    if (!route) return json({ error: 'Not found' }, 404)

    try {
      return await route.handler(request, env, route.params)
    } catch (err) {
      return json({ error: err.message || 'Internal server error' }, 500)
    }
  },
}
