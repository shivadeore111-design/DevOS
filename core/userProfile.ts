// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/userProfile.ts — Explicit user profile stored as workspace/USER.md
// Answers: who the user is, how they communicate, what to monitor.

import fs   from 'fs'
import path from 'path'

// ── Path ────────────────────────────────────────────────────────

export const USER_PROFILE_PATH = path.join(process.cwd(), 'workspace', 'USER.md')

// ── Timezone detection ───────────────────────────────────────────

export function detectTimezone(): { timezone: string; utcOffset: string } {
  const tz     = Intl.DateTimeFormat().resolvedOptions().timeZone
  const offset = new Date().getTimezoneOffset()
  const hours  = Math.abs(Math.floor(offset / 60))
  const mins   = Math.abs(offset % 60)
  const sign   = offset <= 0 ? '+' : '-'
  return {
    timezone:  tz || 'Asia/Kolkata',
    utcOffset: `UTC${sign}${hours}:${mins.toString().padStart(2, '0')}`,
  }
}

// ── Types ────────────────────────────────────────────────────────

export interface UserProfileAnswers {
  name:          string
  role:          string
  timezone?:     string
  utcOffset?:    string
  github?:       string
  monitoring?:   string
  responseStyle?: 'Direct' | 'Detailed' | 'Conversational'
}

// ── Template ─────────────────────────────────────────────────────

export const USER_MD_TEMPLATE = `# User Profile
Name:
Role:
Timezone:
Location:

# Preferences
Response style: Direct, concise, no fluff
Technical level: Expert
Autonomy level: Assistant (auto-organize, ask for external)

# Accounts & Tools
- GitHub:
- Primary browser: Chrome
- Trading platform:
- Communication:

# Proactive Monitoring
- Markets: (e.g. NIFTY, RELIANCE)
- Email: (frequency)
- Folders to watch:
- Repos to monitor:

# Notes
(Anything else Aiden should know)
`

// ── Read ──────────────────────────────────────────────────────────

export function loadUserProfile(): string {
  try {
    if (fs.existsSync(USER_PROFILE_PATH)) {
      return fs.readFileSync(USER_PROFILE_PATH, 'utf-8')
    }
  } catch {}
  return ''
}

export function userProfileExists(): boolean {
  try { return fs.existsSync(USER_PROFILE_PATH) } catch { return false }
}

// ── Write ─────────────────────────────────────────────────────────

export function createUserProfile(answers: UserProfileAnswers): void {
  const styleMap: Record<string, string> = {
    Direct:          'Direct, concise, no fluff',
    Detailed:        'Detailed, thorough explanations',
    Conversational:  'Conversational, friendly tone',
  }
  const styleDesc = styleMap[answers.responseStyle ?? 'Direct'] ?? styleMap.Direct

  // Auto-detect timezone if not provided
  const detected  = detectTimezone()
  const tz        = answers.timezone  || detected.timezone
  const utcOffset = answers.utcOffset || detected.utcOffset

  const content = `# User Profile
Name: ${answers.name.trim()}
Role: ${answers.role.trim()}
Timezone: ${tz} (${utcOffset})
Location:

# Preferences
Response style: ${styleDesc}
Technical level: Expert
Autonomy level: Assistant (auto-organize, ask for external)

# Accounts & Tools
- GitHub: ${answers.github?.trim() ?? ''}
- Primary browser: Chrome
- Trading platform:
- Communication:

# Proactive Monitoring
- Markets: ${answers.monitoring?.trim() ?? ''}
- Email:
- Folders to watch:
- Repos to monitor:

# Notes
(Anything else Aiden should know)
`
  _write(content)
}

export function updateUserProfile(newContent: string): void {
  _write(newContent)
}

// Update only the Preferences section (called by UserCognitionProfile)
export function syncCognitionToProfile(
  verbosity:      'short' | 'balanced' | 'detailed',
  technicalLevel: 'low'   | 'medium'   | 'high',
): void {
  if (!userProfileExists()) return
  try {
    let content = fs.readFileSync(USER_PROFILE_PATH, 'utf-8')

    const verbMap: Record<string, string> = {
      short:    'Direct, concise, no fluff',
      balanced: 'Balanced — key points with context',
      detailed: 'Detailed, thorough explanations',
    }
    const techMap: Record<string, string> = {
      low:    'Beginner',
      medium: 'Intermediate',
      high:   'Expert',
    }

    content = content.replace(
      /^(Response style:\s*).*$/m,
      `$1${verbMap[verbosity] ?? verbMap.balanced}`,
    )
    content = content.replace(
      /^(Technical level:\s*).*$/m,
      `$1${techMap[technicalLevel] ?? techMap.medium}`,
    )
    fs.writeFileSync(USER_PROFILE_PATH, content, 'utf-8')
  } catch {}
}

// ── Internal ──────────────────────────────────────────────────────

function _write(content: string): void {
  try {
    fs.mkdirSync(path.dirname(USER_PROFILE_PATH), { recursive: true })
    fs.writeFileSync(USER_PROFILE_PATH, content, 'utf-8')
  } catch {}
}

// ============================================================
// N+33 — Honcho-style structured JSON user profile
// Stored at workspace/user-profile.json (separate from USER.md)
// ============================================================

export interface ProjectEntry {
  name:           string
  status:         string   // 'active' | 'paused' | 'completed' | 'idea'
  last_mentioned: string   // ISO date
  notes:          string
}

export interface RelationshipEntry {
  name:    string
  role:    string
  context: string
}

export interface HonchoProfile {
  identity: {
    name:       string
    pronouns:   string
    timezone:   string
    location:   string
    occupation: string
  }
  preferences: {
    communication_style: string
    response_length:     string
    favorite_topics:     string[]
    pet_peeves:          string[]
  }
  projects:      ProjectEntry[]
  relationships: RelationshipEntry[]
  skills_known:  string[]
  current_goals: string[]
  last_updated:  string
}

export type ProfileSlice = keyof Omit<HonchoProfile, 'last_updated'>

export const HONCHO_PROFILE_PATH = path.join(process.cwd(), 'workspace', 'user-profile.json')

export function emptyHonchoProfile(): HonchoProfile {
  return {
    identity:      { name: '', pronouns: '', timezone: '', location: '', occupation: '' },
    preferences:   { communication_style: '', response_length: '', favorite_topics: [], pet_peeves: [] },
    projects:      [],
    relationships: [],
    skills_known:  [],
    current_goals: [],
    last_updated:  new Date().toISOString(),
  }
}

export async function getProfile(): Promise<HonchoProfile> {
  try {
    if (fs.existsSync(HONCHO_PROFILE_PATH)) {
      return JSON.parse(fs.readFileSync(HONCHO_PROFILE_PATH, 'utf-8')) as HonchoProfile
    }
  } catch {}
  return emptyHonchoProfile()
}

export async function updateProfile(facts: string[]): Promise<HonchoProfile> {
  if (facts.length === 0) return getProfile()

  let callLLM: Function
  try {
    const mod = await import('./agentLoop')
    callLLM   = mod.callLLM
  } catch {
    console.warn('[userProfile] could not import callLLM — skipping profile update')
    return getProfile()
  }

  const existing = await getProfile()
  const { getModelForTask } = await import('../providers/router')
  const tier = getModelForTask('planner')

  const prompt = `You are a user profile manager for an AI assistant. Update the profile with new facts.
Output the FULL updated profile as JSON. Merge conservatively — don't delete existing info unless explicitly contradicted.

RULES:
- identity fields: only update if explicitly stated ("my name is X", "I live in Y")
- preferences: append to lists unless contradicted, update strings if clearer info available
- projects: add new projects, update status of existing ones by name match, never delete
- relationships: add new, update context for existing by name match
- skills_known: append new skills, no duplicates
- current_goals: replace with new goals if user stated clear new priorities, otherwise append
- last_updated: set to ${new Date().toISOString()}

CURRENT PROFILE:
${JSON.stringify(existing, null, 2)}

NEW FACTS:
${facts.map(f => `- ${f}`).join('\n')}

Output ONLY valid JSON matching the exact profile structure. No markdown, no explanation.`

  try {
    const raw  = await callLLM(prompt, tier.apiKey, tier.model, tier.providerName)
    const text = typeof raw === 'string' ? raw : (raw?.content ?? '')
    const json = text.match(/\{[\s\S]*\}/)
    if (!json) throw new Error('no JSON in LLM response')

    const updated = JSON.parse(json[0]) as HonchoProfile
    if (!updated.identity || !updated.preferences || !Array.isArray(updated.projects)) {
      throw new Error('invalid profile shape')
    }
    updated.last_updated = new Date().toISOString()

    fs.mkdirSync(path.dirname(HONCHO_PROFILE_PATH), { recursive: true })
    fs.writeFileSync(HONCHO_PROFILE_PATH, JSON.stringify(updated, null, 2) + '\n', 'utf-8')
    console.log(`[userProfile] Honcho profile updated (${facts.length} new facts)`)
    return updated

  } catch (e: any) {
    console.warn('[userProfile] updateProfile LLM merge failed:', e.message)
    return _naiveHonchoMerge(existing, facts)
  }
}

export function classifyQueryForProfile(query: string): ProfileSlice[] {
  const slices = new Set<ProfileSlice>()

  if (/project|building|work(ing)? on|product|app|feature|deploy|codebase|repo/i.test(query))
    slices.add('projects')
  if (/goal|todo|to-?do|priority|priorities|focus|backlog|what should i/i.test(query))
    slices.add('current_goals')
  if (/who is|tell.*about|relationship|friend|wife|husband|partner|kid|colleague|coworker|team/i.test(query))
    slices.add('relationships')
  if (/skill|know how|experience|background|expertise|language|framework/i.test(query))
    slices.add('skills_known')
  if (/prefer|like|dislike|style|format|tone|length|detail/i.test(query))
    slices.add('preferences')
  if (/time|timezone|where|location|live|based|name|who am i|about me/i.test(query))
    slices.add('identity')
  if (/remember|recall|told you|mentioned|last time|previous/i.test(query))
    return ['identity', 'preferences', 'projects', 'relationships', 'skills_known', 'current_goals']

  if (slices.size === 0) { slices.add('identity'); slices.add('preferences') }
  return [...slices]
}

export async function formatForPrompt(query: string): Promise<string> {
  const profile = await getProfile()
  const slices  = classifyQueryForProfile(query)
  const parts: string[] = []

  for (const slice of slices) {
    const val = (profile as any)[slice]
    if (!val) continue
    const s = JSON.stringify(val, null, 2)
    if (s === '[]' || s === '""' || s === 'null') continue
    if (typeof val === 'object' && !Array.isArray(val)) {
      const hasContent = Object.values(val as object).some(v =>
        Array.isArray(v) ? v.length > 0 : Boolean(v)
      )
      if (!hasContent) continue
    }
    parts.push(`### ${slice}\n${s}`)
  }

  if (parts.length === 0) return ''
  let combined = parts.join('\n\n')
  if (combined.length > 1600) combined = combined.slice(0, 1597) + '…'
  return `\n\nUSER PROFILE (relevant slices):\n${combined}\n`
}

export function clearHonchoProfile(): void {
  try { if (fs.existsSync(HONCHO_PROFILE_PATH)) fs.unlinkSync(HONCHO_PROFILE_PATH) } catch {}
}

function _naiveHonchoMerge(profile: HonchoProfile, facts: string[]): HonchoProfile {
  const updated = { ...profile, last_updated: new Date().toISOString() }
  for (const fact of facts) {
    if (/knows?|uses?|familiar with|experience (in|with)/i.test(fact)) {
      const skill = fact.replace(/.*(?:knows?|uses?|familiar with|experience (?:in|with))\s*/i, '').trim()
      if (skill && skill.length < 40 && !updated.skills_known.includes(skill))
        updated.skills_known = [...updated.skills_known, skill]
    }
    if (/goal|want to|working on|trying to|building/i.test(fact)) {
      if (!updated.current_goals.some(g => g.toLowerCase().includes(fact.toLowerCase().slice(0, 30))))
        updated.current_goals = [...updated.current_goals, fact].slice(-10)
    }
  }
  try {
    fs.mkdirSync(path.dirname(HONCHO_PROFILE_PATH), { recursive: true })
    fs.writeFileSync(HONCHO_PROFILE_PATH, JSON.stringify(updated, null, 2) + '\n', 'utf-8')
  } catch {}
  return updated
}
