// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
// index.ts — DevOS Entry Point
// Commands: run, daemon, status, enqueue, plan, grow, agent, doctor, test
// ============================================================

import "dotenv/config";
import path  from "path";
import fs    from "fs";
import axios from "axios";

import { taskStore }                           from "./core/taskStore";
import { taskQueue }                           from "./core/taskQueue";
import { Runner }                              from "./core/runner";
import { DevOSEngine }                         from "./executor/engine";
import { generatePlan }                        from "./core/planner_v2";
import { verifyTask }                          from "./core/verifier";
import { memoryStore }                         from "./memory/memoryStore";
import { checkOllamaHealth, listOllamaModels } from "./llm/ollama";
import { StrategicPlanner }                    from "./core/strategicPlanner";
import { GrowthEngine }                        from "./growth/growthEngine";
import { AgentCoordinator }                    from "./agents/agentCoordinator_v2";
import { vectorMemory }                        from "./memory/vectorMemory";
import { RAGRetriever }                        from "./memory/ragRetriever";
import { TaskPatternMemory }                   from "./memory/taskPatterns";
import { SkillMemory }                         from "./skills/skillMemory";
import { Observability }                       from "./core/observability";
import { CapabilityGraph }                     from "./core/capabilityGraph";
import { PromptEvolver }                       from "./core/promptEvolver";
import { dashboard }                           from "./dashboard/metrics";

// ── Bootstrap ─────────────────────────────────────────────────

const workspace = path.join(process.cwd(), "workspace", "sandbox");
if (!fs.existsSync(workspace)) fs.mkdirSync(workspace, { recursive: true });

taskStore.load();
memoryStore.load();
vectorMemory.load();

// ── Ollama health check ────────────────────────────────────────

async function assertOllamaReady(): Promise<void> {
  const model = process.env.OLLAMA_MODEL ?? "llama3";
  const alive = await checkOllamaHealth();

  if (!alive) {
    console.error("\n❌  Ollama is not running.");
    console.error("    Fix: ollama serve");
    console.error(`    Then: ollama pull ${model}\n`);
    process.exit(1);
  }

  const models   = await listOllamaModels();
  const hasModel = models.some((m: string) => m.startsWith(model));

  console.log(`✅  Ollama ready — model: ${model}`);
  if (models.length) console.log(`    Available: ${models.join(", ")}`);
  if (!hasModel) {
    console.warn(`⚠️   Model "${model}" not pulled yet. Run: ollama pull ${model}`);
  }
}

// ── CLI Argument Parsing ──────────────────────────────────────

const command   = process.argv[2];
const rawArgs   = process.argv.slice(3);
const cleanMode = rawArgs.includes("--clean");
const dryRun    = rawArgs.includes("--dry-run");
const goalArgs  = rawArgs.filter((a: string) => !a.startsWith("--"));
const goal      = goalArgs.join(" ").trim();

if (cleanMode) {
  console.log("🧹 Cleaning sandbox...");
  if (fs.existsSync(workspace)) {
    for (const f of fs.readdirSync(workspace)) {
      fs.rmSync(path.join(workspace, f), { recursive: true, force: true });
    }
  }
  console.log("🧹 Done.");
}

// ── Doctor ────────────────────────────────────────────────────

async function runDoctor(): Promise<void> {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const model   = process.env.OLLAMA_MODEL    ?? "llama3";

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║          DevOS Doctor v2.0               ║");
  console.log("╚══════════════════════════════════════════╝\n");

  // Ollama running
  try {
    await axios.get(baseUrl, { timeout: 3000 });
    console.log("  Ollama running      ✅");
  } catch {
    console.log("  Ollama running      ❌  →  Run: ollama serve");
  }

  // Model available
  try {
    const res    = await axios.get(`${baseUrl}/api/tags`, { timeout: 5000 });
    const models = res.data.models?.map((m: any) => m.name) ?? [];
    const found  = models.some((m: string) => m.startsWith(model));
    console.log(`  Model ${model.padEnd(22)} ${found ? "✅" : "❌  →  Run: ollama pull " + model}`);
  } catch {
    console.log("  Model check         ❌  →  Ollama not reachable");
  }

  // Workspace + .env
  const wsExists  = fs.existsSync(path.join(process.cwd(), "workspace"));
  const envExists = fs.existsSync(path.join(process.cwd(), ".env"));
  console.log(`  Workspace folder    ${wsExists  ? "✅" : "❌"}`);
  console.log(`  .env file           ${envExists ? "✅" : "❌  →  Create .env with OLLAMA_MODEL=llama3"}`);

  // New modules
  const newFiles = [
    "core/strategicPlanner.ts",
    "growth/growthEngine.ts",
    "growth/monetizationIntelligence.ts",
    "deployment/deploymentEngine.ts",
    "agents/agentCoordinator.ts",
  ];
  console.log("\n  Modules:");
  for (const f of newFiles) {
    const exists = fs.existsSync(path.join(process.cwd(), f));
    console.log(`    ${f.padEnd(42)} ${exists ? "✅" : "❌"}`);
  }

  console.log("\n  Config:");
  console.log(`    OLLAMA_BASE_URL = ${baseUrl}`);
  console.log(`    OLLAMA_MODEL    = ${model}`);
  console.log(`    DEVOS_DEBUG     = ${process.env.DEVOS_DEBUG ?? "false"}`);
  console.log(`    DAEMON_AGENTS   = ${process.env.DAEMON_AGENTS ?? "1"}\n`);
}

// ── Test ──────────────────────────────────────────────────────

async function runTest(): Promise<void> {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║          DevOS Test Runner               ║");
  console.log("╚══════════════════════════════════════════╝\n");

  await assertOllamaReady();

  const start   = Date.now();
  const results: Record<string, boolean> = {};

  // Test: plan mode
  console.log("  Running: plan mode...");
  try {
    const plan = await StrategicPlanner.createStrategicPlan({
      description:      "Build a simple todo app",
      targetMarket:     "General consumers",
      timelineWeeks:    2,
      budgetConstraint: "bootstrap",
    });
    results["plan.milestones"]       = Array.isArray(plan.milestones) && plan.milestones.length > 0;
    results["plan.recommendedStack"] = Object.keys(plan.recommendedStack ?? {}).length > 0;
    results["plan.estimatedDays"]    = plan.estimatedTotalDays > 0;
  } catch (err: any) {
    results["plan.milestones"] = results["plan.recommendedStack"] = results["plan.estimatedDays"] = false;
    console.error(`  ❌ Plan error: ${err.message}`);
  }

  // Test: grow ICP
  console.log("  Running: grow ICP...");
  try {
    const icp = await GrowthEngine.generateICP("A simple todo app for busy professionals");
    results["grow.icp.segment"]    = !!icp.segment && icp.segment.toLowerCase() !== "unknown";
    results["grow.icp.painPoints"] = Array.isArray(icp.painPoints) && icp.painPoints.length > 0;
  } catch (err: any) {
    results["grow.icp.segment"] = results["grow.icp.painPoints"] = false;
    console.error(`  ❌ Grow error: ${err.message}`);
  }

  const passed  = Object.values(results).filter(Boolean).length;
  const total   = Object.keys(results).length;
  const runtime = Date.now() - start;

  console.log("\n  Results:");
  for (const [check, pass] of Object.entries(results)) {
    console.log(`    ${pass ? "✅" : "❌"} ${check}`);
  }
  console.log(`\n  Score:   ${passed}/${total} passed`);
  console.log(`  Runtime: ${(runtime / 1000).toFixed(1)}s`);
  console.log(`  Status:  ${passed === total ? "✅ ALL PASSED" : "⚠️  SOME FAILED"}\n`);

  // Save report
  const logDir = path.join(process.cwd(), "workspace", "logs");
  fs.mkdirSync(logDir, { recursive: true });
  fs.writeFileSync(
    path.join(logDir, "test-report.json"),
    JSON.stringify({ timestamp: new Date().toISOString(), passed, total, runtime, results }, null, 2)
  );
  console.log(`  Report → workspace/logs/test-report.json\n`);
}

// ── Main ──────────────────────────────────────────────────────

async function handleCLI(): Promise<void> {
  console.log("🚀 DevOS — Local Autonomous Engine");
  console.log(`📟 Command: ${command ?? "(none)"}`);
  if (dryRun)    console.log("🧪 Dry Run Mode: ON");
  if (cleanMode) console.log("🧹 Clean Mode: ON");
  console.log("");

  const engine = new DevOSEngine(workspace, dryRun);

  switch (command) {

    // ── devos run ────────────────────────────────────────────
    case "run": {
      if (!goal) {
        console.error("❌ Usage: ts-node index.ts run \"your goal here\"");
        process.exit(1);
      }
      await assertOllamaReady();
      console.log(`\n🎯 Goal: "${goal}"\n`);

      let plan;
      if (goal === "test-gap") {
        plan = {
          summary: "Capability gap test", complexity: "low",
          actions: [{ type: "file_append", path: "test.txt", content: "More content\n", risk: "low" }],
        };
      } else {
        plan = await generatePlan(goal);
      }

      console.log("\n📦 Plan:");
      console.log(JSON.stringify(plan, null, 2));

      const runner = new Runner({ agentId: "cli-agent", engine });
      const task   = await runner.runOnce(goal, plan);

      if (task.status === "completed") {
        console.log("\n🔍 Verifying result...");
        const verification = await verifyTask(task);
        console.log(`\n${verification.passed ? "✅" : "❌"} Verification: ${verification.passed ? "PASSED" : "FAILED"}`);
        console.log(`   Confidence: ${(verification.confidence * 100).toFixed(0)}%`);
        console.log(`   Summary: ${verification.summary}`);
        if (verification.issues?.length) console.log(`   Issues: ${verification.issues.join(", ")}`);

        memoryStore.set(`task:${task.id}`, {
          goal: task.goal, result: task.result, verification, completedAt: task.completedAt,
        }, ["task", "completed"]);
      }

      await RAGRetriever.indexTask({
        id:         task.id,
        goal:       task.goal,
        status:     task.status,
        result:     task.result,
        plan,
        durationMs: task.completedAt
          ? Date.parse(task.completedAt) - Date.parse(task.createdAt)
          : 0,
      });

      if (task.status === "completed") {
        await TaskPatternMemory.save(task.goal, plan);
      }

      Observability.recordTask({
        taskId:     task.id,
        goal:       task.goal,
        status:     task.status as "completed" | "failed" | "escalated",
        durationMs: task.completedAt
          ? Date.parse(task.completedAt) - Date.parse(task.createdAt)
          : 0,
        agentId:    "cli-agent",
        timestamp:  new Date().toISOString(),
      });

      console.log("\n📊 Final Task State:");
      console.log(JSON.stringify(task, null, 2));
      break;
    }

    // ── devos daemon ──────────────────────────────────────────
    case "daemon": {
      await assertOllamaReady();
      console.log("\n🤖 Starting DevOS Daemon...");

      const agentCount = parseInt(process.env.DAEMON_AGENTS  ?? "1",    10);
      const pollMs     = parseInt(process.env.DAEMON_POLL_MS ?? "2000", 10);

      for (let i = 0; i < agentCount; i++) {
        const runner = new Runner({ agentId: `daemon-agent-${i + 1}`, engine, pollIntervalMs: pollMs });
        runner.startDaemon();
      }

      console.log(`✅ ${agentCount} agent(s) running. Press Ctrl+C to stop.\n`);
      process.on("SIGINT",  () => { console.log("\n[Daemon] Shutting down..."); process.exit(0); });
      process.on("SIGTERM", () => { console.log("\n[Daemon] Shutting down..."); process.exit(0); });
      break;
    }

    // ── devos status ──────────────────────────────────────────
    case "status": {
      const all = taskStore.getAll();
      if (!all.length) { console.log("📭 No tasks in queue."); break; }

      const counts: Record<string, number> = {};
      for (const t of all) counts[t.status] = (counts[t.status] ?? 0) + 1;

      console.log("📊 Task Status Summary:");
      for (const [status, count] of Object.entries(counts)) {
        console.log(`   ${status.padEnd(12)} ${count}`);
      }
      console.log(`\n   Total: ${all.length}`);

      const recent = [...all].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
      console.log("\n📋 Recent Tasks:");
      for (const t of recent) {
        console.log(`   [${t.status.padEnd(10)}] ${t.id.slice(0, 8)} — "${t.goal.slice(0, 60)}"`);
      }
      break;
    }

    // ── devos enqueue ─────────────────────────────────────────
    case "enqueue": {
      if (!goal) {
        console.error("❌ Usage: ts-node index.ts enqueue \"your goal here\"");
        process.exit(1);
      }
      await assertOllamaReady();
      const plan = await generatePlan(goal);
      const task = taskQueue.create({ goal, plan });
      console.log(`\n✅ Task enqueued: ${task.id}`);
      console.log(`   Goal: "${task.goal}"`);
      break;
    }

    // ── devos plan ────────────────────────────────────────────
    case "plan": {
      if (!goal) {
        console.log('Usage: ts-node index.ts plan "your business goal"');
        process.exit(1);
      }
      await assertOllamaReady();
      console.log('\n[DevOS] 🧠 Running strategic planning...\n');

      const plan = await StrategicPlanner.createStrategicPlan({
        description: goal, targetMarket: "B2B SaaS",
        timelineWeeks: 8, budgetConstraint: "bootstrap",
      });

      console.log(StrategicPlanner.formatPlanReport(plan));
      const savedPath = StrategicPlanner.savePlan(plan);
      console.log(`\n📄 Plan saved → ${savedPath}\n`);
      break;
    }

    // ── devos grow ────────────────────────────────────────────
    case "grow": {
      if (!goal) {
        console.log('Usage: ts-node index.ts grow "your product description"');
        process.exit(1);
      }
      await assertOllamaReady();
      console.log('\n[DevOS] 📈 Running growth engine...\n');

      const icp = await GrowthEngine.generateICP(goal);
      console.log(`✅ ICP generated — Segment: ${icp.segment}`);

      const landing = await GrowthEngine.generateLandingPageCopy(icp, goal);
      console.log(`✅ Landing page copy — Headline: "${landing.headline}"`);

      await GrowthEngine.generateEmailSequence("Welcome", "user_signup", icp);
      console.log("✅ Email sequence generated");

      await GrowthEngine.generateContentCalendar(4, icp);
      console.log("✅ 4-week content calendar generated");

      console.log("\n📁 All growth assets saved → workspace/growth/\n");
      break;
    }

    // ── devos agent ───────────────────────────────────────────
    case "agent": {
      if (!goal) {
        console.log('Usage: ts-node index.ts agent "your goal"');
        process.exit(1);
      }
      await assertOllamaReady();
      console.log('\n[DevOS] 🤖 Launching multi-agent pipeline...\n');

      const result      = await AgentCoordinator.runAgentPipeline(goal);
      const agentReport = AgentCoordinator.formatPipelineReport(result);
      console.log(agentReport);
      break;
    }

    // ── devos doctor ──────────────────────────────────────────
    case "doctor": {
      await runDoctor();
      break;
    }

    // ── devos test ────────────────────────────────────────────
    case "test": {
      await runTest();
      break;
    }

    // ── devos serve ───────────────────────────────────────────
    case "serve": {
      const { dashboardServer } = await import("./dashboard/server");
      await dashboardServer.start();
      console.log("🖥  DevOS Control Plane running at http://localhost:3333");
      console.log("   Press Ctrl+C to stop");
      process.on("SIGINT",  () => { dashboardServer.stop(); process.exit(0); });
      process.on("SIGTERM", () => { dashboardServer.stop(); process.exit(0); });
      break;
    }

    // ── devos dashboard ───────────────────────────────────────
    case "dashboard": {
      dashboard.display();
      break;
    }

    // ── devos capabilities ────────────────────────────────────
    case "capabilities": {
      if (!goal) {
        console.log(CapabilityGraph.report());
        break;
      }
      await assertOllamaReady();
      const analysis = await CapabilityGraph.analyzeGoal(goal);
      console.log("\n🔍 Capability Analysis:");
      console.log(`  Goal:        ${analysis.goal}`);
      console.log(`  Can execute: ${analysis.canExecute ? "✅ Yes" : "❌ No"}`);
      console.log(`  Required:    ${analysis.required.join(", ") || "none"}`);
      if (analysis.missing.length > 0) {
        console.log(`  Missing:     ${analysis.missing.join(", ")}`);
        console.log("\n  Skills to build:");
        analysis.gaps.forEach(g =>
          console.log(`    • ${g.required}: ${g.buildHint ?? "build a skill for this"}`)
        );
      }
      break;
    }

    // ── devos help / default ──────────────────────────────────
    case "help":
    case "--help":
    default: {
      console.log(`
╔══════════════════════════════════════════╗
║              DevOS v2.0                  ║
║   Autonomous AI Execution System         ║
╚══════════════════════════════════════════╝

Usage: ts-node index.ts <mode> [input]

Core Modes:
  run       <task>     Run a single task autonomously
  daemon               Start background task processor
  status               Show current task queue status
  enqueue   <task>     Add task to queue

Business Modes:
  plan      <goal>     Generate strategic plan + milestones
  grow      <product>  Generate ICP, landing page, emails, calendar
  agent     <goal>     Launch full multi-agent pipeline

Utilities:
  doctor               Check system health + config
  test                 Run built-in test suite
  serve                Start Control Plane UI at http://localhost:3333
  dashboard            Show agent scores, task stats, skill usage
  capabilities <goal>  Analyze what capabilities a goal needs

Flags:
  --dry-run    Plan but don't execute actions
  --clean      Wipe sandbox before running

Examples:
  ts-node index.ts doctor
  ts-node index.ts test
  ts-node index.ts plan "Build niche SaaS for real estate agents"
  ts-node index.ts grow "AI backtesting platform for NSE traders"
  ts-node index.ts agent "Build and market a SaaS for freelancers"
      `);
    }
  }
}

handleCLI().catch((err) => {
  console.error("[DevOS] Fatal error:", err);
  process.exit(1);
});
