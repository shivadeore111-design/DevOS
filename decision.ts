// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// ============================================================
// decision.ts — DevOS Decision Layer
// Routes actions to: executor | openclaw | blocked
// ============================================================

import fs   from "fs";
import path from "path";

type DecisionResult = "executor" | "openclaw" | "blocked";

export class DecisionLayer {
  private workspace: string;
  private logFile: string;

  constructor(workspace: string) {
    this.workspace = workspace;
    this.logFile   = path.join(process.cwd(), "workspace", "decision.log");
  }

  decide(action: any, complexity?: string): DecisionResult {
    const decision = this.evaluate(action, complexity);
    this.logDecision(action, complexity, decision);
    return decision;
  }

  private evaluate(action: any, complexity?: string): DecisionResult {

    // 1. Explicit system task → openclaw
    if (action.type === "system_task") return "openclaw";

    // 2. High risk → openclaw
    if (action.risk === "high") return "openclaw";

    // 3. Git commands → openclaw
    if (action.command?.includes("git ")) return "openclaw";

    // 4. Dangerous command patterns → blocked
    const dangerousPatterns = ["rm -rf /", "del /f /s", "shutdown", "format c:", "reg delete"];
    if (dangerousPatterns.some(p => action.command?.toLowerCase().includes(p.toLowerCase()))) {
      return "blocked";
    }

    // 5. Path escapes sandbox → openclaw
    if (action.path) {
      const resolved = path.resolve(this.workspace, action.path);
      if (!resolved.startsWith(path.resolve(this.workspace))) return "openclaw";
    }

    // 6. LLM complexity hint (secondary signal)
    if (complexity === "high") return "openclaw";

    return "executor";
  }

  private logDecision(action: any, complexity: any, decision: DecisionResult): void {
    const entry = {
      timestamp:  new Date().toISOString(),
      type:       action.type,
      command:    action.command    ?? null,
      path:       action.path       ?? null,
      risk:       action.risk       ?? null,
      complexity: complexity        ?? null,
      decision,
    };
    try {
      const dir = path.dirname(this.logFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(this.logFile, JSON.stringify(entry) + "\n");
    } catch { /* non-critical */ }
  }
}
