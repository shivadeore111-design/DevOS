// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// ============================================================
// memory/skillKnowledge.ts — Skill Knowledge Base
// Stores known problems, solutions, and best practices per skill.
// Persists to workspace/skill-knowledge.json
// ============================================================

import fs   from "fs";
import path from "path";

const STORE_DIR  = path.join(process.cwd(), "workspace");
const STORE_FILE = path.join(STORE_DIR, "skill-knowledge.json");

// ── Interfaces ────────────────────────────────────────────────

export interface SkillKnowledge {
  skillName:        string;
  knownProblems:    string[];
  knownSolutions:   string[];
  bestPractices:    string[];
  failurePatterns:  Array<{
    pattern:   string;
    frequency: number;
    solution:  string;
  }>;
  lastUpdated: string;
}

// ── SkillKnowledgeBase ────────────────────────────────────────

export class SkillKnowledgeBase {
  private data: Map<string, SkillKnowledge> = new Map();

  constructor() {
    this._load();
  }

  // ── Reads ──────────────────────────────────────────────────

  get(skillName: string): SkillKnowledge | undefined {
    return this.data.get(skillName);
  }

  list(): SkillKnowledge[] {
    return Array.from(this.data.values());
  }

  // ── Writes ─────────────────────────────────────────────────

  upsert(knowledge: SkillKnowledge): void {
    knowledge.lastUpdated = new Date().toISOString();
    this.data.set(knowledge.skillName, knowledge);
    this._persist();
  }

  addFailurePattern(skillName: string, pattern: string, solution: string): void {
    const existing = this._getOrCreate(skillName);
    const found = existing.failurePatterns.find(fp => fp.pattern === pattern);
    if (found) {
      found.frequency += 1;
      found.solution = solution;
    } else {
      existing.failurePatterns.push({ pattern, frequency: 1, solution });
    }
    existing.lastUpdated = new Date().toISOString();
    this.data.set(skillName, existing);
    this._persist();
  }

  addBestPractice(skillName: string, practice: string): void {
    const existing = this._getOrCreate(skillName);
    if (!existing.bestPractices.includes(practice)) {
      existing.bestPractices.push(practice);
    }
    existing.lastUpdated = new Date().toISOString();
    this.data.set(skillName, existing);
    this._persist();
  }

  // ── Private ────────────────────────────────────────────────

  private _getOrCreate(skillName: string): SkillKnowledge {
    if (this.data.has(skillName)) return this.data.get(skillName)!;
    const blank: SkillKnowledge = {
      skillName,
      knownProblems:   [],
      knownSolutions:  [],
      bestPractices:   [],
      failurePatterns: [],
      lastUpdated:     new Date().toISOString(),
    };
    this.data.set(skillName, blank);
    return blank;
  }

  private _load(): void {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_FILE)) {
      this._persist();
      return;
    }
    try {
      const raw:  SkillKnowledge[] = JSON.parse(fs.readFileSync(STORE_FILE, "utf-8"));
      this.data.clear();
      for (const sk of raw) this.data.set(sk.skillName, sk);
    } catch (err: any) {
      console.error(`[SkillKnowledgeBase] Load failed: ${err.message}`);
    }
  }

  private _persist(): void {
    const tmp = STORE_FILE + ".tmp";
    try {
      if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify(this.list(), null, 2), "utf-8");
      fs.renameSync(tmp, STORE_FILE);
    } catch (err: any) {
      console.error(`[SkillKnowledgeBase] Persist failed: ${err.message}`);
    }
  }
}

// ── Singleton ─────────────────────────────────────────────────

export const skillKnowledgeBase = new SkillKnowledgeBase();
