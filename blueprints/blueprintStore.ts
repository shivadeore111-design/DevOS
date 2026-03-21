// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// blueprints/blueprintStore.ts — Project template registry + copy engine

import * as fs   from "fs"
import * as path from "path"
import { callOllama } from "../llm/ollama"
import { coreBoot }   from "../core/coreBoot"

export interface Template {
  name:        string   // slug, e.g. "express-api"
  displayName: string   // e.g. "Express + TypeScript API"
  description: string
  tags:        string[]
  runCmd:      string   // how to run after install
  installCmd:  string   // e.g. "npm install"
  port:        number | null
  dir:         string   // absolute path to template directory
}

// ── Template registry ─────────────────────────────────────────

const TEMPLATES_DIR = path.join(__dirname, "templates")

const TEMPLATE_META: Omit<Template, "dir">[] = [
  {
    name:        "express-api",
    displayName: "Express + TypeScript API",
    description: "REST API with Express 4 + TypeScript. Includes /health, /api/items CRUD. Port 3001.",
    tags:        ["api", "rest", "express", "typescript", "node", "backend", "server"],
    runCmd:      "npm run dev",
    installCmd:  "npm install",
    port:        3001,
  },
  {
    name:        "nextjs-saas",
    displayName: "Next.js 14 SaaS Starter",
    description: "Full SaaS landing + app shell with Next.js 14, Tailwind CSS, and shadcn-ready layout. Port 3000.",
    tags:        ["saas", "nextjs", "next", "react", "tailwind", "full-stack", "website", "frontend"],
    runCmd:      "npm run dev",
    installCmd:  "npm install",
    port:        3000,
  },
  {
    name:        "react-dashboard",
    displayName: "React Analytics Dashboard",
    description: "React + Vite dashboard with Recharts line and bar charts, mock KPI cards. Port 5173.",
    tags:        ["dashboard", "analytics", "react", "charts", "vite", "recharts", "frontend", "admin"],
    runCmd:      "npm run dev",
    installCmd:  "npm install",
    port:        5173,
  },
  {
    name:        "landing-page",
    displayName: "Landing Page (HTML + Tailwind CDN)",
    description: "Single index.html with Tailwind CDN. Hero, features, pricing, CTA. Open directly in browser — no build step.",
    tags:        ["landing", "html", "static", "tailwind", "marketing", "website", "simple"],
    runCmd:      "open index.html",
    installCmd:  "",
    port:        null,
  },
  {
    name:        "python-api",
    displayName: "Python FastAPI",
    description: "FastAPI REST API with CORS, /health, /items CRUD, Pydantic v2. Port 8000.",
    tags:        ["python", "fastapi", "api", "rest", "backend", "server", "pydantic"],
    runCmd:      "uvicorn main:app --reload",
    installCmd:  "pip install -r requirements.txt",
    port:        8000,
  },
]

export class BlueprintStore {

  // ── List ─────────────────────────────────────────────────────

  listTemplates(): Template[] {
    return TEMPLATE_META.map(m => ({
      ...m,
      dir: path.join(TEMPLATES_DIR, m.name),
    }))
  }

  // ── Get ──────────────────────────────────────────────────────

  getTemplate(name: string): Template {
    const meta = TEMPLATE_META.find(m => m.name === name)
    if (!meta) throw new Error(`[BlueprintStore] Template not found: "${name}"`)
    return { ...meta, dir: path.join(TEMPLATES_DIR, name) }
  }

  // ── Copy ─────────────────────────────────────────────────────

  /**
   * Copy a template to `dest`, replacing every occurrence of
   * the literal string "PROJECT_NAME" with the folder basename.
   */
  copyTemplate(templateName: string, dest: string): void {
    const tmpl        = this.getTemplate(templateName)
    const projectName = path.basename(dest)

    if (!fs.existsSync(tmpl.dir)) {
      throw new Error(`[BlueprintStore] Template directory not found: ${tmpl.dir}`)
    }

    fs.mkdirSync(dest, { recursive: true })
    this._copyDir(tmpl.dir, dest, projectName)
    console.log(`[BlueprintStore] ✅ Copied "${templateName}" → ${dest}`)
  }

  // ── Match (LLM) ───────────────────────────────────────────────

  /**
   * Ask Ollama to pick the best-matching template for a free-text description.
   * Falls back to tag-based scoring if LLM fails.
   */
  async matchTemplate(description: string): Promise<Template> {
    const list = this.listTemplates()

    const prompt = `You are a template selector. Given a user's project description, choose the best template.

User description: "${description}"

Available templates:
${list.map((t, i) => `${i + 1}. ${t.name} — ${t.description}`).join("\n")}

Respond with ONLY the template name (slug) — nothing else. Example: express-api`

    try {
      const raw = await callOllama(prompt, coreBoot.getSystemPrompt())
      const chosen = raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, "")
      const found  = list.find(t => t.name === chosen)
      if (found) {
        console.log(`[BlueprintStore] LLM matched: "${description}" → ${found.name}`)
        return found
      }
    } catch { /* fall through to tag scoring */ }

    // Tag-based fallback: score by keyword overlap
    const words = description.toLowerCase().split(/\s+/)
    let best = list[0]
    let bestScore = 0
    for (const t of list) {
      const score = t.tags.filter(tag => words.some(w => w.includes(tag) || tag.includes(w))).length
      if (score > bestScore) { bestScore = score; best = t }
    }
    console.log(`[BlueprintStore] Tag-matched: "${description}" → ${best.name} (score: ${bestScore})`)
    return best
  }

  // ── Private ───────────────────────────────────────────────────

  private _copyDir(src: string, dest: string, projectName: string): void {
    const entries = fs.readdirSync(src, { withFileTypes: true })
    for (const entry of entries) {
      const srcPath  = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)

      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true })
        this._copyDir(srcPath, destPath, projectName)
      } else {
        // Text files: replace PROJECT_NAME placeholder
        const TEXT_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".html",
                                   ".css", ".md", ".txt", ".py", ".env", ".toml"])
        const ext = path.extname(entry.name).toLowerCase()
        if (TEXT_EXTS.has(ext)) {
          const content = fs.readFileSync(srcPath, "utf-8")
          fs.writeFileSync(destPath, content.split("PROJECT_NAME").join(projectName), "utf-8")
        } else {
          fs.copyFileSync(srcPath, destPath)
        }
      }
    }
  }
}

export const blueprintStore = new BlueprintStore()
