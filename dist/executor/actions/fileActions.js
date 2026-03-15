"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeFileAction = executeFileAction;
// ============================================================
// fileActions.ts — DevOS File Action Executor
// ============================================================
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
async function executeFileAction(action, workspace) {
    const safePath = resolveSafe(workspace, action.path);
    if (!safePath) {
        return { success: false, error: `Path "${action.path}" escapes sandbox` };
    }
    try {
        switch (action.type) {
            case "file_write": {
                const dir = path_1.default.dirname(safePath);
                if (!fs_1.default.existsSync(dir))
                    fs_1.default.mkdirSync(dir, { recursive: true });
                fs_1.default.writeFileSync(safePath, action.content ?? "", "utf-8");
                console.log(`[FileActions] Written: ${safePath}`);
                return { success: true, output: { path: safePath, bytes: (action.content ?? "").length } };
            }
            case "file_append": {
                const dir = path_1.default.dirname(safePath);
                if (!fs_1.default.existsSync(dir))
                    fs_1.default.mkdirSync(dir, { recursive: true });
                fs_1.default.appendFileSync(safePath, action.content ?? "", "utf-8");
                console.log(`[FileActions] Appended: ${safePath}`);
                return { success: true, output: { path: safePath } };
            }
            case "file_read": {
                if (!fs_1.default.existsSync(safePath)) {
                    return { success: false, error: `File not found: ${safePath}` };
                }
                const content = fs_1.default.readFileSync(safePath, "utf-8");
                console.log(`[FileActions] Read: ${safePath} (${content.length} chars)`);
                return { success: true, output: { path: safePath, content } };
            }
            default:
                return { success: false, error: `Unknown file action type: ${action.type}` };
        }
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
function resolveSafe(workspace, filePath) {
    if (!filePath)
        return null;
    const resolved = path_1.default.resolve(workspace, filePath);
    return resolved.startsWith(path_1.default.resolve(workspace)) ? resolved : null;
}
