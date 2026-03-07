// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import axios from "axios";

export async function localLLM(prompt: string): Promise<string> {
  const response = await axios.post("http://localhost:11434/api/generate", {
    model: "llama3",
    prompt,
    stream: false,
    options: {
      temperature: 0.2
    }
  });

  return response.data.response.trim();
}