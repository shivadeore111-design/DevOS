// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import { SkillExecutor } from "./skillExecutor";
import { routeTask } from "../llm/skillRouter";

export class AgentLoop {
  private executor = new SkillExecutor();
  private maxSteps = 5;

  async run(task: string) {
    let context: any = { task };
    let step = 0;

    while (step < this.maxSteps) {
      console.log(`\n--- Step ${step + 1} ---`);

      const decision = await routeTask(context);

      if (decision.type === "finish") {
        console.log("Agent finished.");
        return decision.result;
      }

      const result = await this.executor.execute(
        decision.skill,
        decision.args
      );

      context.lastResult = result;
      step++;
    }

    throw new Error("Max steps reached without finishing.");
  }
}