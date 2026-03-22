// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import axios from "axios";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = "openai/gpt-4o-mini";

export async function askOpenRouter(prompt: string): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: MODEL,
        messages: [{ role: "user", content: prompt }]
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data.choices[0].message.content;

  } catch (err: any) {
    console.error("🔥 OpenRouter Error:");
    console.error(err?.response?.data || err.message);
    throw err;
  }
}