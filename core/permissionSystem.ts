// ============================================================
// DevOS — Permission System v1
// Reads workspace/permissions.yaml and exposes checkShell(),
// checkFileWrite(), checkFileRead(), checkBrowserDomain().
//
// Design:
//   verdict 'allow'  — explicitly permitted, skip inner gates
//   verdict 'deny'   — blocked, return error immediately
//   verdict 'ask'    — needs user approval before running
//   verdict 'defer'  — no opinion, let existing hardcoded gate decide
//
// Changes to permissions.yaml take effect immediately (file-watcher).
// ============================================================

import * as fs   from 'fs'
import * as path from 'path'
import yaml      from 'js-yaml'
import minimatch from 'minimatch'

// ── Config shape ──────────────────────────────────────────────

export interface PermissionConfig {
  version:    number
  mode:       'ask' | 'allow' | 'strict'
  shell: {
    deny:   string[]
    allow:  string[]
  }
  filesystem: {
    deny_read:   string[]
    deny_write:  string[]
    allow_write: string[]
  }
  browser: {
    deny_domains:     string[]
    require_approval: boolean
  }
  audit: {
    enabled:   boolean
    log_file:  string
    log_level: 'deny' | 'ask' | 'all'
  }
}

// ── Permission result ─────────────────────────────────────────

export type Verdict = 'allow' | 'deny' | 'ask' | 'defer'

export interface PermResult {
  verdict: Verdict
  reason?: string
}

// ── PermissionSystem ──────────────────────────────────────────

class PermissionSystem {
  private config: PermissionConfig
  private configPath: string
  private watcher?: fs.FSWatcher

  constructor() {
    this.configPath = path.join(process.cwd(), 'workspace', 'permissions.yaml')
    this.config = this.defaults()
    this.load()
    this.startWatcher()
  }

  // ── Defaults ────────────────────────────────────────────────

  private defaults(): PermissionConfig {
    return {
      version: 1,
      mode:    'ask',
      shell: {
        deny:  [],
        allow: [],
      },
      filesystem: {
        deny_read:   [],
        deny_write:  [],
        allow_write: [],
      },
      browser: {
        deny_domains:     [],
        require_approval: false,
      },
      audit: {
        enabled:   true,
        log_file:  'workspace/audit.log',
        log_level: 'deny',
      },
    }
  }

  // ── Loader ──────────────────────────────────────────────────

  load(): void {
    try {
      if (!fs.existsSync(this.configPath)) return
      const raw    = fs.readFileSync(this.configPath, 'utf-8')
      const parsed = yaml.load(raw) as Partial<PermissionConfig>
      const d      = this.defaults()
      this.config = {
        ...d,
        ...parsed,
        shell:      { ...d.shell,      ...(parsed.shell      ?? {}) },
        filesystem: { ...d.filesystem, ...(parsed.filesystem ?? {}) },
        browser:    { ...d.browser,    ...(parsed.browser    ?? {}) },
        audit:      { ...d.audit,      ...(parsed.audit      ?? {}) },
      }
    } catch (e: any) {
      console.warn('[Permissions] Failed to load permissions.yaml:', e.message)
    }
  }

  reload(): void {
    this.load()
    console.log('[Permissions] Reloaded permissions.yaml')
  }

  // ── File watcher ────────────────────────────────────────────

  private startWatcher(): void {
    try {
      if (!fs.existsSync(path.dirname(this.configPath))) return
      // Watch the workspace dir so we catch the file being created too
      const watchDir = path.dirname(this.configPath)
      this.watcher = fs.watch(watchDir, { persistent: false }, (event, filename) => {
        if (filename && filename.includes('permissions')) {
          this.load()
          console.log('[Permissions] Auto-reloaded permissions.yaml')
        }
      })
    } catch { /* workspace may not exist yet */ }
  }

  // ── Glob helper ─────────────────────────────────────────────

  private matches(value: string, patterns: string[]): boolean {
    const normalized = value.replace(/\\/g, '/')
    return patterns.some(p => {
      // Simple startsWith patterns (no glob chars) — substring match for shell cmds
      if (!p.includes('*') && !p.includes('?') && !p.includes('[')) {
        return normalized.toLowerCase().startsWith(p.toLowerCase().replace(/\s*$/, ''))
      }
      return minimatch(normalized, p, { dot: true, matchBase: true, nocase: true })
    })
  }

  // ── Audit ────────────────────────────────────────────────────

  private audit(action: string, verdict: Verdict, reason: string): void {
    if (!this.config.audit.enabled) return
    const level = this.config.audit.log_level
    if (level === 'deny' && verdict !== 'deny') return
    if (level === 'ask'  && verdict === 'allow') return
    try {
      const line    = `${new Date().toISOString()} [${verdict.toUpperCase()}] ${action} — ${reason}\n`
      const logPath = path.isAbsolute(this.config.audit.log_file)
        ? this.config.audit.log_file
        : path.join(process.cwd(), this.config.audit.log_file)
      fs.mkdirSync(path.dirname(logPath), { recursive: true })
      fs.appendFileSync(logPath, line, 'utf-8')
    } catch { /* audit failures are silent */ }
  }

  // ── checkShell ───────────────────────────────────────────────

  checkShell(cmd: string): PermResult {
    const trimmed = cmd.trim()

    // 1. Hard deny from config (highest priority)
    if (this.matches(trimmed, this.config.shell.deny)) {
      this.audit(`shell: ${trimmed.slice(0, 120)}`, 'deny', 'matches shell.deny list')
      return { verdict: 'deny', reason: 'Blocked by permissions.yaml shell deny list.' }
    }

    // 2. Explicit allow from config
    if (this.matches(trimmed, this.config.shell.allow)) {
      this.audit(`shell: ${trimmed.slice(0, 120)}`, 'allow', 'matches shell.allow list')
      return { verdict: 'allow' }
    }

    // 3. Mode-based fallthrough
    switch (this.config.mode) {
      case 'allow':
        return { verdict: 'allow' }
      case 'strict':
        this.audit(`shell: ${trimmed.slice(0, 120)}`, 'deny', 'strict mode, not in allow list')
        return { verdict: 'deny', reason: 'Strict mode: command not in shell.allow list.' }
      case 'ask':
      default:
        // Defer to the existing hardcoded SHELL_ALLOWLIST/DENIED_COMMANDS gate
        return { verdict: 'defer' }
    }
  }

  // ── checkFileWrite ───────────────────────────────────────────

  checkFileWrite(filePath: string): PermResult {
    const norm = filePath.replace(/\\/g, '/')

    if (this.matches(norm, this.config.filesystem.deny_write)) {
      this.audit(`file_write: ${norm}`, 'deny', 'matches filesystem.deny_write')
      return { verdict: 'deny', reason: 'Blocked by permissions.yaml filesystem deny_write.' }
    }

    // allow_write is an explicit permit (relevant in strict mode)
    if (this.matches(norm, this.config.filesystem.allow_write)) {
      return { verdict: 'allow' }
    }

    switch (this.config.mode) {
      case 'allow':
        return { verdict: 'allow' }
      case 'strict':
        this.audit(`file_write: ${norm}`, 'deny', 'strict mode, not in allow_write')
        return { verdict: 'deny', reason: 'Strict mode: path not in filesystem.allow_write.' }
      default:
        // ask/unknown — write is allowed by default; existing isPathDenied() covers secrets
        return { verdict: 'defer' }
    }
  }

  // ── checkFileRead ────────────────────────────────────────────

  checkFileRead(filePath: string): PermResult {
    const norm = filePath.replace(/\\/g, '/')

    if (this.matches(norm, this.config.filesystem.deny_read)) {
      this.audit(`file_read: ${norm}`, 'deny', 'matches filesystem.deny_read')
      return { verdict: 'deny', reason: 'Blocked by permissions.yaml filesystem deny_read.' }
    }

    return { verdict: 'defer' }
  }

  // ── checkBrowserDomain ───────────────────────────────────────

  checkBrowserDomain(url: string): PermResult {
    try {
      const hostname = new URL(url).hostname
      if (this.matches(hostname, this.config.browser.deny_domains)) {
        this.audit(`browser: ${hostname}`, 'deny', 'matches browser.deny_domains')
        return { verdict: 'deny', reason: `Domain blocked by permissions.yaml: ${hostname}` }
      }
      if (this.config.browser.require_approval) {
        return { verdict: 'ask', reason: 'browser.require_approval=true in permissions.yaml' }
      }
    } catch { /* invalid URL — pass through */ }
    return { verdict: 'defer' }
  }

  // ── Accessors ────────────────────────────────────────────────

  getConfig(): PermissionConfig { return structuredClone(this.config) }
  getMode():   string           { return this.config.mode }
  getConfigPath(): string       { return this.configPath }
}

// ── Singleton ─────────────────────────────────────────────────

export const permissionSystem = new PermissionSystem()
