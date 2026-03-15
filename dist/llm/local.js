"use strict";
// ============================================================
// DevOS — llm/local.ts — Local LLM shim
// Thin wrapper delegating to the main Ollama router.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryLocalLLM = queryLocalLLM;
const router_1 = require("./router");
/**
 * Query the local LLM with a plain prompt string.
 * Returns the text content of the response.
 */
async function queryLocalLLM(prompt) {
    const { content } = await (0, router_1.llmCall)(prompt);
    return content;
}
