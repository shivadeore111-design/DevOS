// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// research/relevanceScorer.ts — Score search results against goal

import { SearchResult } from "../web/searchEngine";
import { ParsedGoal }   from "../core/goalParser";

export interface ScoredResult extends SearchResult {
  score:    number;   // 0.0 – 1.0
  reasons:  string[];
}

export class RelevanceScorer {

  score(results: SearchResult[], goal: string, parsedGoal?: ParsedGoal): ScoredResult[] {
    const keywords = this.extractKeywords(goal);
    const stack    = parsedGoal?.stack ?? [];

    return results
      .map(r => this.scoreOne(r, keywords, stack))
      .sort((a, b) => b.score - a.score);
  }

  private scoreOne(
    result:   SearchResult,
    keywords: string[],
    stack:    string[],
  ): ScoredResult {
    let score = 0;
    const reasons: string[] = [];
    const haystack = (
      result.title.toLowerCase() + " " +
      result.snippet.toLowerCase() + " " +
      result.url.toLowerCase()
    );

    // ── Keyword presence: up to +0.5 ────────────────────────
    let kwHits = 0;
    for (const kw of keywords) {
      if (haystack.includes(kw.toLowerCase())) kwHits++;
    }
    if (keywords.length > 0) {
      const kwScore = Math.min(0.5, (kwHits / keywords.length) * 0.5);
      if (kwScore > 0) {
        score += kwScore;
        reasons.push(`keywords: ${kwHits}/${keywords.length}`);
      }
    }

    // ── Stack terms: up to +0.3 ──────────────────────────────
    let stackHits = 0;
    for (const term of stack) {
      if (haystack.includes(term.toLowerCase())) stackHits++;
    }
    if (stack.length > 0) {
      const stackScore = Math.min(0.3, (stackHits / stack.length) * 0.3);
      if (stackScore > 0) {
        score += stackScore;
        reasons.push(`stack: ${stackHits}/${stack.length}`);
      }
    }

    // ── Snippet length: +0.1 if >100 chars ──────────────────
    if (result.snippet.length > 100) {
      score += 0.1;
      reasons.push("has snippet");
    }

    // ── Code signals: +0.1 ──────────────────────────────────
    const codeSignals = ["github.com", "stackoverflow.com", "npmjs.com", "docs.", "tutorial", "example"];
    if (codeSignals.some(s => haystack.includes(s))) {
      score += 0.1;
      reasons.push("code/docs source");
    }

    return { ...result, score: Math.min(1, score), reasons };
  }

  private extractKeywords(goal: string): string[] {
    const stopwords = new Set([
      "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
      "have", "has", "had", "do", "does", "did", "will", "would", "could",
      "should", "may", "might", "shall", "can", "need", "dare", "ought",
      "used", "to", "of", "in", "on", "at", "by", "for", "with", "about",
      "as", "into", "through", "during", "before", "after", "above", "below",
      "from", "up", "down", "out", "off", "over", "under", "again", "further",
      "then", "once", "and", "or", "but", "nor", "so", "yet", "both", "either",
      "neither", "not", "only", "own", "same", "than", "too", "very", "just",
      "create", "build", "make", "write", "add", "implement", "use", "get",
      "set", "run", "start", "stop", "how", "what", "when", "where", "why",
      "which", "who", "i", "my", "me", "you", "your", "we", "our", "they",
    ]);

    return goal
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopwords.has(w));
  }
}

export const relevanceScorer = new RelevanceScorer();
