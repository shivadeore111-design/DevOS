// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import axios from "axios";

export async function askGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ]
      },
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    return response.data.candidates[0].content.parts[0].text;
  } catch (err: any) {
    console.error("🔥 Gemini Real Error:");
    console.error(err.response?.data || err.message);
    throw err;
  }
}