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
exports.verifierAgent = exports.VerifierAgent = void 0;
// agents/verifier.ts — Adversarial implementation verifier.
// Job: TRY TO BREAK things, not confirm they work.
// Read-only tool access. Every check MUST run a real command.
const bgLLM_1 = require("../core/bgLLM");
const auditTrail_1 = require("../core/auditTrail");
// ── Verifier system prompt ────────────────────────────────────
const VERIFIER_SYSTEM = `You are DevOS's adversarial verifier. Your ONE job is to TRY TO BREAK implementations.

TWO FAILURE MODES TO ACTIVELY FIGHT:
1. Reading code and writing PASS without running anything
2. Being seduced by the first 80% and missing that half the things don't work

HARD RULES:
- CANNOT modify any files — strictly read-only (ls, find, grep, cat, stat only for bash)
- EVERY check MUST run a command and show actual output
- MUST include at least one adversarial test: boundary values, concurrency, idempotency, missing resources
- "The code looks correct" is NOT verification — run it

REQUIRED OUTPUT FORMAT for every check:
### Check: [what you're verifying]
**Command run:** [exact command]
**Output:** [actual output, verbatim — NOT paraphrased]
**Result: PASS** or **FAIL** (expected: X, actual: Y)

End your response with exactly one of:
VERDICT: PASS
VERDICT: FAIL
VERDICT: PARTIAL`;
// ── Run allowed read-only commands ────────────────────────────
// The verifier is restricted to read-only operations.
async function runReadOnlyCheck(command) {
    // Validate command is read-only
    const ALLOWED_PREFIXES = ['ls ', 'find ', 'grep ', 'cat ', 'stat ', 'ls\n', 'find\n', 'wc ', 'head ', 'tail ', 'echo ', 'type '];
    const trimmed = command.trim().toLowerCase();
    const isAllowed = ALLOWED_PREFIXES.some(p => trimmed.startsWith(p)) ||
        trimmed === 'ls' || trimmed === 'pwd';
    if (!isAllowed) {
        return `[BLOCKED] Read-only restriction: command "${command}" is not allowed in verification mode`;
    }
    // Execute the command
    try {
        const { exec } = await Promise.resolve().then(() => __importStar(require('child_process')));
        const { promisify } = await Promise.resolve().then(() => __importStar(require('util')));
        const execAsync = promisify(exec);
        const { stdout, stderr } = await execAsync(command, {
            timeout: 10000,
            cwd: process.cwd(),
        });
        return stdout || stderr || '(no output)';
    }
    catch (e) {
        return `Error: ${e.message || e.stderr || 'unknown'}`;
    }
}
// ── Extract checks from verifier output ───────────────────────
function extractVerdict(output) {
    const m = output.match(/VERDICT:\s*(PASS|FAIL|PARTIAL)/i);
    if (!m)
        return 'PARTIAL';
    return m[1].toUpperCase();
}
function extractChecks(output) {
    const checks = [];
    const sections = output.split(/### Check:/g).slice(1);
    for (const section of sections) {
        const whatM = section.match(/^(.+)\n/);
        const cmdM = section.match(/\*\*Command run:\*\*\s*([^\n]+)/);
        const outM = section.match(/\*\*Output:\*\*\s*([\s\S]+?)(?=\*\*Result:|\n###|VERDICT:|$)/);
        const passM = section.match(/\*\*Result:\s*(PASS|FAIL)/);
        if (whatM) {
            checks.push({
                what: whatM[1].trim(),
                command: cmdM ? cmdM[1].trim() : '(none)',
                output: outM ? outM[1].trim() : '(no output recorded)',
                passed: passM ? passM[1] === 'PASS' : false,
            });
        }
    }
    return checks;
}
// ── Verifier class ────────────────────────────────────────────
class VerifierAgent {
    async verify(task, taskOutput, filesChanged, traceId, retryN = 0) {
        const prompt = `${VERIFIER_SYSTEM}

TASK THAT WAS IMPLEMENTED:
${task}

AGENT OUTPUT / RESULT:
${taskOutput.slice(0, 2000)}

FILES CHANGED:
${filesChanged.join('\n') || '(none listed)'}

Now verify this implementation. Run real commands. Find what's broken.
Remember: check boundary conditions, missing resources, error states.
Include at least one adversarial test.`;
        const raw = await (0, bgLLM_1.callBgLLM)(prompt, `verify_${traceId}_${retryN}`);
        const verdict = extractVerdict(raw);
        const checks = extractChecks(raw);
        const result = {
            traceId,
            verdict,
            checks,
            summary: raw.slice(0, 500),
            retryN,
        };
        // Log to AuditTrail with same traceId as original task
        try {
            auditTrail_1.auditTrail.record({
                action: 'system',
                tool: 'verification',
                input: JSON.stringify({ task: task.slice(0, 200), retryN }),
                output: JSON.stringify({ verdict, checksTotal: checks.length, passed: checks.filter(c => c.passed).length }),
                durationMs: 0,
                success: verdict !== 'FAIL',
                traceId,
            });
        }
        catch { }
        console.log(`[Verifier] VERDICT: ${verdict} (${checks.length} checks, retry ${retryN})`);
        return result;
    }
    formatReport(result) {
        const lines = [];
        for (const check of result.checks) {
            lines.push(`### Check: ${check.what}`);
            lines.push(`**Command run:** ${check.command}`);
            lines.push(`**Output:** ${check.output}`);
            lines.push(`**Result: ${check.passed ? 'PASS' : 'FAIL'}**`);
            lines.push('');
        }
        lines.push(`VERDICT: ${result.verdict}`);
        return lines.join('\n');
    }
}
exports.VerifierAgent = VerifierAgent;
// ── Singleton ──────────────────────────────────────────────────
exports.verifierAgent = new VerifierAgent();
