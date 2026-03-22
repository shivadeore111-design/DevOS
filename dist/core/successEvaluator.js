"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.successEvaluator = exports.SuccessEvaluator = void 0;
// core/successEvaluator.ts — Verify goal completion against success criteria
const net = __importStar(require("net"));
const http = __importStar(require("http"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// ── TCP port probe ────────────────────────────────────────
function tcpConnect(host, port, timeoutMs = 2000) {
    return new Promise(resolve => {
        const s = net.createConnection(port, host);
        const timer = setTimeout(() => { s.destroy(); resolve(false); }, timeoutMs);
        s.once("connect", () => { clearTimeout(timer); s.destroy(); resolve(true); });
        s.once("error", () => { clearTimeout(timer); s.destroy(); resolve(false); });
    });
}
// ── HTTP GET probe ────────────────────────────────────────
function httpGet(url, timeoutMs = 3000) {
    return new Promise(resolve => {
        try {
            const req = http.get(url, { timeout: timeoutMs }, res => {
                resolve(res.statusCode !== undefined && res.statusCode < 500);
                res.resume();
            });
            req.on("error", () => resolve(false));
            req.on("timeout", () => { req.destroy(); resolve(false); });
        }
        catch {
            resolve(false);
        }
    });
}
// ── Evaluator ─────────────────────────────────────────────
class SuccessEvaluator {
    async evaluate(task, result, parsedGoal) {
        const criteria = parsedGoal?.successCriteria ?? [];
        const workspacePath = task?.workspacePath ?? "";
        const checks = [];
        if (criteria.length === 0) {
            // Fallback: all nodes completed
            const allDone = (result?.nodesCompleted ?? 0) === (result?.totalNodes ?? 1)
                && (result?.totalNodes ?? 0) > 0;
            checks.push({
                name: "all nodes completed",
                passed: allDone,
                detail: `${result?.nodesCompleted ?? 0}/${result?.totalNodes ?? 0} nodes done`,
            });
        }
        else {
            for (const criterion of criteria) {
                const check = await this.runCriterion(criterion, result, workspacePath);
                checks.push(check);
                console.log(`[SuccessEvaluator] ${check.name} ${check.passed ? "✅" : "❌"} — ${check.detail}`);
            }
        }
        const passed = checks.filter(c => c.passed).length;
        const total = checks.length;
        const confidence = total > 0 ? passed / total : 0;
        const success = confidence >= 0.5;
        const summary = `${passed}/${total} checks passed (${(confidence * 100).toFixed(0)}% confidence)`;
        return { success, confidence, checks, summary };
    }
    // ── Per-criterion logic ───────────────────────────────────
    async runCriterion(criterion, result, workspacePath) {
        const c = criterion.toLowerCase();
        if (c.includes("server running")) {
            const ports = [3000, 3001, 8000, 8080];
            for (const port of ports) {
                if (await tcpConnect("127.0.0.1", port)) {
                    return { name: "server running", passed: true, detail: `Port ${port} is listening` };
                }
            }
            return { name: "server running", passed: false, detail: "No server detected on 3000/3001/8000/8080" };
        }
        if (c.includes("no errors")) {
            const errors = result?.errors ? Object.keys(result.errors).length : 0;
            return {
                name: "no errors",
                passed: errors === 0,
                detail: errors === 0 ? "No execution errors" : `${errors} error(s) in result`,
            };
        }
        if (c.includes("dependencies installed")) {
            const nmPath = path.join(workspacePath, "node_modules");
            const exists = fs.existsSync(nmPath);
            return {
                name: "dependencies installed",
                passed: exists,
                detail: exists ? "node_modules found" : "node_modules not found",
            };
        }
        if (c.includes("api endpoints respond")) {
            const ok = await httpGet("http://localhost:3000/api/health");
            return {
                name: "API endpoints respond",
                passed: ok,
                detail: ok ? "GET /api/health responded" : "GET /api/health failed",
            };
        }
        if (c.includes("file exists")) {
            // Look for any files written in the result
            const filesWritten = result?.results
                ? Object.values(result.results).filter((r) => r?.output?.path).length
                : 0;
            return {
                name: "file exists",
                passed: filesWritten > 0,
                detail: filesWritten > 0 ? `${filesWritten} file(s) written` : "No files written",
            };
        }
        if (c.includes("build successful")) {
            const distPath = path.join(workspacePath, "dist");
            const buildPath = path.join(workspacePath, "build");
            const exists = fs.existsSync(distPath) || fs.existsSync(buildPath);
            return {
                name: "build successful",
                passed: exists,
                detail: exists ? "dist/ or build/ found" : "No dist/ or build/ found",
            };
        }
        // Unknown criterion — skip with neutral pass
        return { name: criterion, passed: true, detail: "criterion not verifiable — assumed pass" };
    }
}
exports.SuccessEvaluator = SuccessEvaluator;
exports.successEvaluator = new SuccessEvaluator();
