"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.RAGRetriever = void 0;
// ============================================================
// memory/ragRetriever.ts — Semantic context retrieval
// Used by planner.ts and agentCoordinator.ts to inject
// relevant past experience before LLM calls.
// ============================================================
const vectorMemory_1 = require("./vectorMemory");
// ── Core Retriever ────────────────────────────────────────────
class RAGRetriever {
    /**
     * Search and return a formatted context block for a given goal/query.
     * Use `contextBlock` directly in prompts.
     */
    static async retrieve(query, topK = 5, tags) {
        const results = await vectorMemory_1.vectorMemory.search(query, topK, 0.35, tags);
        if (results.length === 0) {
            return { hasResults: false, contextBlock: "", sources: [] };
        }
        const lines = [
            "── Relevant Past Experience ────────────────────────────",
        ];
        for (const r of results) {
            const score = (r.similarity * 100).toFixed(0);
            const meta = r.entry.metadata;
            lines.push(`[${score}% match] ${r.entry.text.slice(0, 300)}${r.entry.text.length > 300 ? "..." : ""}`);
            if (meta.outcome)
                lines.push(`  Outcome: ${meta.outcome}`);
            if (meta.skillUsed)
                lines.push(`  Skill: ${meta.skillUsed}`);
            if (meta.duration)
                lines.push(`  Duration: ${meta.duration}ms`);
            lines.push("");
        }
        lines.push("────────────────────────────────────────────────────────");
        return {
            hasResults: true,
            contextBlock: lines.join("\n"),
            sources: results,
        };
    }
    /**
     * Retrieve past errors similar to the current error.
     * Used by the verifier and error recovery logic.
     */
    static async retrieveErrors(errorMessage, topK = 3) {
        return this.retrieve(errorMessage, topK, ["error"]);
    }
    /**
     * Retrieve similar past tasks — used by planner to reuse successful patterns.
     */
    static async retrieveSimilarTasks(goal, topK = 5) {
        return this.retrieve(goal, topK, ["task"]);
    }
    /**
     * Retrieve relevant skill usage history.
     */
    static async retrieveSkillHistory(skillName, topK = 3) {
        return this.retrieve(skillName, topK, ["skill"]);
    }
    /**
     * Index a completed task into vector memory.
     * Called from runner.ts after task completion.
     */
    static async indexTask(task) {
        const text = [
            `Goal: ${task.goal}`,
            `Status: ${task.status}`,
            task.plan?.summary ? `Plan: ${task.plan.summary}` : "",
            task.result ? `Result: ${JSON.stringify(task.result).slice(0, 200)}` : "",
        ].filter(Boolean).join("\n");
        await vectorMemory_1.vectorMemory.store(text, {
            taskId: task.id,
            status: task.status,
            outcome: task.status === "completed" ? "success" : "failure",
            goal: task.goal,
            duration: task.durationMs,
            timestamp: task.completedAt,
        }, ["task", task.status]);
    }
    /**
     * Index an error into vector memory for future CRAG fallback decisions.
     */
    static async indexError(stage, message, context) {
        const text = `Error in ${stage}: ${message}${context ? `\nContext: ${context}` : ""}`;
        await vectorMemory_1.vectorMemory.store(text, {
            stage,
            message,
            timestamp: new Date().toISOString(),
        }, ["error", stage]);
    }
    /**
     * Index a skill execution result.
     */
    static async indexSkillRun(skillName, success, details) {
        const text = `Skill: ${skillName} — ${success ? "succeeded" : "failed"}${details ? `\nDetails: ${details}` : ""}`;
        await vectorMemory_1.vectorMemory.store(text, {
            skillName,
            success,
            timestamp: new Date().toISOString(),
        }, ["skill", success ? "skill_success" : "skill_failure"]);
    }
}
exports.RAGRetriever = RAGRetriever;
