// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import { OpenClaw } from "@openclaw/core";

export class OpenClawClient {
  private claw: OpenClaw;

  constructor() {
    this.claw = new OpenClaw({
      workingDirectory: "C:\\DevOS\\workspace\\sandbox",
      allowDangerous: false
    });
  }

  async runTask(task: string) {
    console.log("🦾 OpenClaw executing task...");
    const result = await this.claw.execute(task);
    console.log("🦾 OpenClaw Result:\n", result);
    return result;
  }
}