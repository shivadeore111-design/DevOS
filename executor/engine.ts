// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// ============================================================
// engine.ts — DevOS Execution Engine
// Orchestrates action dispatch, decision layer, LLM tasks
// ============================================================
import { DecisionLayer }       from "../decision";
import { executeFileAction }   from "./actions/fileActions";
import { executeShellAction }  from "./actions/shellActions";
import { executeWebAction }    from "./actions/webActions";
import { llmCall }             from "../llm/router";
import { OpenClawAdapter }     from "../openclaw/openclaw-adapter";
import { eventBus }            from "../dashboard/events";
import { controlKernel }       from "../control/controlKernel";

export interface EngineResult {
  success: boolean;
  output?: any;
  error?: string;
}

export class DevOSEngine {
  private workspace: string;
  private dryRun:    boolean;
  private decision:  DecisionLayer;
  private openclaw:  OpenClawAdapter;

  constructor(workspace: string, dryRun = false) {
    this.workspace = workspace;
    this.dryRun    = dryRun;
    this.decision  = new DecisionLayer(workspace);
    this.openclaw  = new OpenClawAdapter();
  }

  /**
   * Execute a single action — used by the GraphExecutor.
   * All action types are supported: file_write, shell_exec, web_fetch, llm_task, etc.
   */
  async executeOne(action: any, workspacePath?: string, goalId?: string): Promise<EngineResult> {
    const ws = workspacePath ?? this.workspace;

    if (this.dryRun) {
      console.log(`[Engine] DRY RUN — skipping: ${JSON.stringify(action)}`);
      return { success: true, output: { skipped: true } };
    }

    // ── Control Kernel: validate before execution ─────────
    const gid        = goalId ?? "unknown";
    const validation = controlKernel.validate(action, gid);
    if (!validation.approved) {
      return { success: false, error: `[ControlKernel] Blocked: ${validation.reason}` };
    }

    const route = this.decision.decide(action, "low");

    if (route === "blocked") {
      return { success: false, error: `Blocked command: ${action.command ?? action.type}` };
    }

    if (route === "openclaw") {
      return this.openclaw.executeEscalation(action, ws);
    }

    switch (action.type) {
      case "file_write":
      case "file_append":
      case "file_read":
        return executeFileAction(action, ws);

      case "shell_exec":
        return executeShellAction(action, ws);

      case "web_fetch":
      case "web_search":
        return executeWebAction(action);

      case "llm_task": {
        const { content, provider, tokensEstimate } = await llmCall(
          action.query ?? action.description,
          action.systemPrompt,
        );
        return { success: true, output: { content, provider, tokensEstimate } };
      }

      case "product_build": {
        const { productGenerator } = await import("../devos/product/productGenerator");
        const result = await productGenerator.generate(
          action.goal ?? action.description ?? "build product",
          action.blueprintId,
          ws,
        );
        return {
          success: result.status === "completed",
          output:  result,
          error:   result.status === "failed" ? `Product build failed: ${result.modulesFailed.join(", ")}` : undefined,
        };
      }

      default:
        return { success: false, error: `Unknown action type: ${action.type}` };
    }
  }

  // ── Legacy linear executor (kept for compatibility) ────────

  async execute(plan: any): Promise<EngineResult> {
    if (!plan?.actions?.length) {
      return { success: false, error: "Plan has no actions" };
    }

    console.log(`\n[Engine] Executing plan: "${plan.summary}" (${plan.actions.length} actions)`);
    const results: any[] = [];

    for (let i = 0; i < plan.actions.length; i++) {
      const action = plan.actions[i];
      console.log(`\n[Engine] Action ${i + 1}/${plan.actions.length}: ${action.type} — ${action.description ?? ""}`);

      if (this.dryRun) {
        console.log(`[Engine] DRY RUN — skipping: ${JSON.stringify(action)}`);
        results.push({ action, skipped: true });
        continue;
      }

      const route = this.decision.decide(action, plan.complexity);
      console.log(`[Engine] Decision: ${route}`);

      eventBus.emit({
        type:      "step_started",
        payload:   { step: i + 1, total: plan.actions.length, action, route },
        timestamp: new Date().toISOString(),
      });

      if (route === "blocked") {
        console.error(`[Engine] Action blocked: ${action.command ?? action.type}`);
        results.push({ action, blocked: true });
        eventBus.emit({
          type:      "step_failed",
          payload:   { step: i + 1, action, reason: "blocked" },
          timestamp: new Date().toISOString(),
        });
        continue;
      }

      if (route === "openclaw") {
        const result = await this.openclaw.executeEscalation(action, this.workspace);
        results.push({ action, route: "openclaw", ...result });
        if (!result.success) {
          return { success: false, error: result.error, output: results };
        }
        continue;
      }

      const result = await this.executeOne(action);
      results.push({ action, route: "executor", ...result });

      if (!result.success) {
        console.error(`[Engine] Action failed: ${result.error}`);
        eventBus.emit({
          type:      "step_failed",
          payload:   { step: i + 1, action, error: result.error },
          timestamp: new Date().toISOString(),
        });
        return { success: false, error: result.error, output: results };
      }

      const emitType = action.type === "shell_exec" ? "command_executed" : "step_completed";
      eventBus.emit({
        type:      emitType,
        payload:   { step: i + 1, action, output: result.output },
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`\n[Engine] ✅ All ${plan.actions.length} actions completed.`);
    return { success: true, output: results };
  }
}
