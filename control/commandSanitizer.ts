// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// control/commandSanitizer.ts — Block or flag dangerous shell commands

export interface SanitizeResult {
  safe:      boolean
  reason?:   string
  sanitized: string
  warnings:  string[]
}

// ── Blocked patterns (hard deny) ───────────────────────────

const BLOCKED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /rm\s+-[rfRF]{1,3}\s+[/\\]/i,        reason: "Recursive root delete: rm -rf /" },
  { pattern: /rm\s+-[rfRF]{1,3}/i,                 reason: "Dangerous recursive delete: rm -rf" },
  { pattern: /rmdir\s+\/s/i,                        reason: "Recursive directory delete: rmdir /s" },
  { pattern: /\bformat\s+[a-z]:/i,                  reason: "Disk format command" },
  { pattern: /\bshutdown\b/i,                       reason: "System shutdown command" },
  { pattern: /del\s+\/[fF]\s+\/[sS]/i,             reason: "Forced recursive delete: del /f /s" },
  { pattern: /rd\s+\/[sS]/i,                        reason: "Recursive dir delete: rd /s" },
  { pattern: /DROP\s+(TABLE|DATABASE)/i,            reason: "Destructive SQL: DROP TABLE/DATABASE" },
  { pattern: /[Cc]:\\[Ww]indows\b/,                reason: "Write to C:\\Windows system directory" },
  { pattern: /[Cc]:\\[Ss]ystem32\b/,               reason: "Write to C:\\System32 system directory" },
]

// ── Medium-risk patterns (flag but allow) ──────────────────

interface MediumRiskPattern {
  pattern:    RegExp
  warning:    string
  transform?: (cmd: string) => string
}

const MEDIUM_RISK_PATTERNS: MediumRiskPattern[] = [
  {
    pattern: /npm\s+install\s+-g\b/i,
    warning: "Global npm install detected — package will be installed system-wide",
  },
  {
    pattern: /\bsudo\b/,
    warning: "sudo stripped — running without elevated privileges",
    transform: (cmd: string) => cmd.replace(/\bsudo\s+/g, ""),
  },
]

// ── CommandSanitizer ───────────────────────────────────────

export class CommandSanitizer {

  sanitize(command: string): SanitizeResult {
    const warnings: string[] = []
    let sanitized = command

    // ── Hard deny check ──────────────────────────────────
    for (const { pattern, reason } of BLOCKED_PATTERNS) {
      if (pattern.test(command)) {
        return {
          safe:      false,
          reason,
          sanitized: command,
          warnings,
        }
      }
    }

    // ── Medium-risk transforms ───────────────────────────
    for (const { pattern, warning, transform } of MEDIUM_RISK_PATTERNS) {
      if (pattern.test(sanitized)) {
        warnings.push(warning)
        if (transform) {
          sanitized = transform(sanitized)
        }
      }
    }

    return { safe: true, sanitized, warnings }
  }
}

export const commandSanitizer = new CommandSanitizer()
