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
exports.OpenClawRunner = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const execa_1 = require("execa");
class OpenClawRunner {
    constructor(workspace) {
        this.workspace = workspace;
    }
    async executePlan(plan) {
        console.log("🦾 OpenClaw executing full plan...");
        for (const action of plan.actions) {
            await this.executeAction(action);
        }
        console.log("🦾 OpenClaw completed plan.");
    }
    async executeAction(action) {
        if (action.type === "file_create") {
            if (!action.path)
                return;
            const filePath = path_1.default.join(this.workspace, action.path);
            const dir = path_1.default.dirname(filePath);
            if (!fs_1.default.existsSync(dir)) {
                fs_1.default.mkdirSync(dir, { recursive: true });
            }
            fs_1.default.writeFileSync(filePath, action.content || "");
            console.log(`🦾 Created file (OpenClaw): ${filePath}`);
        }
        if (action.type === "command" && action.command) {
            console.log(`🦾 Running (OpenClaw): ${action.command}`);
            await (0, execa_1.execa)(action.command, {
                shell: true,
                cwd: this.workspace,
                stdio: "inherit",
            });
        }
    }
}
exports.OpenClawRunner = OpenClawRunner;
