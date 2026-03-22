// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import { localLLM } from "../llm/localBrain";
import { analyzeKnowledge } from "./knowledgeAnalyzer";
import { loadMemory } from "../memory/memoryEngine";
import { getCapabilityNames } from "./capabilityRegistry";

export async function generateNextTopic(): Promise<string> {
  const memory = loadMemory();
  const analysis = analyzeKnowledge();

  const capabilityNames = await getCapabilityNames();

  // For now, treat anything NOT in this list as missing
  const knownCapabilities = capabilityNames.map(c => c.toLowerCase());

  const potentialCapabilities = [
    "pdf.ingestion",
    "vector.retrieval",
    "code.execution",
    "multi.source.analysis",
    "skill.auto.generation"
  ];

  const missingCaps = potentialCapabilities.filter(
    cap => !knownCapabilities.includes(cap.toLowerCase())
  );

  const lastImprovement = memory.improvements.slice(-1)[0];
  const strategicDirection =
    lastImprovement?.data?.strategicDirection ||
    "Expand AI system capabilities";

  // --- Capability Expansion Mode ---
  if (missingCaps.length > 2) {
    const prioritized = missingCaps.slice(0, 3).join(", ");

    const prompt = `
You are an autonomous system optimizing for capability expansion.

Missing capabilities:
${prioritized}

Generate ONE research topic focused on enabling or implementing one of these capabilities.

Return ONLY the topic title.
`;

    const response = await localLLM(prompt);
    return response.split("\n")[0].replace(/["']/g, "").trim();
  }

  // --- Knowledge Balancing Mode ---
  const prompt = `
You are a strategic autonomous planner.

Dominant concepts:
${analysis.dominantConcepts.join(", ")}

Underexplored domains:
${analysis.underexploredDomains.join(", ")}

Recurring risks:
${analysis.recurringRisks.join(", ")}

High opportunity areas:
${analysis.highOpportunityAreas.join(", ")}

Strategic direction:
${strategicDirection}

Generate ONE research topic that:
- Expands capability
- Balances knowledge gaps
- Avoids repeating dominant themes

Return ONLY the topic title.
`;

  const response = await localLLM(prompt);

  return response.split("\n")[0].replace(/["']/g, "").trim();
}