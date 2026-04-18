// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// api/entry.ts — Thin esbuild entry-point for the packaged API bundle.
//
// Produces dist-bundle/index.js via:
//   npm run build:api
//
// This file exists so the Electron --cli branch can spawn the API server
// as an isolated child process (ELECTRON_RUN_AS_NODE=1). It must NOT
// contain any CLI banner printing, process.exit() calls, or scheduler
// bootstrapping — only start the HTTP server and keep the process alive.

import 'dotenv/config'
import { startApiServer } from './server'

startApiServer()
