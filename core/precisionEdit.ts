// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/precisionEdit.ts — Surgical file editor: plans minimal diffs via LLM,
//                          applies exact line-range replacements, verifies tsc.

import fs   from "fs"
import path from "path"
import { execSync } from "child_process"
import { callOllama } from "../llm/ollama"

// ── Types ─────────────────────────────────────────────────────

export interface EditOperation {
  lineStart:  number   // 1-based, inclusive
  lineEnd:    number   // 1-based, inclusive
  oldContent: string   // exact existing text (for reference / safety check)
  newContent: string   // replacement text (may be multiline)
  reason:     string   // why this change is needed
}

export interface EditPlan {
  edits: EditOperation[]
}

export interface EditResult {
  linesChanged:   number
  linesPreserved: number
}

// ── PrecisionEdit ─────────────────────────────────────────────

class PrecisionEdit {

  // ── Plan ────────────────────────────────────────────────────

  /**
   * Read the file, send it plus the change request to Ollama, and return a
   * minimal set of line-range edits that satisfy the request.
   */
  async planEdit(filePath: string, changeRequest: string): Promise<EditPlan> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`[PrecisionEdit] File not found: ${filePath}`)
    }

    const contents = fs.readFileSync(filePath, "utf-8")
    const lines    = contents.split("\n")

    const prompt =
      `Given this file (${lines.length} lines):\n` +
      `\`\`\`\n${contents}\n\`\`\`\n\n` +
      `Change request: ${changeRequest}\n\n` +
      `Return ONLY valid JSON describing the minimal targeted edits:\n` +
      `{\n` +
      `  "edits": [\n` +
      `    {\n` +
      `      "lineStart": <1-based line number, inclusive>,\n` +
      `      "lineEnd":   <1-based line number, inclusive>,\n` +
      `      "oldContent": "<exact existing lines in that range>",\n` +
      `      "newContent": "<replacement lines>",\n` +
      `      "reason":     "<why this change is needed>"\n` +
      `    }\n` +
      `  ]\n` +
      `}\n\n` +
      `Rules:\n` +
      `- Only include lines that actually need to change\n` +
      `- Do NOT rewrite or repeat unchanged sections\n` +
      `- Edits must not overlap\n` +
      `- Return only valid JSON, no markdown fences or other text`

    const raw = await callOllama(prompt)
    return this._parseEditPlan(raw)
  }

  // ── Apply ────────────────────────────────────────────────────

  /**
   * Apply all edits in the plan to the file by replacing exact line ranges.
   * Edits are applied in descending line order so that earlier line numbers
   * remain valid as later ranges are spliced in.
   * Returns counts of changed vs preserved lines.
   */
  applyEdit(filePath: string, plan: EditPlan): EditResult {
    if (!fs.existsSync(filePath)) {
      throw new Error(`[PrecisionEdit] File not found: ${filePath}`)
    }

    if (!plan.edits.length) {
      console.warn("[PrecisionEdit] Edit plan is empty — file unchanged.")
      return { linesChanged: 0, linesPreserved: fs.readFileSync(filePath, "utf-8").split("\n").length }
    }

    const original    = fs.readFileSync(filePath, "utf-8")
    const lines       = original.split("\n")
    const totalBefore = lines.length

    // Sort descending by lineStart so splice indices stay valid
    const sorted = [...plan.edits].sort((a, b) => b.lineStart - a.lineStart)

    let linesChanged = 0

    for (const edit of sorted) {
      const start       = Math.max(1, edit.lineStart) - 1  // 0-based
      const end         = Math.min(lines.length, edit.lineEnd) - 1  // 0-based
      const deleteCount = end - start + 1
      const newLines    = edit.newContent === "" ? [] : edit.newContent.split("\n")

      lines.splice(start, deleteCount, ...newLines)
      linesChanged += deleteCount

      if (edit.reason) {
        // lightweight tracing — visible in verbose logs
        console.log(`[PrecisionEdit]   • ${edit.reason} (lines ${edit.lineStart}–${edit.lineEnd})`)
      }
    }

    fs.writeFileSync(filePath, lines.join("\n"), "utf-8")

    const linesPreserved = Math.max(0, totalBefore - linesChanged)
    return { linesChanged, linesPreserved }
  }

  // ── Verify ───────────────────────────────────────────────────

  /**
   * Run `tsc --noEmit` from the nearest tsconfig.json ancestor.
   * Returns true if there are no new TypeScript errors.
   */
  verifyEdit(filePath: string, _plan: EditPlan): boolean {
    // Walk up the directory tree to find tsconfig.json
    let tsConfigDir = path.dirname(path.resolve(filePath))
    for (let i = 0; i < 6; i++) {
      if (fs.existsSync(path.join(tsConfigDir, "tsconfig.json"))) break
      const parent = path.dirname(tsConfigDir)
      if (parent === tsConfigDir) break
      tsConfigDir = parent
    }

    try {
      execSync("npx tsc --noEmit", { cwd: tsConfigDir, stdio: "pipe" })
      return true
    } catch {
      return false
    }
  }

  // ── Private ───────────────────────────────────────────────────

  private _parseEditPlan(raw: string): EditPlan {
    // Try direct parse first
    try {
      const parsed = JSON.parse(raw.trim())
      if (parsed && Array.isArray(parsed.edits)) return parsed as EditPlan
    } catch { /* fall through */ }

    // Try to extract a JSON object containing "edits" from surrounding text
    const match = raw.match(/\{[\s\S]*?"edits"[\s\S]*?\}(?=\s*$|\s*[^,{[])/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0])
        if (parsed && Array.isArray(parsed.edits)) return parsed as EditPlan
      } catch { /* fall through */ }
    }

    // Broader fallback: grab first { ... } block
    const broad = raw.match(/\{[\s\S]*\}/)
    if (broad) {
      try {
        const parsed = JSON.parse(broad[0])
        if (parsed && Array.isArray(parsed.edits)) return parsed as EditPlan
      } catch { /* fall through */ }
    }

    console.warn("[PrecisionEdit] Could not parse LLM edit plan — returning empty plan")
    return { edits: [] }
  }
}

export const precisionEdit = new PrecisionEdit()
