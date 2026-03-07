// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import { localLLM } from "../llm/localBrain";
import { appendMemory } from "../memory/memoryEngine";
import { addKnowledge } from "../memory/knowledgeEngine";

function extractJSON(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found");
  return JSON.parse(match[0]);
}

async function evaluateResearch(topic: string, results: any) {
  const prompt = `
Evaluate this research topic.

Topic:
${topic}

Search Results:
${JSON.stringify(results.searchResults)}

Page Content:
${results.pageContent}

Return ONLY valid JSON:

{
  "usefulnessScore": number (0-10),
  "confidenceScore": number (0-10),
  "strategicDirection": "next direction"
}
`;

  const raw = await localLLM(prompt);
  return extractJSON(raw);
}

async function extractKnowledge(topic: string, results: any) {
  const prompt = `
Extract structured knowledge.

Topic:
${topic}

Search Results:
${JSON.stringify(results.searchResults)}

Page Content:
${results.pageContent}

Return ONLY valid JSON:

{
  "summary": "concise summary",
  "coreConcepts": [],
  "toolsMentioned": [],
  "domains": [],
  "opportunities": [],
  "risks": [],
  "implementationIdeas": []
}
`;

  const raw = await localLLM(prompt);
  return extractJSON(raw);
}

export async function reflectOnResearch(topic: string, results: any) {
  try {
    const evaluation = await evaluateResearch(topic, results);

    appendMemory("improvements", {
      topic,
      usefulnessScore: evaluation.usefulnessScore,
      confidenceScore: evaluation.confidenceScore,
      strategicDirection: evaluation.strategicDirection
    });

    const knowledge = await extractKnowledge(topic, results);

    addKnowledge({
      topic,
      summary: knowledge.summary,
      coreConcepts: knowledge.coreConcepts,
      toolsMentioned: knowledge.toolsMentioned,
      domains: knowledge.domains,
      opportunities: knowledge.opportunities,
      risks: knowledge.risks,
      implementationIdeas: knowledge.implementationIdeas,
      confidenceScore: evaluation.confidenceScore
    });

    return {
      usefulnessScore: evaluation.usefulnessScore,
      confidenceScore: evaluation.confidenceScore,
      strategicDirection: evaluation.strategicDirection
    };

  } catch (err) {
    appendMemory("improvements", {
      topic,
      usefulnessScore: 5,
      confidenceScore: 5,
      strategicDirection: "Refine research query"
    });

    return {
      usefulnessScore: 5,
      confidenceScore: 5,
      strategicDirection: "Refine research query"
    };
  }
}