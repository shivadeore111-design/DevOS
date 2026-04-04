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

// ── Types ────────────────────────────────────────────────────────

export interface UserProfileAnswers {
  name:          string
  role:          string
  timezone:      string
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

  const content = `# User Profile
Name: ${answers.name.trim()}
Role: ${answers.role.trim()}
Timezone: ${answers.timezone}
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
