// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import axios from "axios";

const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL = process.env.DEVOS_MODEL || "qwen2.5:7b-instruct";

export async function askOllama(prompt: string): Promise<string> {
  try {
    const response = await axios.post(OLLAMA_URL, {
      model: MODEL,
      prompt,
      stream: false,
    });

    if (!response.data || !response.data.response) {
      throw new Error("Invalid response from Ollama.");
    }

    return response.data.response;
  } catch (error: any) {
    console.error("🔥 Ollama Error:");
    if (error.response?.data) {
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }
    throw error;
  }
}