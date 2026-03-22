// ============================================================
// DevOS — llm/local.ts — Local LLM shim
// Thin wrapper delegating to the main Ollama router.
// ============================================================

import { llmCall } from "./router";

/**
 * Query the local LLM with a plain prompt string.
 * Returns the text content of the response.
 */
export async function queryLocalLLM(prompt: string): Promise<string> {
  const { content } = await llmCall(prompt);
  return content;
}
