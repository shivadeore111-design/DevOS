// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
import { callOllama, checkOllamaHealth, listOllamaModels } from "./ollama";
import { resolveModel } from "./modelRouter";
import { coreBoot }    from "../core/coreBoot";

export interface LLMResponse {
  content:         string;
  provider:        "ollama";
  model:           string;
  tokensEstimate?: number;
}

const AUTO_MODEL = process.env.DEVOS_AUTO_MODEL !== "false";

let _healthChecked = false;

export async function ensureOllamaReady(): Promise<void> {
  if (_healthChecked) return;

  const alive = await checkOllamaHealth();
  if (!alive) {
    throw new Error(
      "[LLMRouter] Ollama is not running.\n" +
      "  Start it with: ollama serve\n" +
      "  Then pull a model: ollama pull llama3"
    );
  }

  const model    = process.env.OLLAMA_MODEL ?? "llama3";
  const models   = await listOllamaModels();
  const hasModel = models.some((m: string) => m.startsWith(model));

  if (!hasModel) {
    console.warn(`[LLMRouter] Model "${model}" not found. Run: ollama pull ${model}`);
  } else {
    console.log(`[LLMRouter] ✅ Ollama ready — model: ${model}`);
  }

  console.log(`[LLMRouter] Auto model routing: ${AUTO_MODEL ? "ON" : "OFF"}`);
  _healthChecked = true;
}

function extractJSON<T>(text: string): T | null {
  try {
    const match = text.match(/\{[\s\S]*\}/) || text.match(/\[[\s\S]*\]/);
    if (!match) return null;
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

export async function llmCall(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
  await ensureOllamaReady();

  // Always use the static coreBoot prompt when caller doesn't supply one.
  // This keeps system-prompt bytes identical across calls → Ollama KV-cache hit.
  const resolvedSystem = systemPrompt ?? coreBoot.getSystemPrompt();

  const model = AUTO_MODEL
    ? await resolveModel(prompt, resolvedSystem)
    : (process.env.OLLAMA_MODEL ?? "llama3");

  console.log(`[LLMRouter] Calling Ollama (${model})...`);
  const content = await callOllama(prompt, resolvedSystem, model);

  return {
    content,
    provider: "ollama",
    model,
    tokensEstimate: Math.ceil(content.length / 4),
  };
}

export async function llmCallJSON<T>(prompt: string, systemPrompt: string, fallback: T): Promise<T> {
  try {
    await ensureOllamaReady();

    const resolvedSystem = systemPrompt ?? coreBoot.getSystemPrompt();

    const model = AUTO_MODEL
      ? await resolveModel(prompt, resolvedSystem)
      : (process.env.OLLAMA_MODEL ?? "llama3");

    console.log(`[LLMRouter] Calling Ollama JSON (${model})...`);

    const first  = await callOllama(prompt, resolvedSystem, model);
    const parsed = extractJSON<T>(first);
    if (parsed !== null) return parsed;

    console.log("[LLMRouter] JSON parse failed, retrying with stronger instruction...");
    const retryPrompt = prompt +
      "\n\nCRITICAL: Your response MUST be valid JSON only. No text. No markdown. Just raw JSON.";
    const second  = await callOllama(retryPrompt, resolvedSystem, model);
    const parsed2 = extractJSON<T>(second);
    if (parsed2 !== null) return parsed2;

    console.warn("[LLMRouter] Both attempts failed — using fallback");
    return fallback;
  } catch {
    return fallback;
  }
}
