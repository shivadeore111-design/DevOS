// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// ============================================================
// fileActions.ts — DevOS File Action Executor
// ============================================================

import fs   from "fs";
import path from "path";

export interface FileActionResult {
  success: boolean;
  output?: any;
  error?: string;
}

export async function executeFileAction(action: any, workspace: string): Promise<FileActionResult> {
  const safePath = resolveSafe(workspace, action.path);
  if (!safePath) {
    return { success: false, error: `Path "${action.path}" escapes sandbox` };
  }

  try {
    switch (action.type) {

      case "file_write": {
        const dir = path.dirname(safePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(safePath, action.content ?? "", "utf-8");
        console.log(`[FileActions] Written: ${safePath}`);
        return { success: true, output: { path: safePath, bytes: (action.content ?? "").length } };
      }

      case "file_append": {
        const dir = path.dirname(safePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.appendFileSync(safePath, action.content ?? "", "utf-8");
        console.log(`[FileActions] Appended: ${safePath}`);
        return { success: true, output: { path: safePath } };
      }

      case "file_read": {
        if (!fs.existsSync(safePath)) {
          return { success: false, error: `File not found: ${safePath}` };
        }
        const content = fs.readFileSync(safePath, "utf-8");
        console.log(`[FileActions] Read: ${safePath} (${content.length} chars)`);
        return { success: true, output: { path: safePath, content } };
      }

      default:
        return { success: false, error: `Unknown file action type: ${action.type}` };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

function resolveSafe(workspace: string, filePath: string): string | null {
  if (!filePath) return null;
  const resolved = path.resolve(workspace, filePath);
  return resolved.startsWith(path.resolve(workspace)) ? resolved : null;
}
