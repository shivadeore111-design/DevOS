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

        // ── PrecisionEdit: existing file + changeRequest → surgical edit ──
        if (action.changeRequest && fs.existsSync(safePath)) {
          try {
            const { precisionEdit } = await import("../../core/precisionEdit");
            const plan   = await precisionEdit.planEdit(safePath, action.changeRequest);
            const result = precisionEdit.applyEdit(safePath, plan);
            console.log(
              `[PrecisionEdit] Changed ${result.linesChanged} lines, preserved ${result.linesPreserved} lines in ${safePath}`
            );
            return { success: true, output: { path: safePath, ...result, precisionEdit: true } };
          } catch (peErr: any) {
            console.warn(`[PrecisionEdit] Fell back to full write: ${peErr.message}`);
          }
        }

        // ── Standard write: new file or explicit full-content replacement ──
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

      case "file_delete": {
        if (!fs.existsSync(safePath)) {
          return { success: false, error: `File not found: ${safePath}` };
        }
        fs.unlinkSync(safePath);
        console.log(`[FileActions] Deleted: ${safePath}`);
        return { success: true, output: { path: safePath, deleted: true } };
      }

      default:
        return { success: false, error: `Unknown file action type: ${action.type}` };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/** Create a directory (with all parents). Safe to call if it already exists. */
export async function executeFolderCreate(action: any, workspace: string): Promise<FileActionResult> {
  if (!action.path) return { success: false, error: 'folder_create: path is required' };

  // Allow absolute paths for folder_create (the LLM will supply full paths)
  const targetPath = path.isAbsolute(action.path)
    ? action.path
    : path.join(workspace, action.path);

  try {
    fs.mkdirSync(targetPath, { recursive: true });
    console.log(`[FileActions] Created folder: ${targetPath}`);
    return { success: true, output: { path: targetPath, created: true } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

function resolveSafe(workspace: string, filePath: string): string | null {
  if (!filePath) return null;
  const resolved = path.resolve(workspace, filePath);
  return resolved.startsWith(path.resolve(workspace)) ? resolved : null;
}
