// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import fs from "fs";
import path from "path";
import { runTerminal, TerminalResult } from "./terminal";

export interface Action {
  type: string;
  [key: string]: any;
}

export interface ActionResult {
  success: boolean;
  message?: string;
  data?: any;
}

function resolveSandboxPath(baseWorkspace: string, targetPath: string): string {
  const fullPath = path.resolve(baseWorkspace, targetPath);
  if (!fullPath.startsWith(baseWorkspace)) {
    throw new Error("Path escape detected.");
  }
  return fullPath;
}

export class Executor {
  async execute(action: Action, workspace: string): Promise<ActionResult> {
    try {
      switch (action.type) {
        case "file_create": {
          const fullPath = resolveSandboxPath(workspace, action.path);
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          fs.writeFileSync(fullPath, action.content || "", "utf-8");

          return {
            success: true,
            message: `File created at ${action.path}`,
          };
        }

        case "file_append": {
          const fullPath = resolveSandboxPath(workspace, action.path);
          fs.appendFileSync(fullPath, action.content || "", "utf-8");

          return {
            success: true,
            message: `Appended to ${action.path}`,
          };
        }

        case "file_read": {
          const fullPath = resolveSandboxPath(workspace, action.path);
          const content = fs.readFileSync(fullPath, "utf-8");

          return {
            success: true,
            data: content,
          };
        }

        case "file_delete": {
          const fullPath = resolveSandboxPath(workspace, action.path);
          fs.unlinkSync(fullPath);

          return {
            success: true,
            message: `Deleted ${action.path}`,
          };
        }

        case "terminal.run": {
          const result: TerminalResult = await runTerminal(
            action.command,
            action.timeoutMs
          );

          return {
            success: result.success,
            data: result,
          };
        }

        default:
          return {
            success: false,
            message: `Unknown action type: ${action.type}`,
          };
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Execution error",
      };
    }
  }
}