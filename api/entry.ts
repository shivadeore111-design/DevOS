// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// api/entry.ts — Thin esbuild entry-point for the packaged API bundle.
//
// Produces dist-bundle/index.js via:
//   npm run build:api
//
// Two modes:
//   1. Programmatic (require'd by aiden-os bootstrapper):
//        const { start } = require('aiden-runtime/dist-bundle/index.js')
//        await start({ port, configDir })
//      → esbuild inlines all deps (no ESM/CJS version conflicts)
//
//   2. Direct execution (Electron --cli branch child process):
//        ELECTRON_RUN_AS_NODE=1 node dist-bundle/index.js
//      → auto-starts on AIDEN_PORT (or 4200)

import 'dotenv/config'
import { startApiServer, start } from './server'

export { start, startApiServer }

// Auto-start only when invoked directly (Electron child-process mode).
// When require()'d by the aiden-os bootstrapper, require.main is the
// bootstrapper itself — not this bundle — so this branch is skipped.
if (require.main === module) {
  startApiServer()
}
