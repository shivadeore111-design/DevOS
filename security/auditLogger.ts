// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// security/auditLogger.ts — Append-only structured audit log

import * as fs   from "fs";
import * as path from "path";

export interface AuditEntry {
  timestamp:  string;
  type:       "api_request" | "goal_executed" | "pilot_run" | "tool_used"
              | "auth_failed" | "injection_blocked" | "emergency_stop";
  actor?:     string;   // API key role or "cli"
  action:     string;
  detail?:    string;
  ip?:        string;
  success:    boolean;
}

const LOG_PATH = path.join(process.cwd(), "logs", "audit.log");

export class AuditLogger {
  constructor() {
    const dir = path.dirname(LOG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  log(entry: AuditEntry): void {
    const line = JSON.stringify(entry) + "\n";
    fs.appendFileSync(LOG_PATH, line);
  }

  getRecent(n: number = 50): AuditEntry[] {
    if (!fs.existsSync(LOG_PATH)) return [];
    const lines = fs.readFileSync(LOG_PATH, "utf-8")
      .trim().split("\n").filter(Boolean);
    return lines.slice(-n).map(l => JSON.parse(l) as AuditEntry).reverse();
  }

  getByType(type: AuditEntry["type"]): AuditEntry[] {
    return this.getRecent(500).filter(e => e.type === type);
  }
}

export const auditLogger = new AuditLogger();
