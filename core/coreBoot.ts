// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// core/coreBoot.ts — Static system prompt with in-memory KV-cache
//
// The bootstrap files in context/bootstrap/ are read ONCE at
// first access and never again. This guarantees identical byte
// sequences for every Ollama call → Ollama's KV-cache reuses
// the prefill computation from the previous call.
//
// CRITICAL: Do NOT modify the bootstrap files at runtime.
// One character change invalidates the entire KV-cache.

import * as fs   from "fs"
import * as path from "path"

export class CoreBoot {
  private cache: string | null = null
  private loadedAt: Date | null = null

  // ── Public API ────────────────────────────────────────────

  /**
   * Load and cache the bootstrap directory once.
   * Files are read in alphabetical order:
   *   1. PERSONA.md
   *   2. RULES.md
   *   3. TOOLS.md
   * Their contents are joined with double newlines.
   */
  loadBootstrap(): string {
    if (this.cache !== null) return this.cache   // NEVER re-read after first load

    const dir = path.join(process.cwd(), "context", "bootstrap")

    if (!fs.existsSync(dir)) {
      // Graceful fallback: in-memory default — identical bytes guaranteed
      this.cache = this.builtinFallback()
      this.loadedAt = new Date()
      console.warn(
        `[CoreBoot] context/bootstrap/ not found — using built-in default system prompt`
      )
      return this.cache
    }

    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith(".md") || f.endsWith(".txt"))
      .sort()   // alphabetical order is deterministic

    if (files.length === 0) {
      this.cache = this.builtinFallback()
      this.loadedAt = new Date()
      console.warn(`[CoreBoot] context/bootstrap/ is empty — using built-in default`)
      return this.cache
    }

    this.cache = files
      .map(f => fs.readFileSync(path.join(dir, f), "utf-8").trim())
      .join("\n\n")

    this.loadedAt = new Date()
    console.log(
      `[CoreBoot] ✅ Loaded ${files.length} bootstrap file(s) ` +
      `(${this.cache.length} chars) — KV-cache primed`
    )
    return this.cache
  }

  /**
   * Returns the ONLY system prompt used anywhere in DevOS.
   * No exceptions. Ever.
   */
  getSystemPrompt(): string {
    return this.loadBootstrap()
  }

  /**
   * Returns the exact byte length of the current system prompt.
   * Used by the KV-cache metric tracker.
   */
  getPromptBytes(): number {
    return Buffer.byteLength(this.loadBootstrap(), "utf-8")
  }

  /**
   * True if the cache has been loaded at least once.
   */
  get isLoaded(): boolean {
    return this.cache !== null
  }

  /**
   * Timestamp of the first load (for diagnostics).
   */
  get loadedAtTime(): Date | null {
    return this.loadedAt
  }

  // ── Private ───────────────────────────────────────────────

  private builtinFallback(): string {
    return [
      "You are DevOS — an autonomous AI operating system. " +
      "You are calm, confident, and direct. " +
      "You never say \"Task completed successfully\" — you describe what actually happened. " +
      "You have opinions and share them. You push back on flawed plans. " +
      "You admit uncertainty. You ask one question at a time. " +
      "LLM plans. Code executes. System verifies. Memory learns.",

      "Available tools: shell_exec, file_write, file_read, file_delete, " +
      "npm_install, http_check, folder_create, taskpulse_add. " +
      "Always respond with JSON tool calls only when executing tasks. " +
      "No prose during execution.",

      "Rules: 1) One tool call per response during execution. " +
      "2) Always verify your work. " +
      "3) Read existing files before editing them. " +
      "4) Never assume a file exists — check first. " +
      "5) Use full absolute paths always. " +
      "6) On Windows use: echo, mkdir, copy, del. Never: touch, ls, cat, rm.",
    ].join("\n\n")
  }
}

export const coreBoot = new CoreBoot()
