// ============================================================
// C13 Cross-Platform App Launching Regression Tests
// scripts/test-suite/regression/c13-app-launching.ts
//
// Proves C13 fix: resolveLaunchCommand() returns correct
// platform-specific commands for known apps (URI schemes for
// UWP on Windows, 'open -a' for macOS, bare commands for Linux)
// and graceful fallbacks for unknown apps.
//
// Zero I/O — pure function testing.
// ============================================================

import path from 'path'
import { runTest, summarize, printResult, C, GroupSummary } from '../utils'

const CWD = process.cwd()

function req<T = any>(relPath: string): T | null {
  try { return require(path.join(CWD, relPath)) as T } catch { return null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Group K — Regression: C13 cross-platform app launching
// ─────────────────────────────────────────────────────────────────────────────

export async function groupK(): Promise<GroupSummary> {
  console.log(`\n${C.bold}[K] Regression — C13 cross-platform app launching${C.reset}`)
  const results = []

  const mod = req<{
    APP_ALIASES?: Record<string, any>
    resolveLaunchCommand?: (appName: string, platform?: string) => string
  }>('core/toolRegistry')

  // ── K-01: APP_ALIASES exported ────────────────────────────────────────────
  results.push(await runTest('K-01', 'K',
    'APP_ALIASES exported from core/toolRegistry', () => {
      if (!mod?.APP_ALIASES) return 'APP_ALIASES not exported'
      if (typeof mod.APP_ALIASES !== 'object') return 'APP_ALIASES is not an object'
      if (!mod.APP_ALIASES['spotify']) return 'APP_ALIASES missing "spotify" entry'
    }
  ))

  // ── K-02: resolveLaunchCommand exported ───────────────────────────────────
  results.push(await runTest('K-02', 'K',
    'resolveLaunchCommand exported from core/toolRegistry', () => {
      if (!mod?.resolveLaunchCommand) return 'resolveLaunchCommand not exported'
      if (typeof mod.resolveLaunchCommand !== 'function') return 'resolveLaunchCommand is not a function'
    }
  ))

  // ── K-03: spotify on win32 uses URI scheme ────────────────────────────────
  results.push(await runTest('K-03', 'K',
    "resolveLaunchCommand('spotify', 'win32') uses URI scheme 'spotify:'", () => {
      if (!mod?.resolveLaunchCommand) return 'resolveLaunchCommand not exported'
      const cmd = mod.resolveLaunchCommand('spotify', 'win32')
      if (!cmd.includes('spotify:')) return `expected 'spotify:' in command, got: "${cmd}"`
    }
  ))

  // ── K-04: spotify on darwin uses open -a "Spotify" ────────────────────────
  results.push(await runTest('K-04', 'K',
    "resolveLaunchCommand('spotify', 'darwin') uses open -a \"Spotify\"", () => {
      if (!mod?.resolveLaunchCommand) return 'resolveLaunchCommand not exported'
      const cmd = mod.resolveLaunchCommand('spotify', 'darwin')
      if (cmd !== 'open -a "Spotify"') return `expected 'open -a "Spotify"', got: "${cmd}"`
    }
  ))

  // ── K-05: spotify on linux uses bare command ──────────────────────────────
  results.push(await runTest('K-05', 'K',
    "resolveLaunchCommand('spotify', 'linux') equals 'spotify'", () => {
      if (!mod?.resolveLaunchCommand) return 'resolveLaunchCommand not exported'
      const cmd = mod.resolveLaunchCommand('spotify', 'linux')
      if (cmd !== 'spotify') return `expected 'spotify', got: "${cmd}"`
    }
  ))

  // ── K-06: chrome on win32 ─────────────────────────────────────────────────
  results.push(await runTest('K-06', 'K',
    "resolveLaunchCommand('chrome', 'win32') contains 'chrome'", () => {
      if (!mod?.resolveLaunchCommand) return 'resolveLaunchCommand not exported'
      const cmd = mod.resolveLaunchCommand('chrome', 'win32')
      if (!cmd.includes('chrome')) return `expected 'chrome' in command, got: "${cmd}"`
    }
  ))

  // ── K-07: chrome on darwin ────────────────────────────────────────────────
  results.push(await runTest('K-07', 'K',
    "resolveLaunchCommand('chrome', 'darwin') contains 'Google Chrome'", () => {
      if (!mod?.resolveLaunchCommand) return 'resolveLaunchCommand not exported'
      const cmd = mod.resolveLaunchCommand('chrome', 'darwin')
      if (!cmd.includes('Google Chrome')) return `expected 'Google Chrome' in command, got: "${cmd}"`
    }
  ))

  // ── K-08: chrome on linux ─────────────────────────────────────────────────
  results.push(await runTest('K-08', 'K',
    "resolveLaunchCommand('chrome', 'linux') contains 'google-chrome'", () => {
      if (!mod?.resolveLaunchCommand) return 'resolveLaunchCommand not exported'
      const cmd = mod.resolveLaunchCommand('chrome', 'linux')
      if (!cmd.includes('google-chrome')) return `expected 'google-chrome' in command, got: "${cmd}"`
    }
  ))

  // ── K-09: discord on win32 uses URI scheme ────────────────────────────────
  results.push(await runTest('K-09', 'K',
    "resolveLaunchCommand('discord', 'win32') uses URI scheme 'discord:'", () => {
      if (!mod?.resolveLaunchCommand) return 'resolveLaunchCommand not exported'
      const cmd = mod.resolveLaunchCommand('discord', 'win32')
      if (!cmd.includes('discord:')) return `expected 'discord:' in command, got: "${cmd}"`
    }
  ))

  // ── K-10: teams on win32 uses URI scheme ──────────────────────────────────
  results.push(await runTest('K-10', 'K',
    "resolveLaunchCommand('teams', 'win32') uses URI scheme 'msteams:'", () => {
      if (!mod?.resolveLaunchCommand) return 'resolveLaunchCommand not exported'
      const cmd = mod.resolveLaunchCommand('teams', 'win32')
      if (!cmd.includes('msteams:')) return `expected 'msteams:' in command, got: "${cmd}"`
    }
  ))

  // ── K-11: notepad on win32 ────────────────────────────────────────────────
  results.push(await runTest('K-11', 'K',
    "resolveLaunchCommand('notepad', 'win32') equals 'cmd /c start \"\" \"notepad.exe\"'", () => {
      if (!mod?.resolveLaunchCommand) return 'resolveLaunchCommand not exported'
      const cmd = mod.resolveLaunchCommand('notepad', 'win32')
      if (cmd !== 'cmd /c start "" "notepad.exe"') return `expected 'cmd /c start "" "notepad.exe"', got: "${cmd}"`
    }
  ))

  // ── K-12: notepad on darwin falls back to TextEdit ────────────────────────
  results.push(await runTest('K-12', 'K',
    "resolveLaunchCommand('notepad', 'darwin') resolves to TextEdit", () => {
      if (!mod?.resolveLaunchCommand) return 'resolveLaunchCommand not exported'
      const cmd = mod.resolveLaunchCommand('notepad', 'darwin')
      if (!cmd.includes('TextEdit')) return `expected 'TextEdit' in command, got: "${cmd}"`
    }
  ))

  // ── K-13: 'google chrome' display alias → chrome on win32 ────────────────
  results.push(await runTest('K-13', 'K',
    "resolveLaunchCommand('google chrome', 'win32') resolves via display alias", () => {
      if (!mod?.resolveLaunchCommand) return 'resolveLaunchCommand not exported'
      const cmd = mod.resolveLaunchCommand('google chrome', 'win32')
      if (!cmd.includes('chrome')) return `expected 'chrome' in command, got: "${cmd}"`
    }
  ))

  // ── K-14: 'vs code' display alias → vscode on darwin ─────────────────────
  results.push(await runTest('K-14', 'K',
    "resolveLaunchCommand('vs code', 'darwin') resolves to Visual Studio Code", () => {
      if (!mod?.resolveLaunchCommand) return 'resolveLaunchCommand not exported'
      const cmd = mod.resolveLaunchCommand('vs code', 'darwin')
      if (!cmd.includes('Visual Studio Code')) return `expected 'Visual Studio Code' in command, got: "${cmd}"`
    }
  ))

  // ── K-15: unknown app on win32 → graceful start fallback ──────────────────
  results.push(await runTest('K-15', 'K',
    "resolveLaunchCommand('unknownappxyz', 'win32') produces start command", () => {
      if (!mod?.resolveLaunchCommand) return 'resolveLaunchCommand not exported'
      const cmd = mod.resolveLaunchCommand('unknownappxyz', 'win32')
      if (!cmd.includes('cmd /c start')) return `expected 'cmd /c start' fallback, got: "${cmd}"`
      if (!cmd.includes('unknownappxyz')) return `expected app name in fallback, got: "${cmd}"`
    }
  ))

  // ── K-16: unknown app on darwin → open -a fallback ────────────────────────
  results.push(await runTest('K-16', 'K',
    "resolveLaunchCommand('unknownappxyz', 'darwin') produces open -a", () => {
      if (!mod?.resolveLaunchCommand) return 'resolveLaunchCommand not exported'
      const cmd = mod.resolveLaunchCommand('unknownappxyz', 'darwin')
      if (!cmd.includes('open -a')) return `expected 'open -a' fallback, got: "${cmd}"`
      if (!cmd.includes('unknownappxyz')) return `expected app name in fallback, got: "${cmd}"`
    }
  ))

  // ── K-17: unknown app on linux → xdg-open fallback ────────────────────────
  results.push(await runTest('K-17', 'K',
    "resolveLaunchCommand('unknownappxyz', 'linux') produces xdg-open", () => {
      if (!mod?.resolveLaunchCommand) return 'resolveLaunchCommand not exported'
      const cmd = mod.resolveLaunchCommand('unknownappxyz', 'linux')
      if (!cmd.includes('xdg-open')) return `expected 'xdg-open' fallback, got: "${cmd}"`
      if (!cmd.includes('unknownappxyz')) return `expected app name in fallback, got: "${cmd}"`
    }
  ))

  results.forEach(printResult)
  return summarize('K', 'C13 cross-platform app launching', results)
}
