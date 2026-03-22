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
   * After copying, auto-generates AGENTS.md via LLM.
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

    // Generate AGENTS.md asynchronously — fire-and-forget so copyTemplate stays sync
    this.generateAgentsMd(dest, tmpl).catch((err: any) =>
      console.warn(`[BlueprintStore] AGENTS.md generation failed: ${err.message}`)
    )
  }

  /**
   * Generate AGENTS.md for a project directory.
   * Reads package.json for stack + run commands, builds a file tree,
   * then asks Ollama to annotate each file and produce a structured doc.
   */
  async generateAgentsMd(projectDir: string, tmpl?: Template): Promise<void> {
    const projectName = path.basename(projectDir)

    // ── 1. Detect stack from package.json ────────────────────
    let stack = tmpl?.displayName ?? "Unknown stack"
    let runCmd    = tmpl?.runCmd    ?? "npm run dev"
    let installCmd = tmpl?.installCmd ?? "npm install"

    try {
      const pkgPath = path.join(projectDir, "package.json")
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"))
        const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
        stack = deps.slice(0, 8).join(", ")
        runCmd    = pkg.scripts?.dev     ?? pkg.scripts?.start ?? runCmd
        installCmd = "npm install"
      } else {
        const reqPath = path.join(projectDir, "requirements.txt")
        if (fs.existsSync(reqPath)) {
          stack = "Python / FastAPI"
          runCmd    = tmpl?.runCmd    ?? "uvicorn main:app --reload"
          installCmd = "pip install -r requirements.txt"
        }
      }
    } catch { /* use defaults */ }

    // ── 2. Build a compact file tree ─────────────────────────
    const fileTree = this._buildFileTree(projectDir, projectDir, 0, 2)

    // ── 3. Collect key file names for LLM context ─────────────
    const importantExts = new Set([".ts", ".tsx", ".js", ".jsx", ".py", ".json", ".md"])
    const keyFiles: string[] = []
    this._walkFiles(projectDir, (fp) => {
      if (importantExts.has(path.extname(fp)) &&
          !fp.includes("node_modules") &&
          !fp.includes(".git")) {
        keyFiles.push(fp.replace(projectDir + path.sep, ""))
      }
    })

    // ── 4. Ask Ollama to annotate the file tree ──────────────
    const prompt =
      `You are a technical architect. Generate a concise AGENTS.md for this project.\n\n` +
      `Project name: ${projectName}\n` +
      `Stack: ${stack}\n` +
      `File tree:\n${fileTree}\n\n` +
      `Rules:\n` +
      `- For each file, write ONE line describing its purpose\n` +
      `- Keep the Architecture section under 200 words\n` +
      `- Return ONLY the markdown content for the sections below — no preamble\n\n` +
      `Sections to generate:\n` +
      `## Architecture\n[file tree with one-line description per file]\n\n` +
      `## Key Files\n[most important files and what they do]\n`

    let archSection = ""
    try {
      archSection = await callOllama(prompt, coreBoot.getSystemPrompt())
    } catch {
      archSection = `## Architecture\n${fileTree}\n\n## Key Files\n${keyFiles.slice(0, 10).map(f => `- \`${f}\``).join("\n")}`
    }

    // ── 5. Write AGENTS.md ───────────────────────────────────
    const content = `# Project: ${projectName}

## Stack
${stack}

## How to Run
\`\`\`bash
${installCmd}
${runCmd}
\`\`\`

${archSection}

## DevOS Context
Template: ${tmpl?.name ?? "custom"}
Generated: ${new Date().toISOString()}
`

    fs.writeFileSync(path.join(projectDir, "AGENTS.md"), content, "utf-8")
    console.log(`[BlueprintStore] 📄 AGENTS.md generated → ${path.join(projectDir, "AGENTS.md")}`)
  }

  // ── Private helpers ───────────────────────────────────────────

  private _buildFileTree(root: string, dir: string, depth: number, maxDepth: number): string {
    if (depth > maxDepth) return ""
    const indent  = "  ".repeat(depth)
    const lines: string[] = []
    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return "" }

    for (const e of entries) {
      if (e.name === "node_modules" || e.name === ".git" || e.name === "dist") continue
      lines.push(`${indent}${e.isDirectory() ? "📁" : "📄"} ${e.name}`)
      if (e.isDirectory()) {
        lines.push(this._buildFileTree(root, path.join(dir, e.name), depth + 1, maxDepth))
      }
    }
    return lines.filter(Boolean).join("\n")
  }

  private _walkFiles(dir: string, cb: (filePath: string) => void): void {
    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.name === "node_modules" || e.name === ".git") continue
      if (e.isDirectory()) this._walkFiles(full, cb)
      else cb(full)
    }
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
