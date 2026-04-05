"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.visionLoop = void 0;
// integrations/computerUse/visionLoop.ts
// Agentic vision-action loop: screenshot → vision LLM → action → verify → repeat.
//
// Model routing (DataGuard):
//   local  → llava:13b via Ollama REST (/api/chat with images[])
//   claude → Anthropic Messages API (ANTHROPIC_API_KEY required)
//   auto   → DataGuard decides per screenshot: sensitive → local, otherwise cloud
//
// CommandGate approval before session start + low-confidence (< 0.65) escalation.
const axios_1 = __importDefault(require("axios"));
const screenAgent_1 = require("./screenAgent");
const apiRegistry_1 = require("./apiRegistry");
const commandGate_1 = require("../../coordination/commandGate");
const memoryLayers_1 = require("../../memory/memoryLayers");
const dataGuard_1 = require("../../security/dataGuard");
const executor_1 = require("../../core/executor");
const memoryStrategy_1 = require("../../core/memoryStrategy");
// ── Constants ──────────────────────────────────────────────────
const OLLAMA_BASE = process.env.OLLAMA_HOST ?? 'http://localhost:11434';
const VISION_MODEL = process.env.DEVOS_VISION_MODEL ?? 'llava:13b';
// ── Vision API helpers ────────────────────────────────────────
/**
 * Call llava (or any vision-capable Ollama model) with a base64 image.
 */
async function callOllamaVision(prompt, imageB64) {
    const res = await axios_1.default.post(`${OLLAMA_BASE}/api/chat`, {
        model: VISION_MODEL,
        messages: [
            {
                role: 'user',
                content: prompt,
                images: [imageB64],
            },
        ],
        stream: false,
        options: { temperature: 0.2, num_predict: 512 },
    }, { timeout: 90000 });
    return res.data?.message?.content ?? '';
}
/**
 * Call Claude via Anthropic Messages API with a base64 PNG image.
 * Requires ANTHROPIC_API_KEY env var.
 */
async function callClaudeVision(prompt, imageB64) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey)
        throw new Error('[VisionLoop] ANTHROPIC_API_KEY not set — use visionModel: "local"');
    const res = await axios_1.default.post('https://api.anthropic.com/v1/messages', {
        model: process.env.DEVOS_CLAUDE_VISION_MODEL ?? 'claude-sonnet-4-20250514',
        max_tokens: 512,
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: 'image',
                        source: { type: 'base64', media_type: 'image/png', data: imageB64 },
                    },
                    { type: 'text', text: prompt },
                ],
            },
        ],
    }, {
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        },
        timeout: 30000,
    });
    return res.data?.content?.[0]?.text ?? '';
}
// ── VisionLoop ────────────────────────────────────────────────
class VisionLoop {
    constructor() {
        this.aborted = false;
    }
    // ── Run ──────────────────────────────────────────────────────
    async run(goal, options = {}) {
        const maxIterations = options.maxIterations ?? 20;
        const timeoutMs = options.timeoutMs ?? 120000;
        const actionsExecuted = [];
        const start = Date.now();
        this.aborted = false;
        // Memory lookup — replay known-good action sequence if available
        const knownActions = memoryStrategy_1.memoryStrategy.retrieveActions(goal);
        if (knownActions) {
            console.log(`[VisionLoop] Memory hit for goal: "${goal}" — replaying ${knownActions.length} known action(s)`);
            executor_1.executor.startSession(goal);
            for (const action of knownActions) {
                if (this.aborted)
                    break;
                await executor_1.executor.execute(action);
                actionsExecuted.push(action);
            }
            // Take a final screenshot to verify goal completion
            const verifyScreenshot = await screenAgent_1.screenAgent.takeScreenshot();
            const useLocalForVerify = options.visionModel === 'local'
                ? true
                : options.visionModel === 'claude'
                    ? false
                    : await dataGuard_1.dataGuard.isSensitive(verifyScreenshot.slice(0, 200));
            const done = await this.checkGoalComplete(goal, verifyScreenshot, useLocalForVerify);
            if (done) {
                await memoryStrategy_1.memoryStrategy.storeSuccess(goal, actionsExecuted);
                memoryLayers_1.memoryLayers.write(`ComputerUse success (memory replay): ${goal}`, ['computer_use', 'success']);
                const session = executor_1.executor.endSession();
                if (session)
                    memoryLayers_1.memoryLayers.write(JSON.stringify(session), ['computer_use', 'session']);
                return { success: true, iterations: 1, actionsExecuted };
            }
            // Memory replay didn't complete goal — fall through to full vision loop
            executor_1.executor.endSession();
            actionsExecuted.length = 0;
            this.aborted = false;
        }
        // CommandGate approval before taking control of the computer
        if (options.requireApproval !== false) {
            const approved = await commandGate_1.commandGate.requestApproval(`Computer control session: ${goal}`, 'VisionLoop will take screenshots and control mouse/keyboard');
            if (!approved) {
                executor_1.executor.endSession();
                await memoryStrategy_1.memoryStrategy.storeFailure(goal);
                return {
                    success: false,
                    iterations: 0,
                    actionsExecuted: [],
                    failureReason: 'Rejected by user via CommandGate',
                };
            }
        }
        executor_1.executor.startSession(goal);
        for (let i = 0; i < maxIterations; i++) {
            if (this.aborted)
                break;
            if (Date.now() - start > timeoutMs) {
                await memoryStrategy_1.memoryStrategy.storeFailure(goal);
                return { success: false, iterations: i, actionsExecuted, failureReason: 'Timeout' };
            }
            // 1. Take screenshot
            const screenshotB64 = await screenAgent_1.screenAgent.takeScreenshot();
            // 2. DataGuard: choose vision model
            let useLocal;
            if (options.visionModel === 'local') {
                useLocal = true;
            }
            else if (options.visionModel === 'claude') {
                useLocal = false;
            }
            else {
                // 'auto' — scan a prefix of the base64 for sensitive text (e.g. from OCR metadata)
                useLocal = await dataGuard_1.dataGuard.isSensitive(screenshotB64.slice(0, 200));
            }
            // 3. Vision LLM → next action (null = goal complete)
            const action = await this.callVisionLLM(goal, screenshotB64, useLocal, actionsExecuted);
            if (!action) {
                await memoryStrategy_1.memoryStrategy.storeSuccess(goal, actionsExecuted);
                memoryLayers_1.memoryLayers.write(`ComputerUse success: ${goal}`, ['computer_use', 'success']);
                const session = executor_1.executor.endSession();
                if (session)
                    memoryLayers_1.memoryLayers.write(JSON.stringify(session), ['computer_use', 'session']);
                return { success: true, iterations: i + 1, actionsExecuted };
            }
            // 4. Low-confidence escalation
            if (action.confidence < 0.65) {
                const approved = await commandGate_1.commandGate.requestApproval(`Low-confidence action: ${action.type} (${Math.round(action.confidence * 100)}%)`, action.description ?? 'No description');
                if (!approved)
                    continue;
            }
            // 5. API-first routing for api_call actions
            if (action.type === 'api_call') {
                const apiAction = action;
                const r = await apiRegistry_1.apiRegistry.execute(apiAction.service, {
                    endpoint: apiAction.endpoint,
                    method: apiAction.method,
                    payload: apiAction.payload,
                    headers: apiAction.headers,
                });
                actionsExecuted.push(action);
                if (r.usedAPI) {
                    await memoryStrategy_1.memoryStrategy.storeSuccess(goal, actionsExecuted);
                    memoryLayers_1.memoryLayers.write(`ComputerUse success: ${goal}`, ['computer_use', 'success']);
                    const session = executor_1.executor.endSession();
                    if (session)
                        memoryLayers_1.memoryLayers.write(JSON.stringify(session), ['computer_use', 'session']);
                    return { success: true, iterations: i + 1, actionsExecuted };
                }
                continue;
            }
            // 6. Execute via unified Executor (handles retry, fallback, TruthCheck)
            const result = await executor_1.executor.execute(action);
            actionsExecuted.push(action);
            if (result.status === 'failed' && action.fallback) {
                // Executor already tried the fallback internally; log the outcome
                console.warn(`[VisionLoop] Action ${action.id} and its fallback both failed`);
            }
            // 7. Goal-complete check on fresh screenshot
            const newScreenshot = await screenAgent_1.screenAgent.takeScreenshot();
            const done = await this.checkGoalComplete(goal, newScreenshot, useLocal);
            if (done) {
                await memoryStrategy_1.memoryStrategy.storeSuccess(goal, actionsExecuted);
                memoryLayers_1.memoryLayers.write(`ComputerUse success: ${goal}`, ['computer_use', 'success']);
                const session = executor_1.executor.endSession();
                if (session)
                    memoryLayers_1.memoryLayers.write(JSON.stringify(session), ['computer_use', 'session']);
                return { success: true, iterations: i + 1, actionsExecuted };
            }
        }
        await memoryStrategy_1.memoryStrategy.storeFailure(goal);
        const session = executor_1.executor.endSession();
        if (session)
            memoryLayers_1.memoryLayers.write(JSON.stringify(session), ['computer_use', 'session']);
        return {
            success: false,
            iterations: maxIterations,
            actionsExecuted,
            failureReason: this.aborted ? 'Aborted by user' : 'Max iterations reached',
        };
    }
    // ── Vision LLM call ──────────────────────────────────────────
    async callVisionLLM(goal, screenshotB64, useLocal, history) {
        const historyStr = history
            .slice(-5)
            .map(a => `${a.type}: ${a.description ?? ''}`)
            .join('\n');
        const prompt = `You are controlling a computer to achieve this goal: "${goal}"

Recent actions taken:
${historyStr || 'None yet'}

Look at the screenshot and decide the SINGLE next action to take.
If the goal is already complete, respond with: { "done": true }

Respond ONLY with valid JSON:
{
  "id": "action_<timestamp>",
  "type": "click|type|scroll|keypress|screenshot|api_call",
  "confidence": 0.0-1.0,
  "description": "what this action does"
}`;
        try {
            const raw = useLocal
                ? await callOllamaVision(prompt, screenshotB64)
                : await callClaudeVision(prompt, screenshotB64);
            return this.parseAction(raw);
        }
        catch (err) {
            console.warn(`[VisionLoop] LLM call failed (${useLocal ? 'local' : 'claude'}): ${err?.message}`);
            return null;
        }
    }
    // ── Goal-complete check ───────────────────────────────────────
    async checkGoalComplete(goal, screenshotB64, useLocal) {
        const prompt = `Is this goal complete based on the screenshot? Goal: "${goal}". ` +
            `Respond ONLY with JSON: {"complete": true} or {"complete": false}`;
        try {
            const raw = useLocal
                ? await callOllamaVision(prompt, screenshotB64)
                : await callClaudeVision(prompt, screenshotB64);
            const cleaned = raw.replace(/```json|```/g, '').trim();
            return JSON.parse(cleaned).complete === true;
        }
        catch {
            return false;
        }
    }
    // ── Parse LLM response → action ──────────────────────────────
    parseAction(raw) {
        try {
            const cleaned = raw.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(cleaned);
            if (parsed.done)
                return null;
            if (!parsed.id)
                parsed.id = `action_${Date.now()}`;
            if (typeof parsed.confidence !== 'number')
                parsed.confidence = 0.7;
            return parsed;
        }
        catch {
            return null;
        }
    }
    // ── Abort ─────────────────────────────────────────────────────
    abort() { this.aborted = true; }
}
exports.visionLoop = new VisionLoop();
