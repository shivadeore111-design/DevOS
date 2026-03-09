// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// ============================================================
// core/planner_v2.ts — DevOS Goal → Plan  (v2 — with RAG + Patterns)
//
// New in v2:
//   1. Retrieve semantically similar past tasks (RAG)
//   2. Retrieve matching task patterns (reuse successful plans)
//   3. Score context relevance (CRAG) — trigger web_search if weak
//   4. Inject context into planning prompt
//   5. OS-aware dynamic system prompt via osContext + goalParser
//   6. Pre-execution plan validation via planValidator
// ============================================================

import { llmCall }             from "../llm/router";
import { RAGRetriever }        from "../memory/ragRetriever";
import { TaskPatternMemory }   from "../memory/taskPatterns";
import { scoreRelevance }      from "../llm/contextCompressor";
import { osContext }           from "./osContext";
import { parseGoal, ParsedGoal } from "./goalParser";
import { validatePlan }        from "./planValidator";
import { patternDetector }     from "./patternDetector";
import { getMicroPlanner }     from "./microPlanners/index";
import { blueprintRegistry }   from "../devos/product/blueprintRegistry";

function buildSystemPrompt(parsedGoal: ParsedGoal): string {
  return `You are DevOS, an autonomous AI operating system planner.
Your job is to convert a user's goal into a structured JSON execution plan.

Respond ONLY with valid JSON. No markdown, no explanation, no code fences.

EXECUTION ENVIRONMENT:
- OS: ${osContext.platform === "win32" ? "Windows" : "Linux/Mac"}
- Shell: ${osContext.shell}
- Node.js: ${osContext.nodeVersion}
- Docker available: ${osContext.hasDocker}
- Git available: ${osContext.hasGit}

GOAL CONTEXT:
- Type: ${parsedGoal.type}
- Domain: ${parsedGoal.domain}
- Stack: ${parsedGoal.stack.join(", ") || "not specified"}
- Features: ${parsedGoal.features.join(", ") || "none detected"}
- Database: ${parsedGoal.database || "none"}

STRICT RULES:
- Use only ${osContext.platform === "win32" ? "Windows cmd.exe" : "bash"} commands
- Node.js, npm, and git are already installed. NEVER install them.
- NEVER use choco, winget, apt-get, brew, or any package manager for runtimes
- NEVER use curl with sudo or any Linux-only commands on Windows
- NEVER use file_write to create directories. Use shell_exec with mkdir instead
- EVERY file_write action MUST have a content field
- ALL file paths must be relative (e.g. server.js not C:\\server.js)
- All shell commands run inside the sandbox directory automatically
- NEVER prefix commands with "cmd /c" — commands run through cmd.exe already
- For servers use: node server.js (it will be handled as background process)
- Keep actions minimal — 4 to 6 steps for simple goals
- If past experience or patterns are provided, USE THEM as a template

Schema:
{
  "summary": "Short description",
  "complexity": "low | medium | high",
  "actions": [
    {
      "type": "file_write | shell_exec | web_fetch | llm_task",
      "description": "What this does",
      "path": "relative/path/file.js",
      "content": "file content here",
      "command": "shell command here",
      "risk": "low | medium | high"
    }
  ]
}`
}

export async function generatePlan(goal: string, extraContext?: string): Promise<any> {
  console.log(`[Planner] Generating plan for: "${goal}"`);

  // ── 1. Parse goal into structured context ────────────────────
  const parsedGoal = parseGoal(goal);

  // ── 2. Micro-planner fast path ────────────────────────────────
  const match = await patternDetector.detect(parsedGoal);

  if (match && match.confidence > 0.85) {
    const planner = getMicroPlanner(match.microPlanner);

    if (planner && planner.canHandle(parsedGoal)) {
      console.log(
        `[Planner] ⚡ Using micro-planner: ${match.microPlanner}` +
        ` (confidence: ${match.confidence.toFixed(2)}) — skipping LLM`
      );

      const microPlan  = planner.buildPlan(parsedGoal);
      const validation = validatePlan(microPlan, parsedGoal);

      if (validation.valid) {
        return {
          ...microPlan,
          _meta: {
            provider:       "micro-planner",
            tokensEstimate: 0,
            ragUsed:        false,
            parsedGoal,
            validation,
            microPlanner:   match.microPlanner,
            confidence:     match.confidence,
            reason:         match.reason,
          },
        };
      }

      console.warn(`[Planner] Micro-planner plan failed validation — falling through to LLM`);
    }
  } else {
    console.log(`[Planner] 🧠 No micro-planner match — using LLM planner`);
  }

  // ── 2b. Blueprint fast path (for build-type goals) ───────────
  if (parsedGoal.type === "build" || /build|create|scaffold|generate/i.test(goal)) {
    const bp = blueprintRegistry.match({ ...parsedGoal, goal });
    if (bp) {
      console.log(`[Planner] 🏗️  Blueprint match: ${bp.id} — using product generator`);
      return {
        summary:    `Build ${bp.name} using blueprint ${bp.id}`,
        complexity: "high",
        actions: [
          {
            type:        "product_build",
            blueprintId: bp.id,
            goal,
            description: `Assemble ${bp.name}: ${bp.modules.join(", ")}`,
            risk:        "low",
          },
        ],
        _meta: {
          provider:       "blueprint",
          tokensEstimate: 0,
          ragUsed:        false,
          parsedGoal,
          blueprintId:    bp.id,
          blueprintName:  bp.name,
        },
      };
    }
  }

  // ── 3. Retrieve RAG context ───────────────────────────────────
  const ragCtx      = await RAGRetriever.retrieveSimilarTasks(goal);
  const patternHint = await TaskPatternMemory.getPlanningHint(goal);

  // ── 3. CRAG: only inject context if it's actually relevant ───
  let contextBlock = "";

  if (ragCtx.hasResults) {
    const score = await scoreRelevance(ragCtx.contextBlock, goal);
    if (score >= 0.4) {
      contextBlock += ragCtx.contextBlock + "\n\n";
      console.log(`[Planner] RAG context injected (relevance: ${(score * 100).toFixed(0)}%)`);
    } else {
      console.log(`[Planner] RAG context skipped (low relevance: ${(score * 100).toFixed(0)}%)`);
      contextBlock += "NOTE: No strong matching past experience found. Consider searching for current information.\n\n";
    }
  }

  if (patternHint) {
    contextBlock += patternHint + "\n\n";
    console.log(`[Planner] Task pattern hint injected.`);
  }

  if (extraContext) {
    // Check for executionMemoryHint JSON tag injected by runner
    const hintMatch = extraContext.match(/<!--executionMemoryHint:(.+?)-->/s)
    if (hintMatch) {
      try {
        const hint = JSON.parse(hintMatch[1])
        const actionSummary = (hint.actions as any[])
          .slice(0, 6)
          .map((a: any, i: number) => `  ${i + 1}. [${a.type}] ${a.description ?? a.command ?? a.path ?? ""}`)
          .join("\n")
        contextBlock +=
          `PROVEN PATTERN: This exact goal type succeeded before with these actions:\n` +
          `${actionSummary}\n` +
          `Success rate: ${(hint.successRate * 100).toFixed(0)}%. Prefer reusing this pattern.\n\n`
        console.log(`[Planner] Execution memory hint injected (${(hint.successRate * 100).toFixed(0)}% success rate)`)
      } catch { /* malformed hint — ignore */ }
    } else {
      contextBlock += extraContext + "\n\n";
    }
  }

  // ── 4. Build dynamic system prompt using parsed goal + OS context
  const systemPrompt = buildSystemPrompt(parsedGoal);

  // ── 5. Build user prompt ──────────────────────────────────────
  const fullPrompt = contextBlock
    ? `${contextBlock}\nGoal to plan: ${goal}`
    : goal;

  // ── 6. Call LLM ───────────────────────────────────────────────
  console.log(`[Planner] 🧠 Calling LLM for plan...`);
  const { content, provider, tokensEstimate } = await llmCall(fullPrompt, systemPrompt);
  console.log(`[Planner] Plan received from ${provider} (~${tokensEstimate} tokens)`);

  let plan: any;

  try {
    const cleaned = content.replace(/```json|```/g, "").trim();
    plan = JSON.parse(cleaned);

    if (!plan.actions || !Array.isArray(plan.actions)) {
      throw new Error("Plan missing actions array");
    }

  } catch (err: any) {
    console.error(`[Planner] Failed to parse plan: ${err.message}`);
    console.error(`[Planner] Raw response: ${content.substring(0, 500)}`);

    plan = {
      summary:    goal,
      complexity: "low",
      actions:    [{ type: "llm_task", description: goal, query: goal, risk: "low" }],
    };
  }

  // ── 7. Validate the plan ──────────────────────────────────────
  const validation = validatePlan(plan, parsedGoal);
  if (!validation.valid) {
    console.warn(`[Planner] Plan validation failed — proceeding with warnings`);
  }

  // ── 8. Attach metadata ────────────────────────────────────────
  return {
    ...plan,
    _meta: {
      provider,
      tokensEstimate,
      ragUsed:      ragCtx.hasResults,
      parsedGoal,
      validation,
      microPlanner: null,
    },
  };
}
