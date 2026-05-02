// ============================================================
// C12 Skill Pollution Prevention Regression Tests
// scripts/test-suite/regression/c12-skill-pollution-prevention.ts
//
// Proves C12 fix: validateSkillName() and validateSkillTask()
// reject garbage skill names (question words, pronoun prefixes,
// personal identifiers, >4 words) and bad task content (too short,
// questions, verbatim user messages).
//
// Also verifies the post-purge workspace/skills/learned/ directory
// contains only valid skills.
//
// Zero I/O — pure logic + filesystem lint.
// ============================================================

import fs   from 'fs'
import path from 'path'
import { runTest, summarize, printResult, C, GroupSummary } from '../utils'

const CWD = process.cwd()

function req<T = any>(relPath: string): T | null {
  try { return require(path.join(CWD, relPath)) as T } catch { return null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Group J — Regression: C12 skill pollution prevention
// ─────────────────────────────────────────────────────────────────────────────

export async function groupJ(): Promise<GroupSummary> {
  console.log(`\n${C.bold}[J] Regression — C12 skill pollution prevention${C.reset}`)
  const results = []

  // ── Load validation functions ─────────────────────────────────────────────
  const mod = req<{
    validateSkillName?: (name: string) => string | null
    validateSkillTask?: (task: string, userMessage?: string) => string | null
  }>('core/skillTeacher')

  // ── J-01: rejects "havent_receviced_any_desktop_notification" (>4 words) ─
  results.push(await runTest('J-01', 'J',
    'rejects "havent_receviced_any_desktop_notification" (>4 words)', () => {
      if (!mod?.validateSkillName) return 'validateSkillName not exported'
      const r = mod.validateSkillName('havent_receviced_any_desktop_notification')
      if (r === null) return 'expected rejection, got null'
      if (!r.includes('>4')) return `expected ">4 words" reason, got: "${r}"`
    }
  ))

  // ── J-02: rejects "what_model_are" (question word) ───────────────────────
  results.push(await runTest('J-02', 'J',
    'rejects "what_model_are" (question word)', () => {
      if (!mod?.validateSkillName) return 'validateSkillName not exported'
      const r = mod.validateSkillName('what_model_are')
      if (r === null) return 'expected rejection, got null'
      if (!r.includes('question')) return `expected "question word" reason, got: "${r}"`
    }
  ))

  // ── J-03: rejects "where_you_opened" (question word) ────────────────────
  results.push(await runTest('J-03', 'J',
    'rejects "where_you_opened" (question word)', () => {
      if (!mod?.validateSkillName) return 'validateSkillName not exported'
      const r = mod.validateSkillName('where_you_opened')
      if (r === null) return 'expected rejection, got null'
      if (!r.includes('question')) return `expected "question word" reason, got: "${r}"`
    }
  ))

  // ── J-04: rejects "its_not_its" (pronoun pattern) ───────────────────────
  results.push(await runTest('J-04', 'J',
    'rejects "its_not_its" (pronoun pattern)', () => {
      if (!mod?.validateSkillName) return 'validateSkillName not exported'
      const r = mod.validateSkillName('its_not_its')
      if (r === null) return 'expected rejection, got null'
      if (!r.includes('pronoun')) return `expected "pronoun" reason, got: "${r}"`
    }
  ))

  // ── J-05: rejects "whats_status_oracle" (whats_ pronoun) ────────────────
  results.push(await runTest('J-05', 'J',
    'rejects "whats_status_oracle" (whats_ pronoun)', () => {
      if (!mod?.validateSkillName) return 'validateSkillName not exported'
      const r = mod.validateSkillName('whats_status_oracle')
      if (r === null) return 'expected rejection, got null'
      if (!r.includes('pronoun')) return `expected "pronoun" reason, got: "${r}"`
    }
  ))

  // ── J-06: rejects "read_users_shiva" (personal identifier "users") ──────
  results.push(await runTest('J-06', 'J',
    'rejects "read_users_shiva" (personal identifier)', () => {
      if (!mod?.validateSkillName) return 'validateSkillName not exported'
      const r = mod.validateSkillName('read_users_shiva')
      if (r === null) return 'expected rejection, got null'
      if (!r.includes('personal')) return `expected "personal identifier" reason, got: "${r}"`
    }
  ))

  // ── J-07: rejects "take_screenshot_users_shiva_desktop" (>4 + personal) ─
  results.push(await runTest('J-07', 'J',
    'rejects "take_screenshot_users_shiva_desktop" (>4 words + personal)', () => {
      if (!mod?.validateSkillName) return 'validateSkillName not exported'
      const r = mod.validateSkillName('take_screenshot_users_shiva_desktop')
      if (r === null) return 'expected rejection, got null'
      // Could match >4 words first or personal identifier — either is valid
    }
  ))

  // ── J-08: accepts "screenshot" (single noun) ────────────────────────────
  results.push(await runTest('J-08', 'J',
    'accepts "screenshot" (valid single noun)', () => {
      if (!mod?.validateSkillName) return 'validateSkillName not exported'
      const r = mod.validateSkillName('screenshot')
      if (r !== null) return `expected null (valid), got rejection: "${r}"`
    }
  ))

  // ── J-09: accepts "web_search" (valid 2-word) ──────────────────────────
  results.push(await runTest('J-09', 'J',
    'accepts "web_search" (valid 2-word)', () => {
      if (!mod?.validateSkillName) return 'validateSkillName not exported'
      const r = mod.validateSkillName('web_search')
      if (r !== null) return `expected null (valid), got rejection: "${r}"`
    }
  ))

  // ── J-10: accepts "python_execution" (valid 2-word) ────────────────────
  results.push(await runTest('J-10', 'J',
    'accepts "python_execution" (valid 2-word)', () => {
      if (!mod?.validateSkillName) return 'validateSkillName not exported'
      const r = mod.validateSkillName('python_execution')
      if (r !== null) return `expected null (valid), got rejection: "${r}"`
    }
  ))

  // ── J-11: accepts "create_txt_file" (valid 3-word noun phrase) ─────────
  results.push(await runTest('J-11', 'J',
    'accepts "create_txt_file" (valid 3-word noun phrase)', () => {
      if (!mod?.validateSkillName) return 'validateSkillName not exported'
      const r = mod.validateSkillName('create_txt_file')
      if (r !== null) return `expected null (valid), got rejection: "${r}"`
    }
  ))

  // ── J-12: rejects task field shorter than 30 chars ─────────────────────
  results.push(await runTest('J-12', 'J',
    'rejects task shorter than 30 chars', () => {
      if (!mod?.validateSkillTask) return 'validateSkillTask not exported'
      const r = mod.validateSkillTask('short')
      if (r === null) return 'expected rejection, got null'
      if (!r.includes('short')) return `expected "too short" reason, got: "${r}"`
    }
  ))

  // ── J-13: rejects task ending with ? ────────────────────────────────────
  results.push(await runTest('J-13', 'J',
    'rejects task ending with "?"', () => {
      if (!mod?.validateSkillTask) return 'validateSkillTask not exported'
      const r = mod.validateSkillTask('what is the weather today right now?')
      if (r === null) return 'expected rejection, got null'
      if (!r.includes('question')) return `expected "question" reason, got: "${r}"`
    }
  ))

  // ── J-14: rejects task verbatim copy of user message ───────────────────
  results.push(await runTest('J-14', 'J',
    'rejects task that is verbatim user message', () => {
      if (!mod?.validateSkillTask) return 'validateSkillTask not exported'
      const r = mod.validateSkillTask('remember my favorite color is purple please', 'remember my favorite color is purple please')
      if (r === null) return 'expected rejection, got null'
      if (!r.includes('verbatim')) return `expected "verbatim" reason, got: "${r}"`
    }
  ))

  // ── J-15: accepts valid long task description ──────────────────────────
  results.push(await runTest('J-15', 'J',
    'accepts valid task description (>30 chars, not a question)', () => {
      if (!mod?.validateSkillTask) return 'validateSkillTask not exported'
      const r = mod.validateSkillTask(
        'Take a clear PNG screenshot of the current desktop and save to specified path'
      )
      if (r !== null) return `expected null (valid), got rejection: "${r}"`
    }
  ))

  // ── J-16: workspace/skills/learned/ lint — no pollution patterns ───────
  results.push(await runTest('J-16', 'J',
    'workspace/skills/learned/ has only valid skills (no pollution)', () => {
      if (!mod?.validateSkillName) return 'validateSkillName not exported'
      const learnedDir = path.join(CWD, 'workspace', 'skills', 'learned')
      if (!fs.existsSync(learnedDir)) return 'learned/ directory does not exist'

      const entries = fs.readdirSync(learnedDir).filter(d => {
        try { return fs.statSync(path.join(learnedDir, d)).isDirectory() } catch { return false }
      })

      if (entries.length !== 7)
        return `expected 7 learned skills, found ${entries.length}: ${entries.join(', ')}`

      const polluted = entries.filter(name => mod.validateSkillName!(name) !== null)
      if (polluted.length > 0)
        return `found ${polluted.length} polluted skill(s): ${polluted.join(', ')}`
    }
  ))

  results.forEach(printResult)
  return summarize('J', 'C12 skill pollution prevention', results)
}
