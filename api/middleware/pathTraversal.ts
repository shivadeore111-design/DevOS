// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// api/middleware/pathTraversal.ts — Path traversal and sensitive path protection

import { Request, Response, NextFunction } from 'express'

const DANGEROUS_PATTERNS: RegExp[] = [
  /\.\.\//g,          // ../
  /\.\.\\/g,          // ..\
  /%2e%2e/gi,         // URL encoded ..
  /%252e/gi,          // double-encoded .
  /\.\.%2f/gi,        // mixed encoding ../
  /\.\.%5c/gi,        // mixed encoding ..\
  /%c0%ae/gi,         // overlong UTF-8 encoding of .
  /%c1%9c/gi,         // overlong UTF-8 encoding of backslash
]

const BLOCKED_PATHS: string[] = [
  '/etc/passwd',
  '/etc/shadow',
  '/etc/hosts',
  '/etc/sudoers',
  'C:\\Windows\\System32',
  'C:/Windows/System32',
  '.env',
  '.git/config',
  'id_rsa',
  'id_ed25519',
  '~/.ssh',
  '/proc/self',
  '/proc/version',
]

export function pathTraversalProtection(req: Request, res: Response, next: NextFunction): void {
  // Combine body and query into a single string to scan
  const bodyStr  = JSON.stringify(req.body  ?? {})
  const queryStr = JSON.stringify(req.query ?? {})
  const combined = bodyStr + queryStr

  // Reset regex lastIndex before each test (stateful regex with /g flag)
  for (const pattern of DANGEROUS_PATTERNS) {
    pattern.lastIndex = 0
    if (pattern.test(combined)) {
      res.status(400).json({ error: 'Path traversal attempt detected' })
      return
    }
  }

  const combinedLower = combined.toLowerCase()
  for (const blocked of BLOCKED_PATHS) {
    if (combinedLower.includes(blocked.toLowerCase())) {
      res.status(400).json({ error: 'Access to sensitive path blocked' })
      return
    }
  }

  next()
}
