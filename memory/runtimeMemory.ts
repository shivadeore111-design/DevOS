// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import fs from "fs";
import path from "path";

interface RuntimeMemoryData {
  badCommands: string[];
  timeouts: string[];
  blocked: string[];
}

export class RuntimeMemory {
  private filePath: string;
  private data: RuntimeMemoryData;

  constructor() {
    this.filePath = path.join(
      process.cwd(),
      "memory",
      "runtime-memory.json"
    );

    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(
        this.filePath,
        JSON.stringify(
          { badCommands: [], timeouts: [], blocked: [] },
          null,
          2
        )
      );
    }

    this.data = JSON.parse(fs.readFileSync(this.filePath, "utf-8"));
  }

  private save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }

  recordTimeout(command: string) {
    if (!this.data.timeouts.includes(command)) {
      this.data.timeouts.push(command);
      this.save();
      console.log("🧠 Learned timeout pattern.");
    }
  }

  recordBadCommand(command: string) {
    if (!this.data.badCommands.includes(command)) {
      this.data.badCommands.push(command);
      this.save();
      console.log("🧠 Learned bad command.");
    }
  }

  recordBlocked(command: string) {
    if (!this.data.blocked.includes(command)) {
      this.data.blocked.push(command);
      this.save();
      console.log("🧠 Learned blocked command.");
    }
  }

  isKnownBad(command: string): boolean {
    return (
      this.data.badCommands.includes(command) ||
      this.data.timeouts.includes(command) ||
      this.data.blocked.includes(command)
    );
  }
}