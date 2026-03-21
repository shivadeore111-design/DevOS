// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// core/contextLens.ts — Tool result compression
// Every tool result that would be fed back into context passes
// through compress() to remove noise, truncate long output, and
// surface only signal (errors, exit codes, key lines).
// This keeps the growing context window from ballooning.

export interface ToolResult {
  output?:       any       // heterogeneous: string | object | number depending on tool
  content?:      string
  body?:         string
  path?:         string
  bytesWritten?: number
  url?:          string
  status?:       number
  statusCode?:   number
  ms?:           number
  exitCode?:     number
  exit_code?:    number
  stderr?:       string
  error?:        string
  [key: string]: any
}

export class ContextLens {

  // ── Main entry point ─────────────────────────────────────

  compress(result: ToolResult, toolType: string): string {
    if (!result) return "(no result)"

    try {
      switch (toolType) {

        // ── shell_exec ──────────────────────────────────
        case "shell_exec": {
          const raw     = this.stringify(result.output ?? result)
          const exitCode = result.exitCode ?? result.exit_code ?? result.output?.exitCode
          if (raw.length <= 500) return raw + (exitCode !== undefined ? `\nExit: ${exitCode}` : "")

          const lines      = raw.split("\n")
          const errorLines = lines.filter(l => /error|Error|ERR|warn/i.test(l)).slice(0, 5)
          const first      = raw.slice(0, 200)
          const last       = raw.slice(-100)
          const truncNote  = `\n...[${raw.length} chars truncated]...\n`
          const errBlock   = errorLines.length
            ? `\nErrors:\n${errorLines.join("\n")}`
            : ""
          return `${first}${truncNote}${last}${errBlock}\nExit: ${exitCode ?? "?"}`
        }

        // ── file_write ──────────────────────────────────
        case "file_write": {
          const p     = result.path ?? result.output?.path ?? "?"
          const bytes = result.bytesWritten ?? result.output?.bytesWritten
          if (bytes !== undefined) return `wrote ${bytes} bytes to ${p} ✅`
          return `file written: ${p} ✅`
        }

        // ── file_append ─────────────────────────────────
        case "file_append": {
          const p = result.path ?? result.output?.path ?? "?"
          return `appended to ${p} ✅`
        }

        // ── file_read ───────────────────────────────────
        case "file_read": {
          const content = result.content ?? result.output?.content
          if (!content) return "(file_read: empty content)"
          const text = this.stringify(content)
          if (text.length <= 1000) return text
          return text.slice(0, 500) + `\n...[${text.length} total chars, truncated]`
        }

        // ── file_delete ─────────────────────────────────
        case "file_delete": {
          const p = result.path ?? result.output?.path ?? "?"
          return `deleted ${p} ✅`
        }

        // ── folder_create ────────────────────────────────
        case "folder_create": {
          const p = result.path ?? result.output?.path ?? "?"
          return `created ${p} ✅`
        }

        // ── npm_install ─────────────────────────────────
        case "npm_install": {
          const raw      = this.stringify(result.output ?? result)
          const npmLines = raw.split("\n")
          // Last non-empty line is usually the summary (e.g. "added 42 packages")
          const lastLine = npmLines.filter(l => l.trim().length > 0).slice(-1)[0] ?? ""
          const errors   = npmLines.filter(l => /error|ERR/i.test(l)).slice(0, 3)
          return errors.length
            ? `${lastLine}\n${errors.join("\n")}`
            : lastLine || "(npm install complete)"
        }

        // ── http_check ──────────────────────────────────
        case "http_check": {
          const url    = result.url ?? result.output?.url ?? "?"
          const status = result.statusCode ?? result.status ?? result.output?.statusCode
          const ms     = result.ms ?? result.output?.ms ?? result.output?.responseTimeMs
          return `GET ${url} → ${status ?? "?"} in ${ms ?? "?"}ms`
        }

        // ── run_python / run_node / run_powershell ────────
        case "run_python":
        case "run_node":
        case "run_powershell": {
          const raw = this.stringify(result.output ?? result)
          if (raw.length <= 400) return raw
          return raw.slice(0, 200) + `\n...[${raw.length} chars truncated]...\n` + raw.slice(-100)
        }

        // ── fetch_url / web_fetch ────────────────────────
        case "fetch_url":
        case "web_fetch": {
          const content = result.content ?? result.body ?? result.output?.content
          if (!content) return "(fetch: empty response)"
          const text = this.stringify(content)
          return text.length <= 800 ? text : text.slice(0, 500) + `\n...[${text.length} chars]`
        }

        // ── web_search ───────────────────────────────────
        case "web_search": {
          const results = result.results ?? result.output?.results
          if (Array.isArray(results)) {
            return results.slice(0, 3)
              .map((r: any) => `• ${r.title ?? "?"}: ${r.url ?? ""} — ${(r.snippet ?? "").slice(0, 100)}`)
              .join("\n")
          }
          return this.stringify(result).slice(0, 300)
        }

        // ── notify / system_info / open_browser ──────────
        case "notify":
        case "open_browser":
          return `${toolType} ✅`
        case "system_info":
          return this.stringify(result.output ?? result).slice(0, 200)

        // ── llm_task ─────────────────────────────────────
        case "llm_task": {
          const content = result.content ?? result.output?.content
          if (!content) return "(llm_task: empty)"
          const text = this.stringify(content)
          return text.length <= 600 ? text : text.slice(0, 400) + `\n...[${text.length} chars]`
        }

        // ── product_build ────────────────────────────────
        case "product_build": {
          const status  = result.status ?? result.output?.status ?? "unknown"
          const modules = result.modules ?? result.output?.modules
          return modules
            ? `product_build ${status}: ${Array.isArray(modules) ? modules.join(", ") : modules}`
            : `product_build ${status}`
        }

        // ── Default: JSON slice ──────────────────────────
        default: {
          const json = JSON.stringify(result)
          return json.length <= 300 ? json : json.slice(0, 300) + "…"
        }
      }
    } catch (err: any) {
      return `[ContextLens] compress threw: ${err.message}`
    }
  }

  // ── Helpers ───────────────────────────────────────────────

  private stringify(v: any): string {
    if (typeof v === "string") return v
    if (v === null || v === undefined) return ""
    try { return JSON.stringify(v) } catch { return String(v) }
  }
}

export const contextLens = new ContextLens()
