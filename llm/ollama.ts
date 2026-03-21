// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
import axios from "axios";
import { kvCacheMetrics } from "../core/kvCacheMetrics";

const BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const MODEL    = process.env.OLLAMA_MODEL    ?? "llama3";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTimeout(model: string = MODEL): number {
  const m = model.toLowerCase();
  if (m.includes("70b"))                       return 600000;
  if (m.includes("14b") || m.includes("13b"))  return 300000;
  if (m.includes("12b"))                       return 240000;
  if (m.includes("7b")  || m.includes("8b"))   return 180000;
  return 120000;
}

function getNumPredict(_model: string = MODEL): number {
  return 300  // Fast chat responses — long outputs (code gen) override this per-call
}

/**
 * Calls Ollama with retry logic and /api/generate fallback.
 * Accepts optional modelOverride to use a specific model per call.
 * Never throws. Returns empty string on total failure.
 */
export async function callOllama(
  prompt: string,
  systemPrompt?: string,
  modelOverride?: string
): Promise<string> {
  const activeModel = modelOverride ?? MODEL;
  const timeout     = getTimeout(activeModel);
  const numPredict  = getNumPredict(activeModel);
  const maxRetries  = 2;

  // ── KV-cache tracking ──────────────────────────────────
  // Record the system prompt hash on every call. Identical hashes = cache hit.
  kvCacheMetrics.record(systemPrompt ?? "")

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const finalPrompt = attempt === 0
      ? prompt
      : prompt + "\n\nCRITICAL: Return ONLY valid JSON. No text before or after. No markdown. No code fences.";

    try {
      const messages: { role: string; content: string }[] = [];
      if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
      messages.push({ role: "user", content: finalPrompt });

      const res = await axios.post(
        `${BASE_URL}/api/chat`,
        {
          model:   activeModel,
          messages,
          stream:  false,
          options: { temperature: 0.2, num_predict: numPredict },
        },
        { timeout }
      );
      const content: string = res.data?.message?.content ?? "";
      if (content.trim().length > 0) return content;
      throw new Error("Empty response");

    } catch (chatErr: any) {
      if (attempt === 0) {
        try {
          console.warn(`[Ollama] /api/chat failed, trying /api/generate: ${chatErr.message}`);
          const full = systemPrompt ? `${systemPrompt}\n\n${finalPrompt}` : finalPrompt;
          const res  = await axios.post(
            `${BASE_URL}/api/generate`,
            {
              model:   activeModel,
              prompt:  full,
              stream:  false,
              options: { temperature: 0.2, num_predict: numPredict },
            },
            { timeout }
          );
          const content: string = res.data?.response ?? "";
          if (content.trim().length > 0) return content;
        } catch { /* fall through */ }
      }

      if (attempt < maxRetries) {
        console.log(`[Ollama] Retry attempt ${attempt + 1}/${maxRetries}...`);
        await sleep(1000);
      } else {
        console.error("[Ollama] All retries failed. Returning empty string.");
        return "";
      }
    }
  }
  return "";
}

export async function listOllamaModels(): Promise<string[]> {
  try {
    const res = await axios.get(`${BASE_URL}/api/tags`, { timeout: 5000 });
    return res.data.models?.map((m: any) => m.name) ?? [];
  } catch { return []; }
}

export async function checkOllamaHealth(): Promise<boolean> {
  try {
    await axios.get(`${BASE_URL}/`, { timeout: 3000 });
    return true;
  } catch { return false; }
}
