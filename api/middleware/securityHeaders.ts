// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// api/middleware/securityHeaders.ts — HTTP security response headers

import { Request, Response, NextFunction } from 'express'

export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff')

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY')

  // Enable XSS filter in legacy browsers
  res.setHeader('X-XSS-Protection', '1; mode=block')

  // Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Restrict browser features
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()')

  // Content Security Policy — API only serves JSON so restrictive is fine
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'"
  )

  // Remove headers that reveal stack details
  res.removeHeader('X-Powered-By')
  res.removeHeader('Server')

  next()
}
