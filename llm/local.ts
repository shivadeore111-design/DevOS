// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import axios from "axios";

const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL = process.env.DEVOS_MODEL || "qwen2.5:7b-instruct";

export async function queryLocalLLM(prompt: string): Promise<string> {
  const response = await axios.post(OLLAMA_URL, {
    model: MODEL,
    prompt,
    stream: false
  });

  return response.data.response;
}