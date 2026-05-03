// skills/explainshell/index.ts
// Programmatic handler — fetch and parse shell command explanations from explainshell.com.

import { ApiSkill } from '../../core/apiSkillBase'

const skill = new ApiSkill({
  name:      'explainshell',
  baseUrl:   'https://explainshell.com',
  authType:  'none',
  rateLimit: { requests: 5, windowMs: 1_000 },
  timeout:   15_000,
  retries:   2,
})

// ── HTML parsing helpers ──────────────────────────────────────

/** Strip HTML tags from a string. */
function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g,  '<')
    .replace(/&gt;/g,  '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extract explanation fragments from explainshell HTML.
 *
 * The page contains elements like:
 *   <span class="helptext">explanation text...</span>
 *   <div class="help-box">...</div>
 * as well as argument tokens in <span class="arg">...</span>.
 *
 * We extract helptext spans and pair them with their nearest
 * argument token for a readable breakdown.
 */
function parseExplainshellHtml(html: string): string[] {
  const results: string[] = []

  // Match each helptext block — may span multiple lines
  const helptextRe = /<span[^>]*class="helptext"[^>]*>([\s\S]*?)<\/span>/gi
  let match: RegExpExecArray | null

  while ((match = helptextRe.exec(html)) !== null) {
    const text = stripTags(match[1])
    if (text.length > 2) results.push(text)
  }

  // If helptext approach yields nothing, try extracting from help-box divs
  if (results.length === 0) {
    const boxRe = /<div[^>]*class="[^"]*help-box[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
    while ((match = boxRe.exec(html)) !== null) {
      const text = stripTags(match[1])
      if (text.length > 5) results.push(text)
    }
  }

  // Deduplicate while preserving order
  const seen = new Set<string>()
  return results.filter(r => {
    const k = r.slice(0, 80)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** Check if the HTML indicates the command was not found. */
function isNotFound(html: string): boolean {
  return /no match for/i.test(html) || /couldn.t parse/i.test(html)
}

// ── Public API ────────────────────────────────────────────────

export interface ExplainResult {
  command:   string
  url:       string
  breakdown: string[]   // plain-text explanations, one per flag/segment
  parsed:    boolean    // false if HTML parsing yielded nothing (URL still valid)
}

/**
 * Fetch a plain-English breakdown of a shell command.
 *
 * @param command  The shell command to explain (e.g. "tar -xzf file.tar.gz")
 * @returns        ExplainResult with URL and parsed breakdown array
 */
export async function explain(command: string): Promise<ExplainResult> {
  const cmd     = command.trim()
  const encoded = encodeURIComponent(cmd)
  const url     = `https://explainshell.com/explain?cmd=${encoded}`

  let breakdown: string[] = []
  let parsed               = false

  try {
    const html = await skill.get('/explain', { cmd })

    if (typeof html === 'string') {
      if (isNotFound(html)) {
        breakdown = [`explainshell did not recognise "${cmd}" — try visiting the URL directly.`]
      } else {
        breakdown = parseExplainshellHtml(html)
        parsed    = breakdown.length > 0
        if (!parsed) {
          breakdown = ['Explanation available at the URL below — could not parse the response automatically.']
        }
      }
    }
  } catch {
    breakdown = ['Could not reach explainshell.com — visit the URL manually.']
  }

  return { command: cmd, url, breakdown, parsed }
}

/** Format an ExplainResult as a readable string. */
export function formatExplanation(result: ExplainResult): string {
  const lines = [`Command: ${result.command}`, '']

  if (result.breakdown.length > 0) {
    result.breakdown.forEach(b => lines.push(`  • ${b}`))
  }

  lines.push('', `Full explanation: ${result.url}`)
  return lines.join('\n')
}
