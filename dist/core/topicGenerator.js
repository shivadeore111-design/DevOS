"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateNextTopic = generateNextTopic;
const localBrain_1 = require("../llm/localBrain");
const knowledgeAnalyzer_1 = require("./knowledgeAnalyzer");
const memoryEngine_1 = require("../memory/memoryEngine");
const capabilityRegistry_1 = require("./capabilityRegistry");
async function generateNextTopic() {
    const memory = (0, memoryEngine_1.loadMemory)();
    const analysis = (0, knowledgeAnalyzer_1.analyzeKnowledge)();
    const capabilityNames = await (0, capabilityRegistry_1.getCapabilityNames)();
    // For now, treat anything NOT in this list as missing
    const knownCapabilities = capabilityNames.map(c => c.toLowerCase());
    const potentialCapabilities = [
        "pdf.ingestion",
        "vector.retrieval",
        "code.execution",
        "multi.source.analysis",
        "skill.auto.generation"
    ];
    const missingCaps = potentialCapabilities.filter(cap => !knownCapabilities.includes(cap.toLowerCase()));
    const lastImprovement = memory.improvements.slice(-1)[0];
    const strategicDirection = lastImprovement?.data?.strategicDirection ||
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
        const response = await (0, localBrain_1.localLLM)(prompt);
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
    const response = await (0, localBrain_1.localLLM)(prompt);
    return response.split("\n")[0].replace(/["']/g, "").trim();
}
