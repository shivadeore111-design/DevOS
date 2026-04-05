"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.executor = void 0;
const screenAgent_1 = require("../integrations/computerUse/screenAgent");
const apiRegistry_1 = require("../integrations/computerUse/apiRegistry");
const faultEngine_1 = require("./faultEngine");
const truthCheck_1 = require("./truthCheck");
const memoryLayers_1 = require("../memory/memoryLayers");
const toolRegistry_1 = require("./toolRegistry");
// ── Executor ──────────────────────────────────────────────────
class Executor {
    constructor() {
        /** Exposed as a getter so the API route can read live progress. */
        this.currentSession = null;
    }
    // ── Session management ────────────────────────────────────────
    startSession(goal) {
        const sessionId = `exec_${Date.now()}`;
        this.currentSession = {
            sessionId,
            goal,
            startedAt: new Date().toISOString(),
            results: [],
            totalDurationMs: 0,
            successRate: 0,
        };
        return sessionId;
    }
    endSession() {
        if (!this.currentSession)
            return null;
        const s = this.currentSession;
        s.totalDurationMs = s.results.reduce((acc, r) => acc + r.durationMs, 0);
        const successes = s.results.filter(r => r.status === 'success' || r.status === 'fallback' || r.status === 'retried').length;
        s.successRate = s.results.length ? successes / s.results.length : 0;
        this.currentSession = null;
        return s;
    }
    // ── Main execute ──────────────────────────────────────────────
    /**
     * Execute a single ComputerUseAction with:
     *   - configurable retry loop with exponential backoff
     *   - timeout wrapper per attempt
     *   - TruthCheck verification on success
     *   - FaultEngine error classification on failure
     *   - fallback action when all retries exhausted
     */
    async execute(action) {
        const start = Date.now();
        let retriesUsed = 0;
        let usedFallback = false;
        let verifiedByTruthCheck = false;
        const maxRetries = action.retries ?? 2;
        const timeoutMs = action.timeoutMs ?? 15000;
        // ── Retry loop ────────────────────────────────────────────
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                // Per-attempt timeout
                const data = await Promise.race([
                    this.route(action),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
                ]);
                // TruthCheck verification
                verifiedByTruthCheck = await truthCheck_1.truthCheck.verifyAction(action.type, { actionId: action.id });
                const result = {
                    actionId: action.id,
                    status: retriesUsed > 0 ? 'retried' : 'success',
                    data,
                    durationMs: Date.now() - start,
                    retriesUsed,
                    usedFallback,
                    verifiedByTruthCheck,
                };
                await this.audit(action, result);
                this.currentSession?.results.push(result);
                return result;
            }
            catch (err) {
                const classified = this.classifyError(err);
                // Retry if retryable and attempts remain
                if (classified.retryable && attempt < maxRetries) {
                    retriesUsed++;
                    console.warn(`[Executor] Retry ${retriesUsed}/${maxRetries} for action ${action.id} — ${classified.message}`);
                    await new Promise(r => setTimeout(r, 800 * retriesUsed)); // linear backoff
                    continue;
                }
                // Attempt fallback action
                if (action.fallback && !usedFallback) {
                    usedFallback = true;
                    console.warn(`[Executor] Running fallback for action ${action.id}`);
                    try {
                        const fallbackData = await this.route(action.fallback);
                        const result = {
                            actionId: action.id,
                            status: 'fallback',
                            data: fallbackData,
                            durationMs: Date.now() - start,
                            retriesUsed,
                            usedFallback: true,
                            verifiedByTruthCheck: false,
                        };
                        await this.audit(action, result);
                        this.currentSession?.results.push(result);
                        return result;
                    }
                    catch {
                        // Fallback also failed — fall through to fail result
                    }
                }
                // All attempts and fallback exhausted
                const result = {
                    actionId: action.id,
                    status: 'failed',
                    error: classified,
                    durationMs: Date.now() - start,
                    retriesUsed,
                    usedFallback,
                    verifiedByTruthCheck,
                };
                await this.audit(action, result);
                this.currentSession?.results.push(result);
                return result;
            }
        }
        // Should never be reached
        return {
            actionId: action.id,
            status: 'skipped',
            durationMs: Date.now() - start,
            retriesUsed: 0,
            usedFallback: false,
            verifiedByTruthCheck: false,
        };
    }
    // ── Smart routing ─────────────────────────────────────────────
    async route(action) {
        switch (action.type) {
            case 'api_call': {
                const a = action;
                const { result } = await apiRegistry_1.apiRegistry.execute(a.service, {
                    endpoint: a.endpoint,
                    method: a.method,
                    payload: a.payload,
                    headers: a.headers,
                });
                return result;
            }
            case 'click':
            case 'type':
            case 'scroll':
            case 'keypress':
            case 'screenshot':
                return screenAgent_1.screenAgent.execute(action);
            default: {
                // Real tool execution via centralized toolRegistry
                const a = action;
                const payload = a.payload || { command: a.command || a.description };
                const result = await (0, toolRegistry_1.executeTool)(a.type, payload);
                if (!result.success)
                    throw new Error(result.error || 'Tool execution failed');
                return result.output;
            }
        }
    }
    // ── Error classification ──────────────────────────────────────
    /**
     * Map a raw error to a typed ExecutorError.
     * Uses FaultEngine for the repair suggestion, then performs pattern
     * matching on the message to determine ExecutorErrorType.
     */
    classifyError(err) {
        const msg = err?.message ?? String(err);
        // FaultEngine for repair suggestion (sync call)
        let repairSuggestion;
        try {
            const fault = faultEngine_1.faultEngine.classify(msg);
            repairSuggestion = fault.repairCommand ?? fault.manualFix;
        }
        catch { /* non-fatal */ }
        let type = 'UNKNOWN';
        let retryable = true;
        if (msg.includes('timeout')) {
            type = 'TIMEOUT';
            retryable = true;
        }
        else if (/API|fetch|ECONNREFUSED|ENOTFOUND/i.test(msg)) {
            type = 'API_ERROR';
            retryable = true;
        }
        else if (/selector|element|visible/i.test(msg)) {
            type = 'UI_ERROR';
            retryable = true;
        }
        else if (/screen|mouse|keyboard/i.test(msg)) {
            type = 'SCREEN_ERROR';
            retryable = true;
        }
        else if (/Rejected by|CommandGate/i.test(msg)) {
            type = 'REJECTED_BY_USER';
            retryable = false;
        }
        else if (/confidence/i.test(msg)) {
            type = 'CONFIDENCE_TOO_LOW';
            retryable = false;
        }
        else if (/Unknown action/i.test(msg)) {
            type = 'VALIDATION_ERROR';
            retryable = false;
        }
        return { type, message: msg, retryable, repairSuggestion };
    }
    // ── Audit ─────────────────────────────────────────────────────
    async audit(action, result) {
        const entry = `[${new Date().toISOString()}] ${action.type} → ${result.status}` +
            ` (${result.durationMs}ms, retries:${result.retriesUsed})` +
            (result.error ? ` | ERROR: ${result.error.message}` : '');
        memoryLayers_1.memoryLayers.write(entry, ['computer_use', 'audit', result.status]);
    }
}
exports.executor = new Executor();
