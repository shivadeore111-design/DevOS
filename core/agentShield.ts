// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/agentShield.ts — Security scanner for skills, configs, and identity.
// Runs on startup and on-demand from Settings → Security.
// Reuses SKILL_INJECTION_PATTERNS from skillLoader so detection
// stays in sync — no duplicate regex lists.

import fs   from 'fs'
import path from 'path'

// Match server.ts: packaged Electron path or cwd
const WORKSPACE_ROOT = process.env.AIDEN_USER_DATA || process.cwd()

// ── Types ──────────────────────────────────────────────────────

export interface SecurityFinding {
  severity:       'critical' | 'high' | 'medium' | 'low' | 'info'
  category:       string
  file:           string
  description:    string
  recommendation: string
}

export interface ScanResult {
  timestamp: number
  duration:  number
  findings:  SecurityFinding[]
  scanned: {
    skills:  number
    tools:   number
    configs: number
  }
  riskScore: number   // 0–100
}

// ── Injection patterns (aligned with skillLoader.ts) ──────────
// Duplicating the exact list would create drift — keep a focused
// subset covering the most critical categories for config / identity
// files (skills are already blocked at load time by skillLoader).

const INJECTION_PATTERNS: Array<{ pattern: RegExp; desc: string }> = [
  { pattern: /ignore\s+(all\s+)?(previous|above|prior)/i,  desc: 'Prompt injection: ignore previous instructions' },
  { pattern: /you\s+are\s+now\s+/i,                        desc: 'Role hijack: "you are now"' },
  { pattern: /\[SYSTEM\]/i,                                 desc: 'System tag injection' },
  { pattern: /\[INST\]/i,                                   desc: 'Instruction tag injection' },
  { pattern: /<\|im_start\|>/i,                             desc: 'Model control token injection' },
  { pattern: /eval\s*\(/i,                                  desc: 'Code evaluation' },
  { pattern: /subprocess/i,                                 desc: 'Subprocess execution' },
  { pattern: /import\s+os/i,                                desc: 'OS module import' },
  { pattern: /base64\s*decode/i,                            desc: 'Base64 decode (possible obfuscation)' },
  { pattern: /send\s+(to|via)\s+(http|email|webhook|api)/i, desc: 'Data exfiltration attempt' },
  { pattern: /curl\s+.*-d\s/i,                              desc: 'Outbound data via curl' },
  { pattern: /admin\s*(mode|access|privilege)/i,            desc: 'Privilege escalation attempt' },
]

const ENCODED_PATTERN = /\\x[0-9a-f]{2}/i

// Raw API key patterns — keys that should use "env:" prefix in config
const RAW_KEY_PATTERN = /["'](?:sk-|gsk_|AIza|ghp_|xai-|csk-)[a-zA-Z0-9]{20,}["']/

// ── Scoring weights ────────────────────────────────────────────
const SEVERITY_WEIGHTS: Record<SecurityFinding['severity'], number> = {
  critical: 25,
  high:     15,
  medium:    5,
  low:       2,
  info:      0,
}

// ── Main scanner ───────────────────────────────────────────────

export async function runSecurityScan(): Promise<ScanResult> {
  const start    = Date.now()
  const findings: SecurityFinding[] = []
  let skillsScanned  = 0
  let toolsScanned   = 0
  let configsScanned = 0

  // ── 1. Scan skill files ──────────────────────────────────────
  // Skills are already sanitized at load time by skillLoader, but
  // we re-scan here to surface findings in the UI and catch any
  // skills that bypass the loader (e.g. placed directly on disk).

  const skillDirs = [
    path.join(WORKSPACE_ROOT, 'skills'),
    path.join(WORKSPACE_ROOT, 'workspace', 'skills'),
    path.join(WORKSPACE_ROOT, 'workspace', 'skills', 'learned'),
    path.join(WORKSPACE_ROOT, 'workspace', 'skills', 'approved'),
  ]

  for (const dir of skillDirs) {
    if (!fs.existsSync(dir)) continue

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch { continue }

    for (const entry of entries) {
      // Skills are stored as subdirectories containing SKILL.md
      const skillPath = entry.isDirectory()
        ? path.join(dir, entry.name, 'SKILL.md')
        : entry.name.endsWith('.md') ? path.join(dir, entry.name) : ''
      if (!skillPath || !fs.existsSync(skillPath)) continue

      const relPath = `skills/${entry.name}${entry.isDirectory() ? '/SKILL.md' : ''}`
      let content: string
      try { content = fs.readFileSync(skillPath, 'utf8') } catch { continue }
      skillsScanned++

      // Injection pattern checks
      for (const check of INJECTION_PATTERNS) {
        if (check.pattern.test(content)) {
          findings.push({
            severity:       'high',
            category:       'skill-injection',
            file:           relPath,
            description:    check.desc,
            recommendation: 'Review and remove or quarantine this skill',
          })
        }
      }

      // Encoded characters — obfuscation indicator
      if (ENCODED_PATTERN.test(content)) {
        findings.push({
          severity:       'high',
          category:       'encoding',
          file:           relPath,
          description:    'Contains hex-encoded characters — possible obfuscation',
          recommendation: 'Decode and review the actual content',
        })
      }

      // Unusually large skill (>10 KB — same threshold as skillLoader)
      if (content.length > 10240) {
        findings.push({
          severity:       'medium',
          category:       'skill-size',
          file:           relPath,
          description:    `Skill is ${(content.length / 1024).toFixed(1)}KB — unusually large`,
          recommendation: 'Review content — large skills may contain hidden payloads',
        })
      }
    }
  }

  // ── 2. Scan config for exposed secrets ───────────────────────
  configsScanned++
  const configPath = path.join(WORKSPACE_ROOT, 'config', 'devos.config.json')
  if (fs.existsSync(configPath)) {
    let config = ''
    try { config = fs.readFileSync(configPath, 'utf8') } catch {}

    if (config && RAW_KEY_PATTERN.test(config)) {
      findings.push({
        severity:       'critical',
        category:       'exposed-secret',
        file:           'config/devos.config.json',
        description:    'Raw API key found in config file',
        recommendation: 'Use env: format to reference environment variables instead',
      })
    }
  }

  // ── 3. Scan sensitive workspace files for identity injection ──
  const sensitiveFiles: Array<{ name: string; critical: boolean }> = [
    { name: 'SOUL.md',           critical: true  },
    { name: 'USER.md',           critical: false },
    { name: 'STANDING_ORDERS.md',critical: false },
    { name: 'LESSONS.md',        critical: false },
  ]

  for (const { name, critical } of sensitiveFiles) {
    const filePath = path.join(WORKSPACE_ROOT, 'workspace', name)
    if (!fs.existsSync(filePath)) continue

    let content = ''
    try { content = fs.readFileSync(filePath, 'utf8') } catch { continue }
    toolsScanned++

    // Identity injection in SOUL.md is the highest-severity possible
    if (critical && /ignore\s+previous|you\s+are\s+now/i.test(content)) {
      findings.push({
        severity:       'critical',
        category:       'soul-injection',
        file:           `workspace/${name}`,
        description:    'SOUL.md contains injection patterns — identity may be compromised',
        recommendation: 'Reset SOUL.md to default and review all recent changes',
      })
    }

    // General injection patterns in any sensitive file
    for (const check of INJECTION_PATTERNS) {
      if (check.pattern.test(content)) {
        findings.push({
          severity:       critical ? 'critical' : 'high',
          category:       'config-injection',
          file:           `workspace/${name}`,
          description:    `${name}: ${check.desc}`,
          recommendation: `Review workspace/${name} for unauthorized modifications`,
        })
        break   // one finding per file is enough
      }
    }
  }

  // ── 4. Port binding info notices ─────────────────────────────
  // Static check — not a network probe. Just reminds the operator.
  for (const port of [4200, 3000, 3001]) {
    toolsScanned++
    findings.push({
      severity:       'info',
      category:       'network',
      file:           `port ${port}`,
      description:    `Port ${port} should be bound to localhost only`,
      recommendation: 'Ensure all DevOS ports bind to 127.0.0.1, not 0.0.0.0',
    })
  }

  // ── Risk score ────────────────────────────────────────────────
  const riskScore = Math.min(
    100,
    findings.reduce((sum, f) => sum + (SEVERITY_WEIGHTS[f.severity] ?? 0), 0),
  )

  const result: ScanResult = {
    timestamp: Date.now(),
    duration:  Date.now() - start,
    findings,
    scanned:   { skills: skillsScanned, tools: toolsScanned, configs: configsScanned },
    riskScore,
  }

  console.log(
    `[AgentShield] Scan complete: ${findings.length} finding(s), ` +
    `risk score ${riskScore}/100 (${result.duration}ms)`,
  )

  return result
}
