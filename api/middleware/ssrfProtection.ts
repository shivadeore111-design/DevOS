// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// api/middleware/ssrfProtection.ts — SSRF (Server-Side Request Forgery) prevention

import { Request, Response, NextFunction } from 'express'
import * as net from 'net'

const BLOCKED_RANGES = [
  /^127\./,                          // localhost
  /^10\./,                           // private class A
  /^172\.(1[6-9]|2\d|3[01])\./,     // private class B
  /^192\.168\./,                     // private class C
  /^169\.254\./,                     // link-local / AWS metadata
  /^0\./,                            // this network
  /^100\.64\./,                      // shared address space (RFC 6598)
  /^::1$/,                           // IPv6 localhost
  /^fc00:/i,                         // IPv6 unique local
  /^fe80:/i,                         // IPv6 link-local
]

const BLOCKED_HOSTS = [
  'localhost',
  'metadata.google.internal',
  '169.254.169.254',       // AWS / GCP instance metadata
  'instance-data',          // EC2 metadata alias
  '100.100.100.200',        // Alibaba Cloud metadata
]

const BLOCKED_SCHEMES = ['file:', 'ftp:', 'gopher:', 'dict:', 'ldap:', 'jar:']

export function isPrivateIP(ip: string): boolean {
  return BLOCKED_RANGES.some(r => r.test(ip))
}

export async function validateUrl(url: string): Promise<{ safe: boolean; reason?: string }> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { safe: false, reason: 'Invalid URL format' }
  }

  // Block dangerous schemes
  if (BLOCKED_SCHEMES.includes(parsed.protocol)) {
    return { safe: false, reason: `Blocked scheme: ${parsed.protocol}` }
  }

  // Block known dangerous hostnames
  const hostname = parsed.hostname.toLowerCase()
  if (BLOCKED_HOSTS.includes(hostname)) {
    return { safe: false, reason: `Blocked host: ${hostname}` }
  }

  // If hostname is a raw IP address, check ranges immediately
  if (net.isIP(hostname)) {
    if (isPrivateIP(hostname)) {
      return { safe: false, reason: `Private/reserved IP blocked: ${hostname}` }
    }
  }

  return { safe: true }
}

export function ssrfProtection(req: Request, res: Response, next: NextFunction): void {
  const url = (req.body?.url ?? req.query?.url) as string | undefined
  if (!url) { next(); return }

  validateUrl(url).then(result => {
    if (!result.safe) {
      res.status(400).json({ error: `SSRF protection: ${result.reason}` })
    } else {
      next()
    }
  }).catch(() => {
    res.status(400).json({ error: 'SSRF protection: URL validation failed' })
  })
}
