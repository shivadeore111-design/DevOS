// ============================================================
// DevOS — llm/localBrain.ts — Local Brain shim
// Thin wrapper delegating to the main Ollama router.
// Exported as a callable function for backward-compat.
// ============================================================

import { llmCall } from "./router";

/**
 * Call the local LLM with a prompt.
 * Modules that do `localLLM(prompt)` use this directly.
 */
export async function localLLM(prompt: string, system?: string): Promise<string> {
  const { content } = await llmCall(prompt, system);
  return content;
}
