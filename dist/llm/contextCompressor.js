"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.compressContext = compressContext;
exports.compressDependencyOutputs = compressDependencyOutputs;
exports.scoreRelevance = scoreRelevance;
// ============================================================
// llm/contextCompressor.ts — Multi-agent context compression
//
// Problem: agent4 context = agent1+agent2+agent3 outputs
// On 7B models this becomes slow and inaccurate.
//
// Solution: Before passing prior outputs to the next agent,
// compress them down to only what's relevant to THAT agent's goal.
// ============================================================
const ollama_1 = require("./ollama");
const MAX_CONTEXT_CHARS = 1200; // ~300 tokens — safe for 7B models
// ── Compression ───────────────────────────────────────────────
/**
 * Compress a large context string to only the parts relevant to `targetGoal`.
 * Returns the compressed string. Never throws — falls back to truncation.
 */
async function compressContext(rawContext, targetGoal, maxChars = MAX_CONTEXT_CHARS) {
    // If already short enough, skip compression
    if (rawContext.length <= maxChars)
        return rawContext;
    const prompt = `You are a context filter. Extract ONLY the information relevant to this goal:
"${targetGoal}"

Context to filter:
${rawContext.slice(0, 4000)}

Rules:
- Keep only facts/decisions directly useful for the goal above
- Remove preamble, greetings, meta-commentary
- Return plain text, no headers, no bullets — just the essential content
- If nothing is relevant, return the single word: EMPTY`;
    try {
        const compressed = await (0, ollama_1.callOllama)(prompt, undefined);
        if (!compressed || compressed.trim().toUpperCase() === "EMPTY")
            return "";
        return compressed.trim().slice(0, maxChars);
    }
    catch {
        // Fallback: hard truncation
        return rawContext.slice(0, maxChars) + "\n[...truncated]";
    }
}
/**
 * Compress a map of dependency outputs (from agentCoordinator)
 * into a single context string for the target agent.
 *
 * Before:
 *   { researcher_output: "2000 chars", coder_output: "3000 chars" }
 * After:
 *   "200 chars of what the coder actually needs"
 */
async function compressDependencyOutputs(outputs, targetGoal) {
    if (Object.keys(outputs).length === 0)
        return "";
    const combined = Object.entries(outputs)
        .map(([k, v]) => `=== ${k} ===\n${v}`)
        .join("\n\n");
    return compressContext(combined, targetGoal);
}
/**
 * Score how relevant a context block is to a given goal.
 * Returns 0.0 → 1.0.
 * Used by CRAG to decide: memory is good enough, or trigger web search?
 */
async function scoreRelevance(context, goal) {
    if (!context || context.trim().length < 20)
        return 0;
    const prompt = `Rate how relevant this context is to answering the goal below.
Goal: "${goal}"
Context: "${context.slice(0, 1000)}"

Return ONLY a number between 0 and 10. No explanation. Just the number.`;
    try {
        const raw = await (0, ollama_1.callOllama)(prompt, undefined);
        const match = raw.match(/\d+(\.\d+)?/);
        if (!match)
            return 0.5;
        const score = parseFloat(match[0]);
        return Math.min(10, Math.max(0, score)) / 10;
    }
    catch {
        return 0.5; // assume mediocre relevance on failure
    }
}
