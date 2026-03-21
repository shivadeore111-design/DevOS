// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// api/middleware/requestLimits.ts — Request body size and field length limits

import { Request, Response, NextFunction } from 'express'

const MAX_BODY_SIZE      = 1024 * 1024   // 1 MB total body
const MAX_MESSAGE_LENGTH = 10_000        // 10k chars for chat messages
const MAX_GOAL_LENGTH    = 5_000         // 5k chars for goal descriptions
const MAX_STRING_LENGTH  = 50_000        // 50k chars for any single string field

export function requestLimits(req: Request, res: Response, next: NextFunction): void {
  const body = req.body
  if (!body) { next(); return }

  // Total body size check
  let bodySizeBytes: number
  try {
    bodySizeBytes = Buffer.byteLength(JSON.stringify(body), 'utf-8')
  } catch {
    res.status(400).json({ error: 'Malformed request body' })
    return
  }

  if (bodySizeBytes > MAX_BODY_SIZE) {
    res.status(413).json({ error: `Request body too large (max ${MAX_BODY_SIZE / 1024}KB)` })
    return
  }

  // Field-level length checks
  if (typeof body.message === 'string' && body.message.length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({ error: `Message too long (max ${MAX_MESSAGE_LENGTH} chars)` })
    return
  }

  if (typeof body.description === 'string' && body.description.length > MAX_GOAL_LENGTH) {
    res.status(400).json({ error: `Description too long (max ${MAX_GOAL_LENGTH} chars)` })
    return
  }

  if (typeof body.goal === 'string' && body.goal.length > MAX_GOAL_LENGTH) {
    res.status(400).json({ error: `Goal too long (max ${MAX_GOAL_LENGTH} chars)` })
    return
  }

  // Generic oversize string guard — catches any other top-level string field
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string' && value.length > MAX_STRING_LENGTH) {
      res.status(400).json({ error: `Field '${key}' exceeds maximum length (max ${MAX_STRING_LENGTH} chars)` })
      return
    }
  }

  next()
}
