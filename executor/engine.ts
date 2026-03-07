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

      if (route === "blocked") {
        console.error(`[Engine] Action blocked: ${action.command ?? action.type}`);
        results.push({ action, blocked: true });
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

      let result: any;
      switch (action.type) {
        case "file_write":
        case "file_append":
        case "file_read":
          result = await executeFileAction(action, this.workspace);
          break;
        case "shell_exec":
          result = await executeShellAction(action, this.workspace);
          break;
        case "web_fetch":
        case "web_search":
          result = await executeWebAction(action);
          break;
        case "llm_task": {
          const { content, provider, tokensEstimate } = await llmCall(
            action.query ?? action.description,
            action.systemPrompt
          );
          result = {
            success: true,
            output:  { content, provider, tokensEstimate },
          };
          break;
        }
        default:
          result = { success: false, error: `Unknown action type: ${action.type}` };
      }

      results.push({ action, route: "executor", ...result });

      if (!result.success) {
        console.error(`[Engine] Action failed: ${result.error}`);
        return { success: false, error: result.error, output: results };
      }
    }

    console.log(`\n[Engine] ✅ All ${plan.actions.length} actions completed.`);
    return { success: true, output: results };
  }
}