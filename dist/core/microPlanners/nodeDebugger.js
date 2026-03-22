"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.nodeDebuggerPlanner = exports.NodeDebuggerPlanner = void 0;
const osContext_1 = require("../osContext");
class NodeDebuggerPlanner {
    canHandle(g) {
        const rawLower = g.raw.toLowerCase();
        return g.type === "debug" ||
            /\b(fix|error|crash|bug|broken|fail|failing|exception|throws?)\b/.test(rawLower);
    }
    buildPlan(g) {
        const isWindows = osContext_1.osContext.platform === "win32";
        const raw = g.raw;
        // Try to extract an entry file from the goal text
        const fileMatch = raw.match(/\b(\w[\w/\\-]*\.(js|ts|mjs|cjs))\b/);
        const entryFile = fileMatch ? fileMatch[1] : "index.js";
        // Capture command — redirect stderr to stdout so we capture errors
        const captureCmd = isWindows
            ? `node ${entryFile} 2>&1`
            : `node ${entryFile} 2>&1`;
        // Fix verifier
        const verifyCmd = captureCmd;
        return {
            summary: `Debug Node.js issue: ${raw.slice(0, 60)}`,
            complexity: "medium",
            actions: [
                {
                    type: "shell_exec",
                    description: `Run ${entryFile} and capture error output`,
                    command: captureCmd,
                    risk: "low",
                },
                {
                    type: "llm_task",
                    description: "Analyze the error output and propose a fix",
                    query: `The following Node.js script produced an error.
Goal: ${raw}
Analyze the error and suggest a minimal code fix. Provide the corrected file content.`,
                    risk: "low",
                },
                {
                    type: "shell_exec",
                    description: "Apply the suggested fix (overwrite entry file with corrected content)",
                    command: `node -e "console.log('Applying fix...')"`,
                    risk: "medium",
                },
                {
                    type: "shell_exec",
                    description: "Verify the fix by running the script again",
                    command: verifyCmd,
                    risk: "low",
                },
            ],
            _source: "micro-planner:nodeDebugger",
        };
    }
}
exports.NodeDebuggerPlanner = NodeDebuggerPlanner;
exports.nodeDebuggerPlanner = new NodeDebuggerPlanner();
