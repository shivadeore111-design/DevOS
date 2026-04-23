// ── cli/commandPalette.ts ─────────────────────────────────────────────────────
// Interactive arrow-key command palette powered by @inquirer/prompts.
// showPalette() is called by aiden.ts when the user presses '/' on an empty
// line or Tab on a partial slash-command. It suspends readline, shows a
// searchable list of all commands, and returns the chosen command string (or
// null if the user pressed Esc / Ctrl+C).
// ─────────────────────────────────────────────────────────────────────────────

import type { PaletteCommand } from './commandCatalog'

/**
 * Show the interactive command palette.
 *
 * @param filter   Pre-seed the search box (e.g. "" for full list, "/sk" to
 *                 pre-filter to commands matching "sk").
 * @param commands Full catalog from getCatalog().
 * @returns        The selected command string (e.g. "/skills") or null on
 *                 Esc / Ctrl+C / non-TTY.
 */
export async function showPalette(
  filter:   string,
  commands: PaletteCommand[],
): Promise<string | null> {
  // Non-TTY fallback: never render interactive UI on pipes / CI
  if (!process.stdout.isTTY || !process.stdin.isTTY) return null

  // Lazy-load @inquirer/prompts so start-up cost is zero when palette unused
  let searchFn: typeof import('@inquirer/prompts').search
  try {
    const mod = await import('@inquirer/prompts')
    searchFn  = mod.search
  } catch {
    // Package not available (shouldn't happen — it's a dependency)
    return null
  }

  // Strip leading '/' from the filter so the search box shows the bare word
  const seedInput = filter.replace(/^\/+/, '')

  try {
    const result = await searchFn<string>({
      message  : 'Command',
      pageSize : 14,
      source   : async (input?: string) => {
        const q = ((input !== undefined && input !== null ? input : seedInput) || '')
          .toLowerCase()
          .replace(/^\/+/, '')
          .trim()

        const hits = commands.filter(c => {
          if (!q) return true
          const name = c.command.toLowerCase().replace(/^\//, '')
          const desc = c.description.toLowerCase()
          // Prefix match wins, then substring, then fuzzy
          return name.startsWith(q) || name.includes(q) || desc.includes(q)
        })

        // Sort: prefix matches first, then alphabetical
        hits.sort((a, b) => {
          const an = a.command.replace(/^\//, '').toLowerCase()
          const bn = b.command.replace(/^\//, '').toLowerCase()
          const aP = an.startsWith(q) ? 0 : 1
          const bP = bn.startsWith(q) ? 0 : 1
          if (aP !== bP) return aP - bP
          return an.localeCompare(bn)
        })

        return hits.map(c => {
          // Pad the command name for a clean two-column layout
          const label = `${c.command.padEnd(18)} ${c.description}`
          return {
            name       : label,
            value      : c.command,
            description: c.usage,
          }
        })
      },
    })

    return typeof result === 'string' ? result : null
  } catch (err: any) {
    // @inquirer throws ExitPromptError on Ctrl+C / Esc
    const msg = err?.message || ''
    if (
      err?.name === 'ExitPromptError' ||
      msg.includes('User force closed') ||
      msg.includes('process exited')
    ) {
      return null
    }
    // Any other error: silently swallow and let the caller fall back
    return null
  }
}
