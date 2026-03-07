// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// ============================================================
// core/promptEvolver.ts — Self-improving agent prompts
//
// Loop:
//   execute → review → score → rewrite system prompt
//
// Evolved prompts are persisted per-role.
// Bad prompts are rolled back. Good prompts are kept.
// ============================================================

import fs   from "fs";
import path from "path";
import { callOllama } from "../llm/ollama";

const PROMPT_STORE = path.join(process.cwd(), "workspace", "memory", "evolved_prompts.json");

// ── Types ─────────────────────────────────────────────────────

export type AgentRole = "researcher" | "coder" | "marketer" | "reviewer" | "deployer";

export interface PromptRecord {
  role:        AgentRole;
  prompt:      string;         // current best prompt
  basePrompt:  string;         // original default (never overwritten)
  avgScore:    number;
  runCount:    number;
  evolveCount: number;
  lastScore:   number;
  lastUpdated: string;
}

// ── Storage ───────────────────────────────────────────────────

function loadStore(): Record<AgentRole, PromptRecord> {
  try {
    if (fs.existsSync(PROMPT_STORE)) {
      return JSON.parse(fs.readFileSync(PROMPT_STORE, "utf-8"));
    }
  } catch { /* fallback to empty */ }
  return {} as Record<AgentRole, PromptRecord>;
}

function saveStore(store: Record<string, PromptRecord>): void {
  const dir = path.dirname(PROMPT_STORE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = PROMPT_STORE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, PROMPT_STORE);
}

// ── PromptEvolver ─────────────────────────────────────────────

export class PromptEvolver {

  /**
   * Register a base prompt for a role (called once at startup per role).
   * Won't overwrite if role already has an evolved prompt.
   */
  static init(role: AgentRole, basePrompt: string): void {
    const store = loadStore();
    if (!store[role]) {
      store[role] = {
        role,
        prompt:      basePrompt,
        basePrompt,
        avgScore:    0,
        runCount:    0,
        evolveCount: 0,
        lastScore:   0,
        lastUpdated: new Date().toISOString(),
      };
      saveStore(store);
    }
  }

  /**
   * Get the current best system prompt for a role.
   * Falls back to the base prompt if no evolved version exists.
   */
  static getPrompt(role: AgentRole, basePrompt: string): string {
    const store = loadStore();
    return store[role]?.prompt ?? basePrompt;
  }

  /**
   * Record a score for a role's execution.
   * If score is low AND we have a failure reason, trigger prompt evolution.
   * Returns the new prompt (or current if unchanged).
   */
  static async recordScore(
    role:           AgentRole,
    score:          number,
    failureReasons: string[] = [],
    goalContext?:   string
  ): Promise<string> {
    const store = loadStore();
    const rec   = store[role];
    if (!rec) return "";

    // Update rolling average
    rec.runCount  += 1;
    rec.lastScore  = score;
    rec.avgScore   = ((rec.avgScore * (rec.runCount - 1)) + score) / rec.runCount;
    rec.lastUpdated = new Date().toISOString();

    const shouldEvolve =
      score < 7 &&                           // bad run
      failureReasons.length > 0 &&           // we know why
      rec.runCount > 1;                      // not first run (no baseline yet)

    if (shouldEvolve) {
      console.log(`[PromptEvolver] Evolving ${role} prompt (score: ${score}/10)...`);

      const newPrompt = await this._rewritePrompt(
        role,
        rec.prompt,
        score,
        failureReasons,
        goalContext
      );

      if (newPrompt && newPrompt.length > 50) {
        rec.prompt      = newPrompt;
        rec.evolveCount += 1;
        console.log(`[PromptEvolver] ✅ ${role} prompt evolved (v${rec.evolveCount})`);
      }
    }

    saveStore(store);
    return rec.prompt;
  }

  /**
   * Reset a role back to its base prompt (if evolution made things worse).
   */
  static reset(role: AgentRole): void {
    const store = loadStore();
    if (store[role]) {
      store[role].prompt      = store[role].basePrompt;
      store[role].evolveCount = 0;
      store[role].avgScore    = 0;
      store[role].runCount    = 0;
      saveStore(store);
      console.log(`[PromptEvolver] Reset ${role} to base prompt.`);
    }
  }

  /**
   * Print a report of all evolved prompts and their scores.
   */
  static report(): string {
    const store = loadStore();
    const lines = [
      "╔══════════════════════════════════════════╗",
      "║       Prompt Evolution Report            ║",
      "╚══════════════════════════════════════════╝",
      "",
    ];

    for (const [role, rec] of Object.entries(store)) {
      lines.push(
        `  ${role.padEnd(12)} avg: ${rec.avgScore.toFixed(1)}/10  ` +
        `runs: ${rec.runCount}  evolved: ${rec.evolveCount}x  ` +
        `last: ${rec.lastScore}/10`
      );
    }

    lines.push("");
    return lines.join("\n");
  }

  // ── Private ─────────────────────────────────────────────────

  private static async _rewritePrompt(
    role:           AgentRole,
    currentPrompt:  string,
    score:          number,
    failures:       string[],
    goalContext?:   string
  ): Promise<string> {
    const failureList = failures.map((f, i) => `${i + 1}. ${f}`).join("\n");

    const prompt =
      `You are improving a system prompt for an AI agent with role: ${role}.

The current system prompt scored ${score}/10 due to these specific failures:
${failureList}
${goalContext ? `\nGoal context: ${goalContext}` : ""}

Current system prompt:
---
${currentPrompt}
---

Rewrite this system prompt to fix the identified weaknesses.
- Keep what's working
- Add specific guidance to prevent the failures above
- Be concrete, not vague
- Do NOT add padding or filler
- Return ONLY the new system prompt text — no explanation, no markdown`;

    return callOllama(prompt, undefined);
  }
}
