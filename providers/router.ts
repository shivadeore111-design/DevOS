// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import { askGrok } from "./grok";
import { askGemini } from "./gemini";
import { askOpenRouter } from "./openrouter";
import { askNvidia } from "./nvidia";
import { askOllama } from "./ollama";

const PRIORITY = (process.env.PROVIDER_PRIORITY || "grok,gemini,openrouter,nvidia,ollama")
  .split(",")
  .map(p => p.trim());

export async function askLLM(prompt: string): Promise<string> {

  for (const provider of PRIORITY) {

    try {

      if (provider === "grok") {
        const result = await askGrok(prompt);
        console.log("✅ Used provider: Grok");
        return result;
      }

      if (provider === "gemini") {
        const result = await askGemini(prompt);
        console.log("✅ Used provider: Gemini");
        return result;
      }

      if (provider === "openrouter") {
        const result = await askOpenRouter(prompt);
        console.log("✅ Used provider: OpenRouter");
        return result;
      }

      if (provider === "nvidia") {
        const result = await askNvidia(prompt);
        console.log("✅ Used provider: NVIDIA");
        return result;
      }

      if (provider === "ollama") {
        const result = await askOllama(prompt);
        console.log("✅ Used provider: Ollama");
        return result;
      }

    } catch (err) {
      console.log(`❌ ${provider} failed`);
      continue;
    }
  }

  throw new Error("All providers failed.");
}