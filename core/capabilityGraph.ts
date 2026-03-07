// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// ============================================================
// core/capabilityGraph.ts — Self-expanding capability system
//
// DevOS understands:
//   goal → required capabilities → missing capabilities → build skills
//
// This is the "one extra system" that makes DevOS self-expanding.
//
// Flow:
//   1. analyzeGoal(goal) → what capabilities does this need?
//   2. checkGaps()       → which are missing?
//   3. planAcquisition() → how to build/learn the missing ones?
//   4. After skill is built → register it as available
// ============================================================

import fs   from "fs";
import path from "path";
import { llmCall } from "../llm/router";

const GRAPH_FILE = path.join(process.cwd(), "workspace", "memory", "capabilityGraph.json");

// ── Types ─────────────────────────────────────────────────────

export interface Capability {
  id:           string;
  name:         string;           // e.g. "deploy_to_railway"
  description:  string;
  category:     "shell" | "web" | "file" | "llm" | "skill" | "external";
  available:    boolean;
  skillFile?:   string;           // path to implementing skill
  acquiredAt?:  string;
  usageCount:   number;
}

export interface CapabilityGap {
  required:    string;
  reason:      string;
  priority:    "high" | "medium" | "low";
  buildHint?:  string;           // LLM-suggested approach
}

export interface CapabilityAnalysis {
  goal:            string;
  required:        string[];
  available:       string[];
  missing:         string[];
  gaps:            CapabilityGap[];
  canExecute:      boolean;
  blockers:        string[];
}

// ── Graph Store ───────────────────────────────────────────────

function loadGraph(): Record<string, Capability> {
  try {
    if (fs.existsSync(GRAPH_FILE)) {
      return JSON.parse(fs.readFileSync(GRAPH_FILE, "utf-8"));
    }
  } catch { /* fallback */ }

  // Seed with DevOS built-in capabilities
  return {
    // ── Core built-ins ────────────────────────────────────────
    "file_read":    { id: "file_read",    name: "file_read",    description: "Read files from disk",         category: "file",  available: true,  usageCount: 0 },
    "file_write":   { id: "file_write",   name: "file_write",   description: "Write files to disk",          category: "file",  available: true,  usageCount: 0 },
    "shell_exec":   { id: "shell_exec",   name: "shell_exec",   description: "Execute shell commands",       category: "shell", available: true,  usageCount: 0 },
    "web_fetch":    { id: "web_fetch",    name: "web_fetch",    description: "Fetch web pages",              category: "web",   available: true,  usageCount: 0 },
    "web_search":   { id: "web_search",   name: "web_search",   description: "Search the web",               category: "web",   available: true,  usageCount: 0 },
    "llm_task":     { id: "llm_task",     name: "llm_task",     description: "Run LLM reasoning/generation", category: "llm",   available: true,  usageCount: 0 },
    "git_push":     { id: "git_push",     name: "git_push",     description: "Push code to git",             category: "shell", available: true,  usageCount: 0 },
    "browser":      { id: "browser",      name: "browser",      description: "Control browser automation",   category: "web",   available: true,  usageCount: 0 },

    // ── system_design ─────────────────────────────────────────
    "system_design":        { id: "system_design",        name: "system_design",        description: "Design complete system architectures",       category: "skill", available: true,  skillFile: "skills/architecture/systemArchitect.ts",    usageCount: 0 },
    "api_design":           { id: "api_design",           name: "api_design",           description: "Design REST/GraphQL APIs with schemas",      category: "skill", available: true,  skillFile: "skills/architecture/apiDesigner.ts",        usageCount: 0 },
    "database_design":      { id: "database_design",      name: "database_design",      description: "Design database schemas with migration SQL", category: "skill", available: true,  skillFile: "skills/architecture/databaseDesigner.ts",   usageCount: 0 },
    "scalability_planning": { id: "scalability_planning", name: "scalability_planning", description: "Plan caching, queues, and load balancing",   category: "skill", available: true,  skillFile: "skills/architecture/scalabilityPlanner.ts", usageCount: 0 },

    // ── planning ──────────────────────────────────────────────
    "planning":             { id: "planning",             name: "planning",             description: "Convert goals into ordered execution plans", category: "skill", available: true,  skillFile: "skills/planning/taskPlanner.ts",            usageCount: 0 },
    "project_scaffolding":  { id: "project_scaffolding",  name: "project_scaffolding",  description: "Scaffold full project structures",           category: "skill", available: true,  skillFile: "skills/planning/projectScaffolder.ts",     usageCount: 0 },

    // ── coding ────────────────────────────────────────────────
    "coding":               { id: "coding",               name: "coding",               description: "Generate and write feature implementations", category: "skill", available: true,  skillFile: "skills/coding/featureBuilder.ts",           usageCount: 0 },
    "code_quality":         { id: "code_quality",         name: "code_quality",         description: "Enforce clean code and detect issues",       category: "skill", available: true,  skillFile: "skills/coding/cleanCodeEnforcer.ts",        usageCount: 0 },
    "typescript_improvement":{ id: "typescript_improvement",name: "typescript_improvement",description: "Improve TypeScript types and safety",     category: "skill", available: true,  skillFile: "skills/coding/typescriptExpert.ts",         usageCount: 0 },
    "dependency_management":{ id: "dependency_management", name: "dependency_management",description: "Install, upgrade, and resolve npm deps",    category: "skill", available: true,  skillFile: "skills/coding/dependencyManager.ts",        usageCount: 0 },

    // ── devops ────────────────────────────────────────────────
    "devops":               { id: "devops",               name: "devops",               description: "Deploy and manage infrastructure",           category: "skill", available: false, skillFile: "skills/devops/deploymentEngineer.ts",       usageCount: 0 },
    "ci_build":             { id: "ci_build",             name: "ci_build",             description: "Build and run CI pipelines",                 category: "skill", available: false, skillFile: "skills/devops/ciBuilder.ts",                usageCount: 0 },

    // ── security ──────────────────────────────────────────────
    "security_audit":       { id: "security_audit",       name: "security_audit",       description: "Audit code for security vulnerabilities",    category: "skill", available: false, skillFile: "skills/security/securityAudit.ts",          usageCount: 0 },
    "dependency_audit":     { id: "dependency_audit",     name: "dependency_audit",     description: "Audit dependencies for CVEs",               category: "skill", available: false, skillFile: "skills/security/dependencyAudit.ts",        usageCount: 0 },

    // ── performance ───────────────────────────────────────────
    "cost_optimization":    { id: "cost_optimization",    name: "cost_optimization",    description: "Identify unnecessary cost drivers",          category: "skill", available: true,  skillFile: "skills/performance/costOptimizer.ts",       usageCount: 0 },
  };
}

function saveGraph(graph: Record<string, Capability>): void {
  const dir = path.dirname(GRAPH_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = GRAPH_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(graph, null, 2));
  fs.renameSync(tmp, GRAPH_FILE);
}

// ── CapabilityGraph ───────────────────────────────────────────

export class CapabilityGraph {

  /**
   * Analyze a goal and determine what capabilities it requires.
   * Compares against what DevOS currently has.
   * Returns a full gap analysis.
   */
  static async analyzeGoal(goal: string): Promise<CapabilityAnalysis> {
    const graph     = loadGraph();
    const available = Object.values(graph).filter(c => c.available).map(c => c.name);

    const systemPrompt = `You are a capability analyzer for an autonomous AI system.
Given a goal, list the technical capabilities required to complete it.
Use short identifiers (snake_case).
Return ONLY valid JSON. No markdown.`;

    const prompt = `Goal: "${goal}"
Available capabilities: ${available.join(", ")}

Return JSON:
{
  "required": ["capability1", "capability2"],
  "missing": ["cap_not_in_available_list"],
  "canExecute": true/false,
  "blockers": ["why it can't execute if canExecute=false"]
}`;

    let required: string[] = [];
    let missing:  string[] = [];
    let canExec   = true;
    let blockers: string[] = [];

    try {
      const { content } = await llmCall(prompt, systemPrompt);
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        required = parsed.required ?? [];
        missing  = parsed.missing  ?? [];
        canExec  = parsed.canExecute ?? true;
        blockers = parsed.blockers ?? [];
      }
    } catch (e: any) {
      console.warn(`[CapabilityGraph] Analysis failed: ${e.message}`);
    }

    const gaps: CapabilityGap[] = missing.map(m => ({
      required: m,
      reason:   `Required for: ${goal}`,
      priority: "high" as const,
      buildHint: `Build a skill that implements ${m}`,
    }));

    return {
      goal,
      required,
      available: required.filter(r => available.includes(r)),
      missing,
      gaps,
      canExecute: canExec,
      blockers,
    };
  }

  /**
   * Register a newly built skill as an available capability.
   * Call this from autoSkillBuilder.ts after skill generation.
   */
  static register(
    name:       string,
    description: string,
    skillFile?:  string,
    category:    Capability["category"] = "skill"
  ): void {
    const graph = loadGraph();
    graph[name] = {
      id:          name,
      name,
      description,
      category,
      available:   true,
      skillFile,
      acquiredAt:  new Date().toISOString(),
      usageCount:  0,
    };
    saveGraph(graph);
    console.log(`[CapabilityGraph] ✅ Registered capability: ${name}`);
  }

  /**
   * Mark a capability as unavailable (e.g. broken skill, missing dep).
   */
  static disable(name: string): void {
    const graph = loadGraph();
    if (graph[name]) {
      graph[name].available = false;
      saveGraph(graph);
      console.log(`[CapabilityGraph] ⚠️  Disabled capability: ${name}`);
    }
  }

  /**
   * Increment usage counter for a capability.
   */
  static recordUsage(name: string): void {
    const graph = loadGraph();
    if (graph[name]) {
      graph[name].usageCount += 1;
      saveGraph(graph);
    }
  }

  /**
   * Get all capabilities, available or not.
   */
  static getAll(): Capability[] {
    return Object.values(loadGraph());
  }

  /**
   * Suggest what skills to build next, based on recent gap analysis.
   * Returns a build plan prompt for autoSkillBuilder.
   */
  static async suggestNextBuilds(recentGoals: string[]): Promise<string[]> {
    if (recentGoals.length === 0) return [];

    const analyses = await Promise.all(recentGoals.slice(0, 5).map(g => this.analyzeGoal(g)));
    const allMissing = analyses.flatMap(a => a.missing);

    // Count frequency
    const counts: Record<string, number> = {};
    for (const m of allMissing) counts[m] = (counts[m] ?? 0) + 1;

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);
  }

  /**
   * Format a capability map report.
   */
  static report(): string {
    const all = Object.values(loadGraph());
    const avail  = all.filter(c => c.available);
    const broken = all.filter(c => !c.available);

    const lines = [
      "  Capability Graph",
      "  " + "─".repeat(48),
      `  Available: ${avail.length}   Disabled: ${broken.length}`,
      "",
    ];

    for (const c of avail.sort((a, b) => b.usageCount - a.usageCount).slice(0, 15)) {
      lines.push(`  ✅ ${c.name.padEnd(28)} [${c.category}]  used: ${c.usageCount}x`);
    }
    if (broken.length > 0) {
      lines.push("");
      for (const c of broken) {
        lines.push(`  ❌ ${c.name.padEnd(28)} [${c.category}]`);
      }
    }

    return lines.join("\n") + "\n";
  }
}
