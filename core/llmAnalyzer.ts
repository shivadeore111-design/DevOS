// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// core/llmAnalyzer.ts

import axios from "axios";

interface LLMResponse {
  category: string;
  recommendedFix: string;
  confidence: number;
}

export async function analyzeErrorWithLLM(
  errorLog: string
): Promise<LLMResponse | null> {
  try {
    const prompt = `
You are an autonomous DevOps analyzer.

Analyze the following error log.

Respond ONLY in valid JSON format:

{
  "category": "string",
  "recommendedFix": "retry | npm_install | fresh_git_reset | vercel_redeploy | clear_node_modules | none",
  "confidence": number_between_0_and_1
}

Error:
${errorLog}
`;

    const response = await axios.post(
      "http://localhost:11434/api/generate",
      {
        model: "qwen2.5:7b",
        prompt: prompt,
        stream: false
      }
    );

    const text = response.data.response;

    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    const jsonString = text.substring(jsonStart, jsonEnd + 1);

    return JSON.parse(jsonString);
  } catch (err) {
    console.log("⚠ LLM analysis failed.");
    return null;
  }
}