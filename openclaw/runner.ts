// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import fs from "fs";
import path from "path";
import { execa } from "execa";
import { Plan, Action } from "../autonomy/decision";

export class OpenClawRunner {
  private workspace: string;

  constructor(workspace: string) {
    this.workspace = workspace;
  }

  async executePlan(plan: Plan) {
    console.log("🦾 OpenClaw executing full plan...");

    for (const action of plan.actions) {
      await this.executeAction(action);
    }

    console.log("🦾 OpenClaw completed plan.");
  }

  async executeAction(action: Action) {
    if (action.type === "file_create") {
      if (!action.path) return;

      const filePath = path.join(this.workspace, action.path);
      const dir = path.dirname(filePath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, action.content || "");
      console.log(`🦾 Created file (OpenClaw): ${filePath}`);
    }

    if (action.type === "command" && action.command) {
      console.log(`🦾 Running (OpenClaw): ${action.command}`);

      await execa(action.command, {
        shell: true,
        cwd: this.workspace,
        stdio: "inherit",
      });
    }
  }
}