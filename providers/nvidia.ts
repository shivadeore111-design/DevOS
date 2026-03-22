// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import axios from "axios";

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const MODEL = "meta/llama3-8b-instruct";

export async function askNvidia(prompt: string): Promise<string> {
  if (!NVIDIA_API_KEY) {
    throw new Error("Missing NVIDIA_API_KEY");
  }

  try {
    const response = await axios.post(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      {
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3
      },
      {
        headers: {
          Authorization: `Bearer ${NVIDIA_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data.choices[0].message.content;

  } catch (err: any) {
    console.error("🔥 NVIDIA Error:");
    console.error(err?.response?.data || err.message);
    throw err;
  }
}