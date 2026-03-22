// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// ============================================================
// memory/ragRetriever.ts — Semantic context retrieval
// Used by planner.ts and agentCoordinator.ts to inject
// relevant past experience before LLM calls.
// ============================================================

import { vectorMemory, SearchResult } from "./vectorMemory";

// ── Result Types ─────────────────────────────────────────────

export interface RAGContext {
  hasResults:   boolean;
  contextBlock: string;       // ready to inject into a prompt
  sources:      SearchResult[];
}

// ── Core Retriever ────────────────────────────────────────────

export class RAGRetriever {

  /**
   * Search and return a formatted context block for a given goal/query.
   * Use `contextBlock` directly in prompts.
   */
  static async retrieve(
    query:   string,
    topK:    number   = 5,
    tags?:   string[]
  ): Promise<RAGContext> {
    const results = await vectorMemory.search(query, topK, 0.35, tags);

    if (results.length === 0) {
      return { hasResults: false, contextBlock: "", sources: [] };
    }

    const lines: string[] = [
      "── Relevant Past Experience ────────────────────────────",
    ];

    for (const r of results) {
      const score = (r.similarity * 100).toFixed(0);
      const meta  = r.entry.metadata;
      lines.push(`[${score}% match] ${r.entry.text.slice(0, 300)}${r.entry.text.length > 300 ? "..." : ""}`);
      if (meta.outcome)  lines.push(`  Outcome: ${meta.outcome}`);
      if (meta.skillUsed) lines.push(`  Skill: ${meta.skillUsed}`);
      if (meta.duration)  lines.push(`  Duration: ${meta.duration}ms`);
      lines.push("");
    }

    lines.push("────────────────────────────────────────────────────────");

    return {
      hasResults:   true,
      contextBlock: lines.join("\n"),
      sources:      results,
    };
  }

  /**
   * Retrieve past errors similar to the current error.
   * Used by the verifier and error recovery logic.
   */
  static async retrieveErrors(errorMessage: string, topK = 3): Promise<RAGContext> {
    return this.retrieve(errorMessage, topK, ["error"]);
  }

  /**
   * Retrieve similar past tasks — used by planner to reuse successful patterns.
   */
  static async retrieveSimilarTasks(goal: string, topK = 5): Promise<RAGContext> {
    return this.retrieve(goal, topK, ["task"]);
  }

  /**
   * Retrieve relevant skill usage history.
   */
  static async retrieveSkillHistory(skillName: string, topK = 3): Promise<RAGContext> {
    return this.retrieve(skillName, topK, ["skill"]);
  }

  /**
   * Index a completed task into vector memory.
   * Called from runner.ts after task completion.
   */
  static async indexTask(task: {
    id:          string;
    goal:        string;
    status:      string;
    result?:     any;
    plan?:       any;
    completedAt?: string;
    durationMs?: number;
  }): Promise<void> {
    const text = [
      `Goal: ${task.goal}`,
      `Status: ${task.status}`,
      task.plan?.summary ? `Plan: ${task.plan.summary}` : "",
      task.result ? `Result: ${JSON.stringify(task.result).slice(0, 200)}` : "",
    ].filter(Boolean).join("\n");

    await vectorMemory.store(text, {
      taskId:    task.id,
      status:    task.status,
      outcome:   task.status === "completed" ? "success" : "failure",
      goal:      task.goal,
      duration:  task.durationMs,
      timestamp: task.completedAt,
    }, ["task", task.status]);
  }

  /**
   * Index an error into vector memory for future CRAG fallback decisions.
   */
  static async indexError(stage: string, message: string, context?: string): Promise<void> {
    const text = `Error in ${stage}: ${message}${context ? `\nContext: ${context}` : ""}`;
    await vectorMemory.store(text, {
      stage,
      message,
      timestamp: new Date().toISOString(),
    }, ["error", stage]);
  }

  /**
   * Index a skill execution result.
   */
  static async indexSkillRun(skillName: string, success: boolean, details?: string): Promise<void> {
    const text = `Skill: ${skillName} — ${success ? "succeeded" : "failed"}${details ? `\nDetails: ${details}` : ""}`;
    await vectorMemory.store(text, {
      skillName,
      success,
      timestamp: new Date().toISOString(),
    }, ["skill", success ? "skill_success" : "skill_failure"]);
  }
}
