// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/httpKeepalive.ts — Phase 7 of Prompt 10.
//
// Sets a global undici Agent with TCP keepalive enabled.
// All providers use Node.js global fetch(), which is backed by undici in
// Node 18+.  A single call to setupHttpKeepalive() at server startup
// eliminates the cold-connect TCP handshake on every LLM request.
//
// Keepalive settings:
//   keepAliveTimeout       60 s  — hold idle connections this long
//   keepAliveMaxTimeout   300 s  — server-driven max (Groq allows ~5 min)
//   connections            50   — max concurrent sockets per origin
//   pipelining              1   — one request per connection (safe for HTTP/1.1)
//
// Call once at startup:
//   import { setupHttpKeepalive } from '../core/httpKeepalive'
//   setupHttpKeepalive()

import { Agent, setGlobalDispatcher } from 'undici'

let installed = false

/**
 * Install a keepalive-enabled undici Agent as the global fetch dispatcher.
 * Idempotent — safe to call multiple times.
 */
export function setupHttpKeepalive(): void {
  if (installed) return

  const agent = new Agent({
    connect: {
      keepAlive:             true,
      keepAliveInitialDelay: 0,
    },
    keepAliveTimeout:    60_000,   // 60 s idle before closing
    keepAliveMaxTimeout: 300_000,  // 5 min hard cap
    connections:         50,       // sockets per origin
    pipelining:          1,        // no pipelining — safer with AI APIs
  })

  setGlobalDispatcher(agent)
  installed = true
  console.log('[HttpKeepalive] Global undici Agent installed — TCP keepalive active')
}
