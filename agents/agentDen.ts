// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// agents/agentDen.ts — Private agent workspaces under workspace/agents/

import * as fs   from 'fs'
import * as path from 'path'
import { AgentRole } from './types'

// ── Constants ──────────────────────────────────────────────────

const AGENTS_ROOT = path.join(process.cwd(), 'workspace', 'agents')

/** Directories common to every agent */
const BASE_DIRS = ['memory', 'logs', 'scratch']

/** Role-specific extra directories */
const ROLE_DIRS: Partial<Record<AgentRole, string[]>> = {
  'software-engineer':    ['code', 'patches'],
  'frontend-developer':   ['code', 'patches'],
  'backend-developer':    ['code', 'patches'],
  'mobile-developer':     ['code', 'patches'],
  'blockchain-developer': ['code', 'patches'],
  'researcher':           ['findings', 'sources'],
  'qa-engineer':          ['tests', 'reports'],
  'devops-engineer':      ['scripts', 'configs'],
  'security-engineer':    ['audits', 'reports'],
  'data-scientist':       ['notebooks', 'datasets'],
  'ml-engineer':          ['models', 'experiments'],
  'ux-designer':          ['mockups', 'specs'],
  'technical-writer':     ['docs', 'drafts'],
  'ceo':                  ['missions', 'decisions'],
  'cto':                  ['architecture', 'reviews'],
}

// ── Class ──────────────────────────────────────────────────────

class AgentDen {

  // ── Internal helpers ──────────────────────────────────────

  /** Ensure the full directory tree exists for a role and return root path. */
  private ensureDirs(role: AgentRole): string {
    const agentRoot = path.join(AGENTS_ROOT, role)
    const allDirs   = [...BASE_DIRS, ...(ROLE_DIRS[role] ?? [])]
    for (const d of allDirs) {
      fs.mkdirSync(path.join(agentRoot, d), { recursive: true })
    }
    return agentRoot
  }

  private ensureDir(p: string): string {
    fs.mkdirSync(p, { recursive: true })
    return p
  }

  // ── Path helpers ──────────────────────────────────────────

  /** Returns (and creates) the agent's root directory. */
  getPath(role: AgentRole): string {
    return this.ensureDirs(role)
  }

  /** Returns the scratch directory for a role. */
  getScratch(role: AgentRole): string {
    return this.ensureDir(path.join(AGENTS_ROOT, role, 'scratch'))
  }

  /** Returns the memory directory for a role. */
  getMemory(role: AgentRole): string {
    return this.ensureDir(path.join(AGENTS_ROOT, role, 'memory'))
  }

  /** Returns the logs directory for a role. */
  getLogsDir(role: AgentRole): string {
    return this.ensureDir(path.join(AGENTS_ROOT, role, 'logs'))
  }

  /**
   * Returns the code staging directory for an Engineer-family role.
   * Code is staged here; only copied to the project after QA passes.
   */
  getCodeDir(role: AgentRole): string {
    return this.ensureDir(path.join(AGENTS_ROOT, role, 'code'))
  }

  /** Returns the Research agent's findings directory. */
  getFindingsDir(): string {
    return this.ensureDir(path.join(AGENTS_ROOT, 'researcher', 'findings'))
  }

  /**
   * Returns a per-mission subdirectory under the CEO's workspace.
   * Used for missionlog.md and decision records.
   */
  getCEOMissionDir(missionId: string): string {
    return this.ensureDir(path.join(AGENTS_ROOT, 'ceo', 'missions', missionId))
  }

  // ── Log writing ───────────────────────────────────────────

  /**
   * Appends a timestamped entry to the agent's daily log file.
   * File: workspace/agents/<role>/logs/YYYY-MM-DD.log
   */
  writeLog(role: AgentRole, entry: string): void {
    const logsDir = this.getLogsDir(role)
    const date    = new Date().toISOString().slice(0, 10)   // YYYY-MM-DD
    const logFile = path.join(logsDir, `${date}.log`)
    const line    = `[${new Date().toISOString()}] ${entry}\n`
    try {
      fs.appendFileSync(logFile, line, 'utf-8')
    } catch { /* non-fatal */ }
  }

  // ── Memory read/write ─────────────────────────────────────

  /** Returns the agent's persistent memory text (empty string if not set). */
  readMemory(role: AgentRole): string {
    const memFile = path.join(this.getMemory(role), 'memory.md')
    if (!fs.existsSync(memFile)) return ''
    try {
      return fs.readFileSync(memFile, 'utf-8')
    } catch {
      return ''
    }
  }

  /** Overwrites the agent's memory file with new content. */
  writeMemory(role: AgentRole, content: string): void {
    const memFile = path.join(this.getMemory(role), 'memory.md')
    fs.mkdirSync(path.dirname(memFile), { recursive: true })
    fs.writeFileSync(memFile, content, 'utf-8')
  }

  // ── Scratch management ────────────────────────────────────

  /**
   * Deletes all files in the agent's scratch directory.
   * Subdirectories are preserved.
   */
  clearScratch(role: AgentRole): void {
    const scratchDir = this.getScratch(role)
    if (!fs.existsSync(scratchDir)) return
    try {
      for (const f of fs.readdirSync(scratchDir)) {
        const full = path.join(scratchDir, f)
        if (fs.statSync(full).isFile()) fs.unlinkSync(full)
      }
      console.log(`[AgentDen] 🧹 Cleared scratch for ${role}`)
    } catch { /* non-fatal */ }
  }

  // ── Staging helpers ───────────────────────────────────────

  /**
   * Write a file to the Engineer's code staging area.
   * Returns the full path of the staged file.
   */
  stageCode(role: AgentRole, filename: string, content: string): string {
    const codeDir  = this.getCodeDir(role)
    const filePath = path.join(codeDir, filename)
    fs.writeFileSync(filePath, content, 'utf-8')
    console.log(`[AgentDen] 📦 Staged: ${filename} for ${role}`)
    return filePath
  }

  /**
   * Write a finding to the Research agent's findings directory.
   * Filename is auto-generated from a timestamp + slugged title.
   */
  writeFinding(title: string, content: string): string {
    const findingsDir = this.getFindingsDir()
    const slug        = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
    const ts          = new Date().toISOString().replace(/[:.]/g, '-')
    const filePath    = path.join(findingsDir, `${ts}-${slug}.md`)
    fs.writeFileSync(filePath, `# ${title}\n\n${content}`, 'utf-8')
    console.log(`[AgentDen] 🔬 Finding saved: ${path.basename(filePath)}`)
    return filePath
  }
}

export const agentDen = new AgentDen()
