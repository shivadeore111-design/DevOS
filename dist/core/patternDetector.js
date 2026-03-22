"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.patternDetector = exports.PatternDetector = void 0;
const vectorMemory_1 = require("../memory/vectorMemory");
// ── Known micro-planner descriptions (used for embedding comparison) ──
const PLANNER_DESCRIPTIONS = {
    apiBuilder: "build a REST API server using Node.js and Express with routes, middleware and JSON responses",
    webAppBuilder: "build a web application frontend using React, Vue or Vite with UI components",
    nodeDebugger: "debug or fix a Node.js error, crash, bug or failing script",
    dockerDeployer: "deploy an application using Docker, containerize with Dockerfile, docker build and docker run",
    researchTopic: "research a topic, find information, analyze data, summarize findings from the web",
};
// ── Cosine similarity helper ───────────────────────────────────
function cosineSim(a, b) {
    if (a.length !== b.length || a.length === 0)
        return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
}
// ── Keyword fallback ───────────────────────────────────────────
function keywordMatch(g) {
    const raw = g.raw.toLowerCase();
    const hasNode = g.stack.includes("node") || g.stack.includes("express");
    const hasReact = g.stack.includes("react") || g.stack.includes("vue");
    const hasDocker = g.stack.includes("docker");
    if ((g.type === "build" && g.domain === "backend") || (g.type === "build" && hasNode)) {
        return { microPlanner: "apiBuilder", confidence: 0.92,
            reason: "keyword: build+backend/node/express" };
    }
    if (g.type === "build" && (g.domain === "frontend" || hasReact)) {
        return { microPlanner: "webAppBuilder", confidence: 0.90,
            reason: "keyword: build+frontend/react/vue" };
    }
    if (g.type === "debug" || /\b(fix|error|crash|bug|broken|fail)\b/.test(raw)) {
        return { microPlanner: "nodeDebugger", confidence: 0.88,
            reason: "keyword: debug/fix/error/crash" };
    }
    if (g.type === "deploy" || hasDocker) {
        return { microPlanner: "dockerDeployer", confidence: 0.90,
            reason: "keyword: deploy/docker" };
    }
    if (g.type === "research" || g.domain === "data" ||
        /\b(research|analyze|find|summarize|investigate)\b/.test(raw)) {
        return { microPlanner: "researchTopic", confidence: 0.87,
            reason: "keyword: research/analyze/find" };
    }
    return null;
}
// ── PatternDetector ────────────────────────────────────────────
class PatternDetector {
    /** Detect best micro-planner for a parsed goal (embedding → keyword fallback) */
    async detect(parsedGoal) {
        // ── Try embedding-based similarity ─────────────────────────
        try {
            const goalText = this.buildGoalText(parsedGoal);
            const goalVec = await (0, vectorMemory_1.embed)(goalText);
            if (!goalVec.every(v => v === 0)) {
                // Embed each planner description and compute similarity
                let bestName = "";
                let bestScore = 0;
                for (const [name, desc] of Object.entries(PLANNER_DESCRIPTIONS)) {
                    const plannerVec = await (0, vectorMemory_1.embed)(desc);
                    if (plannerVec.every(v => v === 0))
                        continue;
                    const score = cosineSim(goalVec, plannerVec);
                    if (score > bestScore) {
                        bestScore = score;
                        bestName = name;
                    }
                }
                if (bestScore > 0.85 && bestName) {
                    console.log(`[PatternDetector] Embedding match: ${bestName} (${(bestScore * 100).toFixed(1)}%)`);
                    return {
                        microPlanner: bestName,
                        confidence: bestScore,
                        reason: `embedding similarity ${(bestScore * 100).toFixed(1)}%`,
                    };
                }
                console.log(`[PatternDetector] No strong embedding match (best: ${bestName} @ ${(bestScore * 100).toFixed(1)}%) — trying keyword fallback`);
            }
        }
        catch {
            // Ollama embeddings unavailable — fall through to keyword matching
        }
        // ── Keyword fallback ───────────────────────────────────────
        const kw = keywordMatch(parsedGoal);
        if (kw) {
            console.log(`[PatternDetector] Keyword match: ${kw.microPlanner} (${(kw.confidence * 100).toFixed(1)}%) — ${kw.reason}`);
        }
        else {
            console.log(`[PatternDetector] No pattern match — will use LLM planner`);
        }
        return kw;
    }
    // ── Helpers ─────────────────────────────────────────────────
    buildGoalText(g) {
        return [
            g.raw,
            `type:${g.type}`,
            `domain:${g.domain}`,
            g.stack.length ? `stack:${g.stack.join(" ")}` : "",
            g.features.length ? `features:${g.features.join(" ")}` : "",
            g.database ? `database:${g.database}` : "",
        ].filter(Boolean).join(" ");
    }
}
exports.PatternDetector = PatternDetector;
exports.patternDetector = new PatternDetector();
