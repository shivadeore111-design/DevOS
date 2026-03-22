// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/goalParser.ts — Structured analysis of user goals before planning

import { osContext } from "./osContext"

export interface ParsedGoal {
  raw: string
  type: "build" | "debug" | "deploy" | "research" | "refactor" | "test" | "unknown"
  domain: "backend" | "frontend" | "fullstack" | "devops" | "data" | "general"
  stack: string[]
  features: string[]
  database: string | null
  successCriteria: string[]
  isWindows: boolean
}

function detectType(goal: string): ParsedGoal["type"] {
  const g = goal.toLowerCase()
  if (/\b(build|create|make|generate|scaffold|write|setup|set up|initialize|init)\b/.test(g)) return "build"
  if (/\b(fix|debug|error|bug|broken|crash|issue|problem|fail|failing)\b/.test(g)) return "debug"
  if (/\b(deploy|launch|host|publish|release|ship|serve|production)\b/.test(g)) return "deploy"
  if (/\b(research|find|analyze|analyse|explore|investigate|search|look up|summarize)\b/.test(g)) return "research"
  if (/\b(refactor|clean|reorganize|restructure|improve|optimize|simplify)\b/.test(g)) return "refactor"
  if (/\b(test|spec|coverage|unit|integration|e2e|jest|mocha|cypress)\b/.test(g)) return "test"
  return "unknown"
}

function detectDomain(goal: string): ParsedGoal["domain"] {
  const g = goal.toLowerCase()
  const isBackend  = /\b(api|server|backend|express|node|fastapi|django|flask|rest|graphql|endpoint|route|middleware)\b/.test(g)
  const isFrontend = /\b(react|vue|angular|svelte|frontend|ui|interface|component|html|css|tailwind|next\.?js|nuxt)\b/.test(g)
  const isDevops   = /\b(docker|k8s|kubernetes|ci|cd|pipeline|nginx|terraform|ansible|devops|container|compose)\b/.test(g)
  const isData     = /\b(data|analytics|etl|pipeline|pandas|csv|ml|machine learning|model|dataset)\b/.test(g)

  if (isBackend && isFrontend) return "fullstack"
  if (isBackend)  return "backend"
  if (isFrontend) return "frontend"
  if (isDevops)   return "devops"
  if (isData)     return "data"
  return "general"
}

function detectStack(goal: string): string[] {
  const g = goal.toLowerCase()
  const candidates: Record<string, RegExp> = {
    node:     /\b(node|nodejs|node\.js)\b/,
    python:   /\b(python|py|flask|django|fastapi)\b/,
    react:    /\b(react|reactjs|react\.js)\b/,
    docker:   /\b(docker|dockerfile|compose|container)\b/,
    postgres: /\b(postgres|postgresql|pg)\b/,
    mongodb:  /\b(mongo|mongodb)\b/,
    redis:    /\b(redis)\b/,
    jwt:      /\b(jwt|jsonwebtoken|json web token)\b/,
    express:  /\b(express|expressjs|express\.js)\b/,
    typescript: /\b(typescript|ts)\b/,
  }
  return Object.entries(candidates)
    .filter(([, pattern]) => pattern.test(g))
    .map(([name]) => name)
}

function detectFeatures(goal: string): string[] {
  const g = goal.toLowerCase()
  const featureMap: Record<string, RegExp> = {
    "REST API":       /\b(rest api|restful|api endpoint|routes?)\b/,
    "JWT":            /\b(jwt|json web token|bearer token)\b/,
    "authentication": /\b(auth|login|logout|signup|sign.?in|register|password)\b/,
    "database":       /\b(database|db|storage|persist|store data)\b/,
    "dashboard":      /\b(dashboard|admin panel|control panel)\b/,
    "payments":       /\b(payment|stripe|billing|checkout|invoice)\b/,
    "email":          /\b(email|smtp|sendgrid|nodemailer|mail)\b/,
    "file upload":    /\b(upload|multer|file|image|storage)\b/,
    "websocket":      /\b(websocket|ws|socket\.io|real.?time)\b/,
    "CRUD":           /\b(crud|create read update delete|get post put delete)\b/,
    "caching":        /\b(cache|caching|redis|memcache)\b/,
    "logging":        /\b(log|logging|winston|morgan|pino)\b/,
  }
  return Object.entries(featureMap)
    .filter(([, pattern]) => pattern.test(g))
    .map(([name]) => name)
}

function detectDatabase(goal: string): string | null {
  const g = goal.toLowerCase()
  if (/\b(postgres|postgresql|pg)\b/.test(g)) return "postgres"
  if (/\b(mysql|mariadb)\b/.test(g))          return "mysql"
  if (/\b(mongo|mongodb)\b/.test(g))          return "mongodb"
  if (/\b(sqlite|sqlite3)\b/.test(g))         return "sqlite"
  if (/\b(redis)\b/.test(g))                  return "redis"
  return null
}

function buildSuccessCriteria(type: ParsedGoal["type"], domain: ParsedGoal["domain"]): string[] {
  const base: Record<ParsedGoal["type"], string[]> = {
    build:    ["server running", "no errors", "dependencies installed"],
    debug:    ["error resolved", "tests passing", "no runtime exceptions"],
    deploy:   ["container running", "health check passes", "service accessible"],
    research: ["findings documented", "sources cited"],
    refactor: ["tests still passing", "no regressions", "cleaner code structure"],
    test:     ["all tests pass", "coverage above threshold"],
    unknown:  ["task completed successfully"],
  }
  const criteria = [...base[type]]
  if (domain === "backend" || domain === "fullstack") {
    criteria.push("API endpoints respond correctly")
  }
  if (domain === "frontend" || domain === "fullstack") {
    criteria.push("UI renders without errors")
  }
  return criteria
}

export function parseGoal(goal: string): ParsedGoal {
  const type            = detectType(goal)
  const domain          = detectDomain(goal)
  const stack           = detectStack(goal)
  const features        = detectFeatures(goal)
  const database        = detectDatabase(goal)
  const successCriteria = buildSuccessCriteria(type, domain)
  const isWindows       = osContext.platform === "win32"

  const parsed: ParsedGoal = {
    raw: goal,
    type,
    domain,
    stack,
    features,
    database,
    successCriteria,
    isWindows,
  }

  console.log(`[GoalParser] type=${type} domain=${domain} stack=[${stack.join(",")}] db=${database ?? "none"} windows=${isWindows}`)
  return parsed
}

export const goalParser = { parse: parseGoal }
