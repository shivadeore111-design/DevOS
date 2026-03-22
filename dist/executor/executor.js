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
exports.Executor = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const terminal_1 = require("./terminal");
function resolveSandboxPath(baseWorkspace, targetPath) {
    const fullPath = path_1.default.resolve(baseWorkspace, targetPath);
    if (!fullPath.startsWith(baseWorkspace)) {
        throw new Error("Path escape detected.");
    }
    return fullPath;
}
class Executor {
    async execute(action, workspace) {
        try {
            switch (action.type) {
                case "file_create": {
                    const fullPath = resolveSandboxPath(workspace, action.path);
                    fs_1.default.mkdirSync(path_1.default.dirname(fullPath), { recursive: true });
                    fs_1.default.writeFileSync(fullPath, action.content || "", "utf-8");
                    return {
                        success: true,
                        message: `File created at ${action.path}`,
                    };
                }
                case "file_append": {
                    const fullPath = resolveSandboxPath(workspace, action.path);
                    fs_1.default.appendFileSync(fullPath, action.content || "", "utf-8");
                    return {
                        success: true,
                        message: `Appended to ${action.path}`,
                    };
                }
                case "file_read": {
                    const fullPath = resolveSandboxPath(workspace, action.path);
                    const content = fs_1.default.readFileSync(fullPath, "utf-8");
                    return {
                        success: true,
                        data: content,
                    };
                }
                case "file_delete": {
                    const fullPath = resolveSandboxPath(workspace, action.path);
                    fs_1.default.unlinkSync(fullPath);
                    return {
                        success: true,
                        message: `Deleted ${action.path}`,
                    };
                }
                case "terminal.run": {
                    const result = await (0, terminal_1.runTerminal)(action.command, action.timeoutMs, workspace);
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
        }
        catch (error) {
            return {
                success: false,
                message: error.message || "Execution error",
            };
        }
    }
}
exports.Executor = Executor;
