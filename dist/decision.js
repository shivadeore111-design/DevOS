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
exports.DecisionLayer = void 0;
// ============================================================
// decision.ts — DevOS Decision Layer
// Routes actions to: executor | openclaw | blocked
// ============================================================
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class DecisionLayer {
    constructor(workspace) {
        this.workspace = workspace;
        this.logFile = path_1.default.join(process.cwd(), "workspace", "decision.log");
    }
    decide(action, complexity) {
        const decision = this.evaluate(action, complexity);
        this.logDecision(action, complexity, decision);
        return decision;
    }
    evaluate(action, complexity) {
        // 1. Explicit system task → openclaw
        if (action.type === "system_task")
            return "openclaw";
        // 2. High risk → openclaw
        if (action.risk === "high")
            return "openclaw";
        // 3. Git commands → openclaw
        if (action.command?.includes("git "))
            return "openclaw";
        // 4. Dangerous command patterns → blocked
        const dangerousPatterns = ["rm -rf /", "del /f /s", "shutdown", "format c:", "reg delete"];
        if (dangerousPatterns.some(p => action.command?.toLowerCase().includes(p.toLowerCase()))) {
            return "blocked";
        }
        // 5. Path escapes sandbox → openclaw
        if (action.path) {
            const resolved = path_1.default.resolve(this.workspace, action.path);
            if (!resolved.startsWith(path_1.default.resolve(this.workspace)))
                return "openclaw";
        }
        // 6. LLM complexity hint (secondary signal)
        if (complexity === "high")
            return "openclaw";
        return "executor";
    }
    logDecision(action, complexity, decision) {
        const entry = {
            timestamp: new Date().toISOString(),
            type: action.type,
            command: action.command ?? null,
            path: action.path ?? null,
            risk: action.risk ?? null,
            complexity: complexity ?? null,
            decision,
        };
        try {
            const dir = path_1.default.dirname(this.logFile);
            if (!fs_1.default.existsSync(dir))
                fs_1.default.mkdirSync(dir, { recursive: true });
            fs_1.default.appendFileSync(this.logFile, JSON.stringify(entry) + "\n");
        }
        catch { /* non-critical */ }
    }
}
exports.DecisionLayer = DecisionLayer;
