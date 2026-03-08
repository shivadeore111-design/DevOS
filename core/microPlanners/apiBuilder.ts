// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/microPlanners/apiBuilder.ts — Generates an Express REST API plan

import { ParsedGoal } from "../goalParser"
import { osContext }  from "../osContext"

export class ApiBuilderPlanner {

  canHandle(g: ParsedGoal): boolean {
    const hasExpress = g.stack.includes("express") || g.stack.includes("node")
    return (g.type === "build" && (g.domain === "backend" || g.domain === "fullstack")) ||
           (g.type === "build" && hasExpress)
  }

  buildPlan(g: ParsedGoal): any {
    const hasJWT      = g.features.includes("JWT") || g.features.includes("authentication")
    const hasDB       = !!g.database
    const hasPg       = g.database === "postgres"
    const hasMongo    = g.database === "mongodb"
    const isWindows   = osContext.platform === "win32"

    // ── dependencies ──────────────────────────────────────────
    const deps: Record<string, string> = { express: "^4.18.2" }
    if (hasJWT)   deps["jsonwebtoken"]  = "^9.0.2"
    if (hasPg)    deps["pg"]            = "^8.11.3"
    if (hasMongo) deps["mongoose"]      = "^8.2.0"

    const depsJson = JSON.stringify(deps, null, 4)

    // ── package.json ──────────────────────────────────────────
    const packageJson = JSON.stringify({
      name:    "api-server",
      version: "1.0.0",
      main:    "server.js",
      scripts: { start: "node server.js" },
      dependencies: deps,
    }, null, 2)

    // ── server.js ─────────────────────────────────────────────
    const routes = g.features.includes("CRUD")
      ? `
app.get('/api/items',      (_req, res) => res.json({ items: [] }));
app.post('/api/items',     (req, res)  => res.json({ created: req.body }));
app.put('/api/items/:id',  (req, res)  => res.json({ updated: req.params.id }));
app.delete('/api/items/:id',(req, res) => res.json({ deleted: req.params.id }));`
      : `
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/hello',  (_req, res) => res.json({ message: 'Hello from DevOS!' }));`

    const serverJs = `const express = require('express');
const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
${routes}
app.listen(PORT, () => console.log(\`Server running on http://localhost:\${PORT}\`));
`

    // ── auth middleware ────────────────────────────────────────
    const authMiddleware = `const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'devos-secret';

function authenticate(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { authenticate };
`

    // ── db.js ─────────────────────────────────────────────────
    const pgDbJs = `const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/devos'
});
module.exports = pool;
`
    const mongoDbJs = `const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/devos')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));
module.exports = mongoose;
`

    // ── Build actions array ────────────────────────────────────
    const actions: any[] = [
      {
        type:        "file_write",
        description: "Create package.json with Express dependencies",
        path:        "package.json",
        content:     packageJson,
        risk:        "low",
      },
      {
        type:        "shell_exec",
        description: "Install npm dependencies",
        command:     "npm install",
        risk:        "low",
      },
      {
        type:        "file_write",
        description: "Create Express server with API routes",
        path:        "server.js",
        content:     serverJs,
        risk:        "low",
      },
    ]

    if (hasJWT) {
      actions.push({
        type:        "file_write",
        description: "Create JWT authentication middleware",
        path:        "middleware/auth.js",
        content:     authMiddleware,
        risk:        "low",
      })
    }

    if (hasPg) {
      actions.push({
        type:        "file_write",
        description: "Create PostgreSQL connection module",
        path:        "db.js",
        content:     pgDbJs,
        risk:        "low",
      })
    } else if (hasMongo) {
      actions.push({
        type:        "file_write",
        description: "Create MongoDB connection module",
        path:        "db.js",
        content:     mongoDbJs,
        risk:        "low",
      })
    }

    actions.push({
      type:        "shell_exec",
      description: "Start the Express API server",
      command:     "node server.js",
      risk:        "low",
    })

    return {
      summary:    `Express API server — ${g.features.join(", ") || "basic REST endpoints"}`,
      complexity: hasDB || hasJWT ? "medium" : "low",
      actions,
      _source:    "micro-planner:apiBuilder",
    }
  }
}

export const apiBuilderPlanner = new ApiBuilderPlanner()
