"use strict";
// ============================================================
// DevOS — llm/localBrain.ts — Local Brain shim
// Thin wrapper delegating to the main Ollama router.
// Exported as a callable function for backward-compat.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.localLLM = localLLM;
const router_1 = require("./router");
/**
 * Call the local LLM with a prompt.
 * Modules that do `localLLM(prompt)` use this directly.
 */
async function localLLM(prompt, system) {
    const { content } = await (0, router_1.llmCall)(prompt, system);
    return content;
}
