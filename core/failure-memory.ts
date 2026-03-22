// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import fs from "fs";
import path from "path";

interface FailureRecord {
  command: string;
  reason: string;
  attempts: number;
  lastFailure: string;
}

export class FailureMemory {
  private memoryPath: string;
  private memory: Record<string, FailureRecord>;

  constructor(workspace: string) {
    this.memoryPath = path.join(workspace, "failureMemory.json");

    if (!fs.existsSync(this.memoryPath)) {
      fs.writeFileSync(this.memoryPath, JSON.stringify({}, null, 2));
    }

    this.memory = JSON.parse(
      fs.readFileSync(this.memoryPath, "utf-8")
    );
  }

  recordFailure(command: string, reason: string) {
    const key = command.trim();

    if (!this.memory[key]) {
      this.memory[key] = {
        command: key,
        reason,
        attempts: 1,
        lastFailure: new Date().toISOString(),
      };
    } else {
      this.memory[key].attempts += 1;
      this.memory[key].lastFailure = new Date().toISOString();
      this.memory[key].reason = reason;
    }

    this.save();
  }

  getFailure(command: string): FailureRecord | null {
    return this.memory[command.trim()] || null;
  }

  shouldBlockRetry(command: string, threshold = 2): boolean {
    const record = this.getFailure(command);
    if (!record) return false;

    return record.attempts >= threshold;
  }

  private save() {
    fs.writeFileSync(
      this.memoryPath,
      JSON.stringify(this.memory, null, 2)
    );
  }
}