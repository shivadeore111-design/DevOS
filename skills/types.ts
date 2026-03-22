// ============================================================
// skills/types.ts — SKILL.md system type definitions
// Compatible with OpenClaw community skill format
// ============================================================

export interface SkillMeta {
  name:        string
  description: string
  version?:    string
  author?:     string
  homepage?:   string
  requires?: {
    bins?: string[]
    env?:  string[]
  }
  os?:         ('win32' | 'darwin' | 'linux')[]
  tags?:       string[]
}

export interface Skill {
  meta:         SkillMeta
  instructions: string
  location:     string
  enabled:      boolean
}
