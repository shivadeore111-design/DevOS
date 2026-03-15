// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
// index.ts — DevOS Entry Point
// Commands: run, daemon, status, enqueue, plan, grow, agent, goal, goals, agents, coordinate, mission, missions, chat, profile, personal, builder, briefing, teach, stop, run workflow, agents personal, doctor, test
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
import { executionMemory }                     from "./memory/executionMemory";
import { parseGoal }                           from "./core/goalParser";
import { researchEngine }                      from "./research/researchEngine";
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
import { skillSanitizer }                      from "./executor/skillSanitizer";
import { skillWarmup }                         from "./executor/skillWarmup";
import { skillIndex }                          from "./skills/skillIndex";
import { cronTrigger, webhookTrigger,
         startAllTriggers, stopAllTriggers }   from "./core/triggers";
import { ingestionEngine }                    from "./knowledge/ingestionEngine";
import { knowledgeStore }                     from "./knowledge/knowledgeStore";
import { knowledgeQuery }                     from "./knowledge/knowledgeQuery";
import { github }                             from "./integrations/github";
import { blueprintRegistry }                  from "./devos/product/blueprintRegistry";
import { productManager }                     from "./devos/product/productManager";
import { productGenerator }                   from "./devos/product/productGenerator";
import { deploymentOrchestrator }             from "./devos/product/deploymentOrchestrator";
import { pilotRegistry }                      from "./devos/pilots/pilotRegistry";
import { pilotExecutor }                      from "./devos/pilots/pilotExecutor";
import { pilotScheduler }                     from "./devos/pilots/pilotScheduler";
import { startApiServer }                      from "./api/server";
import { generateApiKey }                      from "./api/middleware/permissions";
import apiConfig                               from "./config/api.json";
import { goalEngine }                          from "./goals/goalEngine";
import { goalStore }                           from "./goals/goalStore";
import { agentRegistry }                       from "./agents/agentRegistry";
import { agentMessenger }                      from "./agents/agentMessenger";
import { coordinationLoop }                    from "./agents/coordinationLoop";
import { AgentRole }                           from "./agents/types";
import { runInstaller }                        from "./cli/installer";
import { dialogueEngine }                      from "./personality/dialogueEngine";
import { userProfile }                         from "./personality/userProfile";
import { conversationMemory }                  from "./personality/conversationMemory";
import { morningBriefing }                     from "./personal/morningBriefing";
import { teachMode }                           from "./personal/teachMode";
import { backgroundAgents }                    from "./personal/backgroundAgents";
import { isPersonalMode }                      from "./personal/personalMode";

// ── Bootstrap ─────────────────────────────────────────────────

const workspace = path.join(process.cwd(), "workspace", "sandbox");
if (!fs.existsSync(workspace)) fs.mkdirSync(workspace, { recursive: true });

taskStore.load();
memoryStore.load();
vectorMemory.load();

// Sanitize any LLM-generated skill files on every startup
skillSanitizer.sanitizeDirectory("skills/generated").then(n => {
  if (n > 0) console.log(`[Boot] Sanitized ${n} generated skill file(s)`);
}).catch(() => {});

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
      // ── devos run workflow "<name>" — replay a taught workflow
      if (rawArgs[0]?.toLowerCase() === 'workflow') {
        const wfName = rawArgs.slice(1).join(' ').trim()
        if (!wfName) { console.error('❌ Usage: ts-node index.ts run workflow "<name>"'); break }
        console.log(`\n▶️  Running workflow: "${wfName}"\n`)
        const wfOutput = await teachMode.runWorkflow(wfName)
        console.log(wfOutput)
        console.log('')
        break
      }
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
        // ── Execution memory hint ──────────────────────────
        const parsed   = parseGoal(goal);
        const memHint  = executionMemory.lookup(parsed);
        let extraCtx: string | undefined;
        if (memHint && memHint.successRate > 0.8) {
          extraCtx = `<!--executionMemoryHint:${JSON.stringify({
            actions:     memHint.actions,
            successRate: memHint.successRate,
          })}-->`;
        }
        plan = await generatePlan(goal, extraCtx);
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

    // ── devos agent <role|goal> ───────────────────────────────
    // If first arg is a known agent role → show agent detail (Sprint 14)
    // Otherwise → launch legacy multi-agent pipeline (Sprint 12)
    case "agent": {
      const agentArg = goalArgs[0];
      const knownRoles: AgentRole[] = ["ceo", "engineer", "researcher", "operator"];

      if (knownRoles.includes(agentArg as AgentRole)) {
        // ── Sprint 14: devos agent <role> — show detail
        const agentDetail = agentRegistry.get(agentArg as AgentRole);
        if (!agentDetail) {
          console.error(`❌ Unknown agent role: ${agentArg}`);
          console.error("   Valid roles: ceo, engineer, researcher, operator");
          process.exit(1);
        }
        const statusIcon = agentDetail.status === "idle"      ? "💤"
          : agentDetail.status === "thinking"  ? "🧠"
          : agentDetail.status === "executing" ? "⚙️ "
          : agentDetail.status === "waiting"   ? "⏳"
          : "❌";
        console.log(`\n${statusIcon} Agent: ${agentDetail.name} [${agentDetail.role}]`);
        console.log(`   ID:          ${agentDetail.id}`);
        console.log(`   Status:      ${agentDetail.status}`);
        console.log(`   Description: ${agentDetail.description}`);
        console.log(`   Tools:       ${agentDetail.tools.join(", ")}`);
        console.log(`   Budget:      ${agentDetail.budget} tokens`);
        console.log(`   Completed:   ${agentDetail.completedTasks} tasks`);
        console.log(`   Failed:      ${agentDetail.failedTasks} tasks`);
        if (agentDetail.lastActiveAt) {
          console.log(`   Last active: ${new Date(agentDetail.lastActiveAt).toLocaleString()}`);
        }
        if (agentDetail.currentTaskId) {
          console.log(`   Current task: ${agentDetail.currentTaskId}`);
        }
        const recentMsgs = agentMessenger.getRecent(50).filter(
          m => m.fromAgent === agentArg || m.toAgent === agentArg || m.toAgent === "all"
        ).slice(-10);
        if (recentMsgs.length > 0) {
          console.log(`\n   Recent Messages (${recentMsgs.length}):`);
          for (const msg of recentMsgs) {
            const ts   = new Date(msg.timestamp).toLocaleTimeString();
            const from = msg.fromAgent.toUpperCase().padEnd(10);
            const to   = msg.toAgent.toUpperCase().padEnd(10);
            console.log(`     [${ts}] ${from} → ${to} [${msg.type}]`);
            console.log(`       ${msg.content.slice(0, 100)}${msg.content.length > 100 ? "…" : ""}`);
          }
        } else {
          console.log("\n   No messages yet.");
        }
        console.log("");
        break;
      }

      // ── Legacy: devos agent "your goal" — multi-agent pipeline
      if (!goal) {
        console.log('Usage: ts-node index.ts agent <ceo|engineer|researcher|operator>');
        console.log('       ts-node index.ts agent "your goal"  (legacy pipeline)');
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
      await skillWarmup.preloadOnServe();
      const { dashboardServer } = await import("./dashboard/server");
      await dashboardServer.start();
      startAllTriggers();
      pilotScheduler.start();
      startApiServer(apiConfig.port);
      console.log("🖥  DevOS Control Plane running at http://localhost:3333");
      console.log("   Webhook server      at http://localhost:3001");
      console.log("   SSE event stream    at http://localhost:3333/api/stream");
      console.log(`   REST API            at http://localhost:${apiConfig.port}`);
      console.log(`   API Docs            at http://localhost:${apiConfig.port}/api/docs`);
      console.log("   Press Ctrl+C to stop");
      const onServeSig = () => {
        dashboardServer.stop();
        stopAllTriggers();
        pilotScheduler.stop();
        process.exit(0);
      };
      process.on("SIGINT",  onServeSig);
      process.on("SIGTERM", onServeSig);
      break;
    }

    // ── devos dashboard ───────────────────────────────────────
    case "dashboard": {
      const { execSync: execD } = require('child_process') as typeof import('child_process')
      const dashPath = path.join(process.cwd(), 'dashboard-next')
      console.log('[DevOS] 🖥️  Starting Next.js Mission Control at http://localhost:3000...')
      try {
        execD('npm run dev', { cwd: dashPath, stdio: 'inherit' })
      } catch (e: any) {
        console.error('[DevOS] Dashboard failed:', e.message ?? String(e))
      }
      break
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

    // ── devos company ─────────────────────────────────────────
    case "company": {
      if (!goal) {
        console.log('Usage: devos company "your objective"')
        break
      }
      const { companyManager } = await import('./devos/company/companyManager')
      console.log('🏢 Starting Company Mode...')
      const projectId = await companyManager.run(goal)
      console.log(`✅ Company project started: ${projectId}`)
      console.log(`   Monitor at: http://localhost:3333`)
      break
    }

    // ── devos evolve ──────────────────────────────────────────
    case "evolve": {
      const { skillEvolutionEngine } = await import('./devos/evolution/skillEvolutionEngine')
      console.log('🧬 Running Skill Evolution Engine...')
      const evolveResult = await skillEvolutionEngine.run()
      console.log(`✅ Evolution complete:`)
      console.log(`   Skills analyzed:  ${evolveResult.skillsAnalyzed}`)
      console.log(`   Skills improved:  ${evolveResult.skillsImproved}`)
      console.log(`   Skills deployed:  ${evolveResult.skillsDeployed}`)
      console.log(`   Skills discarded: ${evolveResult.skillsDiscarded}`)
      break
    }

    // ── devos memory [prune] ──────────────────────────────────
    case "memory": {
      const subCmd = goalArgs[0];
      const { executionMemory: em } = await import("./memory/executionMemory");

      if (subCmd === "prune") {
        const { memoryAging } = await import("./memory/memoryAging");
        const before = em.getAll().length;
        memoryAging.runAging(em);
        const after  = em.getAll().length;
        console.log(`\n🧹 Memory pruning complete: ${before} → ${after} entries (${before - after} removed)\n`);
        break;
      }

      // Default: show top 10 patterns
      const top = em.getTopPatterns(10);
      if (!top.length) {
        console.log("📭 No execution memory entries yet. Run some goals first.");
        break;
      }
      console.log(`\n🧠 Top Execution Memory Patterns (${em.getAll().length} total):\n`);
      for (const [i, e] of top.entries()) {
        const bar   = "█".repeat(Math.round(e.successRate * 10)) + "░".repeat(10 - Math.round(e.successRate * 10));
        const icon  = e.outcome === "success" ? "✅" : "❌";
        const ts    = new Date(e.timestamp).toLocaleDateString();
        console.log(`  ${(i + 1).toString().padStart(2)}. ${icon} [${bar}] ${(e.successRate * 100).toFixed(0)}%  used: ${e.useCount}x  ${ts}`);
        console.log(`      Pattern: "${e.pattern.slice(0, 65)}"`);
        console.log(`      Type: ${e.goalType} / ${e.domain}  Stack: ${e.stack.join(", ") || "—"}  Duration: ${(e.durationMs / 1000).toFixed(1)}s`);
      }
      console.log("");
      break;
    }

    // ── devos research <topic> ────────────────────────────────
    case "research": {
      if (!goal) {
        console.error('❌ Usage: ts-node index.ts research "your topic"');
        process.exit(1);
      }
      await assertOllamaReady();
      console.log(`\n🔍 Researching: "${goal}"\n`);

      const parsed = parseGoal(goal);
      const report = await researchEngine.research(goal, parsed);

      console.log("\n" + "═".repeat(60));
      console.log("📊 RESEARCH COMPLETE");
      console.log("═".repeat(60));
      console.log(`\nGoal:    ${report.goal}`);
      console.log(`Summary: ${report.summary}`);
      console.log(`\nKey Insights (${report.insights.length}):`);
      for (const [i, ins] of report.insights.entries()) {
        console.log(`  ${i + 1}. ${ins.point}`);
        if (ins.source) console.log(`     Source: ${ins.source}`);
      }
      if (report.sources.length > 0) {
        console.log(`\nSources (${report.sources.length}):`);
        for (const s of report.sources) console.log(`  - ${s}`);
      }
      console.log(`\n⏱  Duration: ${(report.durationMs / 1000).toFixed(1)}s`);
      console.log(`📄 Full report saved → workspace/research/\n`);
      break;
    }

    // ── devos sessions ───────────────────────────────────────
    case "sessions": {
      const { sessionManager } = await import("./core/sessionManager");
      const sessions = sessionManager.list();
      if (!sessions.length) {
        console.log("📭 No sessions found.");
        break;
      }
      console.log(`\n📋 Sessions (${sessions.length} total):\n`);
      const sorted = [...sessions].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      for (const s of sorted) {
        const icon = s.status === "completed" ? "✅"
          : s.status === "active"    ? "🔵"
          : s.status === "failed"    ? "❌"
          : s.status === "paused"    ? "⏸ "
          : "❓";
        const created = new Date(s.createdAt).toLocaleString();
        console.log(`  ${icon} [${s.status.padEnd(9)}] ${s.id}  ${created}`);
        console.log(`     Goal: "${s.goal.slice(0, 70)}"`);
      }
      console.log("");
      break;
    }

    // ── devos session <id> ────────────────────────────────────
    case "session": {
      const sessionId = goalArgs[0];
      if (!sessionId) {
        console.error("❌ Usage: ts-node index.ts session <sessionId>");
        process.exit(1);
      }
      const { sessionManager } = await import("./core/sessionManager");
      const sess = sessionManager.get(sessionId);
      if (!sess) {
        console.error(`❌ Session not found: ${sessionId}`);
        process.exit(1);
      }
      console.log(`\n📋 Session: ${sess.id}`);
      console.log(`   Status:    ${sess.status}`);
      console.log(`   Goal:      "${sess.goal}"`);
      console.log(`   Workspace: ${sess.workspacePath}`);
      console.log(`   Created:   ${new Date(sess.createdAt).toLocaleString()}`);
      console.log(`   Updated:   ${new Date(sess.updatedAt).toLocaleString()}`);
      console.log(`\n   History (${sess.history.length} entries):`);
      if (!sess.history.length) {
        console.log("     (empty)");
      } else {
        for (const h of sess.history) {
          const ts   = new Date(h.timestamp).toLocaleTimeString();
          const icon = h.role === "user" ? "👤" : "🤖";
          console.log(`     ${icon} [${ts}] ${h.role.padEnd(5)}: ${h.content.slice(0, 100)}`);
        }
      }
      if (sess.memoryRefs.length) {
        console.log(`\n   Memory refs: ${sess.memoryRefs.join(", ")}`);
      }
      console.log("");
      break;
    }

    // ── devos stop <taskId> ───────────────────────────────────
    case "stop": {
      const taskId = goalArgs[0];
      if (!taskId) {
        // No taskId — check if teach mode is recording
        if (teachMode.isRecording()) {
          const wf = teachMode.stopRecording()
          console.log(`\n📋 Saved workflow: "${wf.name}"`)
          console.log(`   Steps: ${wf.steps.length}`)
          console.log(`   ID:    ${wf.id}`)
          console.log(`\nRun it with: ts-node index.ts run workflow "${wf.name}"`)
        } else {
          console.error("❌ Usage: ts-node index.ts stop <taskId>")
        }
        break;
      }
      const { emergencyStop } = await import("./control/emergencyStop");
      await emergencyStop.stop(taskId);
      console.log(`\n⛔ Task ${taskId} stopped.`);
      break;
    }

    // ── devos resume <goalId> ─────────────────────────────────
    case "resume": {
      const goalId = goalArgs[0];
      if (!goalId) {
        console.error("❌ Usage: ts-node index.ts resume <goalId>");
        process.exit(1);
      }
      await assertOllamaReady();
      const { stateSnapshot, graphFromSnapshot } = await import("./devos/runtime/stateSnapshot");
      const { createGraphExecutor }              = await import("./core/graphExecutor");

      const snap = await stateSnapshot.load(goalId);
      if (!snap) {
        console.error(`❌ No snapshot found for goal: ${goalId}`);
        process.exit(1);
      }

      console.log(`\n♻️  Resuming goal: ${goalId}`);
      console.log(`   Workspace: ${snap.workspacePath}`);
      console.log(`   Snapshot:  ${new Date(snap.timestamp).toLocaleString()}`);

      const graph         = graphFromSnapshot(snap);
      const resumeEngine  = new DevOSEngine(workspace, dryRun);
      const graphExecutor = createGraphExecutor(
        (action: any, wp: string) => resumeEngine.executeOne(action, wp)
      );

      const result = await graphExecutor.execute(graph, snap.workspacePath);

      console.log(`\n${result.success ? "✅" : "❌"} Resume complete:`);
      console.log(`   Nodes completed: ${result.nodesCompleted}/${result.totalNodes}`);
      console.log(`   Duration: ${(result.durationMs / 1000).toFixed(1)}s`);

      if (result.success) {
        await stateSnapshot.delete(goalId);
        console.log("   Snapshot cleaned up.");
      }
      break;
    }

    // ── devos skills ──────────────────────────────────────────
    case "skills": {
      const all = skillIndex.getAll();
      if (!all.length) {
        console.log("📭 No skills indexed yet.");
        break;
      }

      // Group by tier
      const byTier: Record<string, typeof all> = {};
      for (const s of all) {
        (byTier[s.tier] ??= []).push(s);
      }

      console.log(`\n🛠  DevOS Skills (${all.length} total)\n`);
      const tierOrder = ["core", "domain", "generated"];
      for (const tier of tierOrder) {
        const skills = byTier[tier];
        if (!skills?.length) continue;
        console.log(`  ── ${tier.toUpperCase()} (${skills.length}) ──`);
        for (const s of skills) {
          const bar   = "█".repeat(Math.round(s.successRate * 10)).padEnd(10, "░");
          const rate  = (s.successRate * 100).toFixed(0).padStart(3);
          const usage = String(s.usageCount).padStart(4);
          console.log(`    ${bar} ${rate}%  runs: ${usage}  ${s.name}`);
        }
        console.log("");
      }
      break;
    }

    // ── devos cron ────────────────────────────────────────────
    case "cron": {
      const sub = goalArgs[0];

      if (sub === "list" || !sub) {
        const jobs = cronTrigger.list();
        if (!jobs.length) {
          console.log("📭 No cron jobs configured. Use: devos cron add \"<schedule>\" \"<goal>\"");
          break;
        }
        console.log(`\n⏰ Cron Jobs (${jobs.length}):\n`);
        for (const j of jobs) {
          const status = j.enabled ? "✅" : "⏸ ";
          const last   = j.lastRun ? new Date(j.lastRun).toLocaleString() : "never";
          console.log(`  ${status} [${j.id}]`);
          console.log(`     Schedule: ${j.schedule}`);
          console.log(`     Goal:     "${j.goal}"`);
          console.log(`     Last run: ${last}\n`);
        }
        break;
      }

      if (sub === "add") {
        const schedule = goalArgs[1];
        const cronGoal = goalArgs.slice(2).join(" ").trim();
        if (!schedule || !cronGoal) {
          console.error('❌ Usage: ts-node index.ts cron add "<schedule>" "<goal>"');
          console.error('   Example: ts-node index.ts cron add "0 9 * * *" "check github issues"');
          process.exit(1);
        }
        const id = cronTrigger.add({ schedule, goal: cronGoal, enabled: true });
        console.log(`\n✅ Cron job added: ${id}`);
        console.log(`   Schedule: ${schedule}`);
        console.log(`   Goal:     "${cronGoal}"\n`);
        break;
      }

      if (sub === "remove") {
        const id = goalArgs[1];
        if (!id) {
          console.error("❌ Usage: ts-node index.ts cron remove <id>");
          process.exit(1);
        }
        cronTrigger.remove(id);
        console.log(`\n✅ Cron job removed: ${id}\n`);
        break;
      }

      if (sub === "enable") {
        cronTrigger.enable(goalArgs[1] ?? "");
        console.log(`✅ Enabled: ${goalArgs[1]}`);
        break;
      }

      if (sub === "disable") {
        cronTrigger.disable(goalArgs[1] ?? "");
        console.log(`✅ Disabled: ${goalArgs[1]}`);
        break;
      }

      console.error(`❌ Unknown cron sub-command: ${sub}`);
      break;
    }

    // ── devos webhook ─────────────────────────────────────────
    case "webhook": {
      const sub = goalArgs[0];

      if (sub === "list" || !sub) {
        const hooks = webhookTrigger.list();
        if (!hooks.length) {
          console.log("📭 No webhooks registered. Use: devos webhook add <path> \"<goal>\"");
          break;
        }
        console.log(`\n🔗 Webhooks (${hooks.length}):\n`);
        for (const h of hooks) {
          const secured = h.secret ? " 🔒" : "";
          console.log(`  POST ${h.path}${secured}`);
          console.log(`       → "${h.goal}"\n`);
        }
        break;
      }

      if (sub === "add") {
        const webhookPath = goalArgs[1];
        const hookGoal    = goalArgs.slice(2).join(" ").trim();
        if (!webhookPath || !hookGoal) {
          console.error('❌ Usage: ts-node index.ts webhook add <path> "<goal>"');
          console.error('   Example: ts-node index.ts webhook add /webhook/deploy "deploy the app to production"');
          process.exit(1);
        }
        webhookTrigger.register(webhookPath, hookGoal);
        console.log(`\n✅ Webhook registered: POST ${webhookPath}`);
        console.log(`   Goal: "${hookGoal}"\n`);
        break;
      }

      console.error(`❌ Unknown webhook sub-command: ${sub}`);
      break;
    }

    // ── devos knowledge ───────────────────────────────────────
    case "knowledge": {
      const sub     = goalArgs[0];
      const kTarget = goalArgs.slice(1).join(" ").trim();

      // devos knowledge ingest <filePath|url>
      if (sub === "ingest") {
        if (!kTarget) {
          console.error("❌ Usage: ts-node index.ts knowledge ingest <filePath|url>");
          process.exit(1);
        }
        console.log(`\n📥 Ingesting: "${kTarget}"\n`);
        if (kTarget.startsWith("http://") || kTarget.startsWith("https://")) {
          const id    = await ingestionEngine.ingestUrl(kTarget);
          const entry = knowledgeStore.get(id);
          if (entry) {
            console.log(`✅ Ingested URL: ${entry.title}`);
            console.log(`   Chunks: ${entry.chunks.length}  Tags: ${entry.tags.join(", ")}`);
          } else {
            console.log("⚠️  Nothing ingested from URL.");
          }
        } else {
          const id    = await ingestionEngine.ingest(kTarget);
          const entry = knowledgeStore.get(id);
          if (entry) {
            console.log(`✅ Ingested: ${entry.title}`);
            console.log(`   Chunks: ${entry.chunks.length}  Tags: ${entry.tags.join(", ")}`);
          } else {
            console.log("⚠️  Nothing ingested (unsupported type or empty file).");
          }
        }
        break;
      }

      // devos knowledge query "<question>"
      if (sub === "query") {
        if (!kTarget) {
          console.error('❌ Usage: ts-node index.ts knowledge query "<question>"');
          process.exit(1);
        }
        console.log(`\n🔍 Querying knowledge: "${kTarget}"\n`);
        const result = await knowledgeQuery.query(kTarget);
        console.log(`📖 Answer (confidence: ${(result.confidence * 100).toFixed(0)}%):`);
        console.log(`   ${result.answer}`);
        if (result.sources.length > 0) {
          console.log(`\n📚 Sources (${result.sources.length}):`);
          for (const s of result.sources) {
            console.log(`   • [${s.id.slice(0, 8)}] ${s.title}  (${s.source})`);
          }
        }
        console.log("");
        break;
      }

      // devos knowledge list (default)
      {
        const all = knowledgeStore.list();
        if (!all.length) {
          console.log("📭 Knowledge store is empty. Run: devos knowledge ingest <file>");
          break;
        }
        console.log(`\n🧠 Knowledge Store (${all.length} entries)\n`);
        const sorted = [...all].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        for (const e of sorted) {
          const date  = new Date(e.updatedAt).toLocaleDateString();
          const tags  = e.tags.slice(0, 4).join(", ") || "—";
          const hits  = `access: ${e.accessCount}`;
          console.log(`  [${e.id.slice(0, 8)}] ${e.title}`);
          console.log(`           source: ${e.source}  chunks: ${e.chunks.length}  ${hits}  ${date}`);
          console.log(`           tags:   ${tags}`);
        }
        console.log("");
        break;
      }
    }

    // ── devos github ──────────────────────────────────────────
    case "github": {
      const sub = goalArgs[0];

      if (sub === "issues" || !sub) {
        let cfg: any = {};
        try { cfg = JSON.parse(fs.readFileSync("config/integrations.json", "utf-8")); } catch {}
        const repo  = goalArgs[1] ?? cfg?.github?.defaultRepo ?? "";
        const state = (goalArgs[2] as "open" | "closed" | "all") ?? "open";

        if (!repo) {
          console.error("❌ Usage: ts-node index.ts github issues <owner/repo> [open|closed|all]");
          console.error("   Or set defaultRepo in config/integrations.json");
          process.exit(1);
        }

        console.log(`\n🐙 GitHub Issues — ${repo} (${state})\n`);
        try {
          const issues = await github.listIssues(repo, state);
          if (!issues.length) {
            console.log(`  No ${state} issues found.`);
          } else {
            for (const issue of issues) {
              const labels = issue.labels.length ? `  [${issue.labels.join(", ")}]` : "";
              const date   = new Date(issue.createdAt).toLocaleDateString();
              console.log(`  #${String(issue.id).padEnd(5)} [${issue.state}] ${issue.title}${labels}`);
              console.log(`           created: ${date}`);
            }
          }
          console.log(`\n  Total: ${issues.length} issue(s)\n`);
        } catch (err: any) {
          console.error(`❌ GitHub error: ${err.message}`);
          console.error("   Set GITHUB_TOKEN env var or token in config/integrations.json");
        }
        break;
      }

      console.error(`❌ Unknown github sub-command: ${sub}`);
      console.error("   Available: issues");
      break;
    }

    // ── devos pilot ───────────────────────────────────────────
    case "pilot": {
      const sub      = goalArgs[0];
      const pilotId  = goalArgs[1] ?? "";

      // devos pilot list
      if (sub === "list" || !sub) {
        const all = pilotRegistry.list();
        if (!all.length) {
          console.log("📭 No pilots configured. Add JSON files to config/pilots/");
          break;
        }
        console.log(`\n🤖 Pilots (${all.length})\n`);
        for (const p of all) {
          const statusIcon  = p.enabled ? "✅" : "⏸ ";
          const lastRun     = pilotExecutor.getLastRun(p.id);
          const lastRunStr  = lastRun
            ? `last: ${new Date(lastRun.startedAt).toLocaleString()} [${lastRun.status}]`
            : "never run";
          console.log(`  ${statusIcon} [${p.id}]  ${p.name}`);
          console.log(`           schedule: ${p.schedule ?? "—"}  output: ${p.outputFormat}`);
          console.log(`           ${lastRunStr}\n`);
        }
        break;
      }

      // devos pilot run <id>
      if (sub === "run") {
        if (!pilotId) {
          console.error("❌ Usage: ts-node index.ts pilot run <id>");
          process.exit(1);
        }
        const manifest = pilotRegistry.get(pilotId);
        if (!manifest) {
          console.error(`❌ Pilot not found: ${pilotId}`);
          process.exit(1);
        }
        console.log(`\n▶️  Running pilot: ${manifest.name}\n`);
        const run = await pilotExecutor.run(pilotId);
        const dur = run.completedAt
          ? `${((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000).toFixed(1)}s`
          : "—";
        const icon = run.status === "completed" ? "✅" : "❌";
        console.log(`\n${icon} Pilot run ${run.id}: ${run.status} in ${dur}`);
        if (run.error) console.error(`   Error: ${run.error}`);
        break;
      }

      // devos pilot enable <id>
      if (sub === "enable") {
        if (!pilotId) { console.error("❌ Usage: ts-node index.ts pilot enable <id>"); process.exit(1); }
        pilotRegistry.enable(pilotId);
        console.log(`✅ Pilot enabled: ${pilotId}`);
        break;
      }

      // devos pilot disable <id>
      if (sub === "disable") {
        if (!pilotId) { console.error("❌ Usage: ts-node index.ts pilot disable <id>"); process.exit(1); }
        pilotRegistry.disable(pilotId);
        console.log(`⏸  Pilot disabled: ${pilotId}`);
        break;
      }

      // devos pilot history <id>
      if (sub === "history") {
        if (!pilotId) { console.error("❌ Usage: ts-node index.ts pilot history <id>"); process.exit(1); }
        const history = pilotExecutor.getHistory(pilotId).slice(0, 5);
        if (!history.length) {
          console.log(`📭 No runs found for pilot: ${pilotId}`);
          break;
        }
        const manifest = pilotRegistry.get(pilotId);
        console.log(`\n📋 Pilot History: ${manifest?.name ?? pilotId} (last 5)\n`);
        for (const run of history) {
          const dur     = run.completedAt
            ? `${((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000).toFixed(1)}s`
            : "running";
          const icon    = run.status === "completed" ? "✅" : run.status === "failed" ? "❌" : "⏳";
          const started = new Date(run.startedAt).toLocaleString();
          console.log(`  ${icon} [${run.id}] ${run.status}  ${dur}  ${started}`);
          if (run.error) console.log(`       Error: ${run.error}`);
        }
        console.log("");
        break;
      }

      console.error(`❌ Unknown pilot sub-command: ${sub}`);
      console.error("   Available: list, run, enable, disable, history");
      break;
    }

    // ── devos blueprints ──────────────────────────────────────
    case "blueprints": {
      const bps = blueprintRegistry.list();
      if (!bps.length) {
        console.log("📭 No blueprints found in config/blueprints/");
        break;
      }
      console.log(`\n📐 Available Blueprints (${bps.length})\n`);
      for (const bp of bps) {
        console.log(`  [${bp.id}]  ${bp.name}  v${bp.version}`);
        console.log(`           ${bp.description}`);
        console.log(`           Modules: ${bp.modules.join(" → ")}`);
        const stackStr = Object.entries(bp.stack).map(([k,v]) => `${k}:${v}`).join("  ");
        console.log(`           Stack:   ${stackStr}`);
        console.log(`           Criteria: ${bp.successCriteria.join(", ")}\n`);
      }
      break;
    }

    // ── devos products ────────────────────────────────────────
    case "products": {
      const builds = productManager.list();
      if (!builds.length) {
        console.log("📭 No product builds yet. Run: devos build \"your goal\"");
        break;
      }
      console.log(`\n🏗️  Product Builds (${builds.length})\n`);
      for (const b of builds) {
        const statusIcon = b.status === "completed" ? "✅"
          : b.status === "failed"    ? "❌"
          : b.status === "building"  ? "⚙️ "
          : "📋";
        const date = new Date(b.startedAt).toLocaleString();
        const dur  = b.completedAt
          ? `${((new Date(b.completedAt).getTime() - new Date(b.startedAt).getTime()) / 1000).toFixed(1)}s`
          : "running";
        console.log(`  ${statusIcon} [${b.id}] ${b.blueprintId}  (${dur})`);
        console.log(`           Goal:      "${b.goal.slice(0, 70)}"`);
        console.log(`           Started:   ${date}`);
        console.log(`           Completed: ${b.modulesCompleted.join(", ") || "—"}`);
        if (b.modulesFailed.length) {
          console.log(`           Failed:    ${b.modulesFailed.join(", ")}`);
        }
        console.log(`           Workspace: ${b.workspacePath}\n`);
      }
      break;
    }

    // ── devos build "<goal>" ──────────────────────────────────
    case "build": {
      if (!goal) {
        console.error('❌ Usage: ts-node index.ts build "your product goal"');
        console.error('   Example: ts-node index.ts build "build a SaaS web app with auth and billing"');
        process.exit(1);
      }

      console.log(`\n🏗️  DevOS Product Builder`);
      console.log(`   Goal: "${goal}"\n`);

      // Match blueprint
      const { parseGoal: pg } = await import("./core/goalParser");
      const parsed = pg(goal);
      const bp = blueprintRegistry.match({ ...parsed, goal });

      if (!bp) {
        console.error("❌ No matching blueprint found for this goal.");
        console.error("   Available blueprints: devos blueprints");
        console.error("   Or run: devos run \"" + goal + "\" (LLM-planned execution)");
        process.exit(1);
      }

      console.log(`📐 Blueprint matched: ${bp.name} [${bp.id}]`);
      console.log(`   Modules: ${bp.modules.join(" → ")}\n`);

      // Workspace for this build
      const buildDir = path.join(process.cwd(), "workspace", "builds", bp.id + "_" + Date.now());
      fs.mkdirSync(buildDir, { recursive: true });

      // Generate
      const build = await productGenerator.generate(goal, bp.id, buildDir);

      if (build.status === "completed") {
        console.log(`\n✅ Build complete!`);
        console.log(`   Workspace: ${buildDir}`);
        console.log(`   Modules:   ${build.modulesCompleted.join(", ")}`);

        // Deploy locally
        console.log("\n🚀 Deploying locally...");
        const deploy = await deploymentOrchestrator.deploy(build, "local");
        if (deploy.success) {
          console.log(`\n✅ Ready! Start your app:`);
          console.log(`   cd "${buildDir}"`);
          console.log(`   npm install && node server.js`);
          console.log(`   Then open: ${deploy.url}`);
        } else {
          console.log(`⚠️  Deployment note: ${deploy.error}`);
        }
      } else {
        console.error(`\n❌ Build failed. Modules failed: ${build.modulesFailed.join(", ")}`);
        console.error(`   Workspace: ${buildDir}`);
      }
      console.log("");
      break;
    }

    // ── devos goal "<title>" "<description>" | goal status <id> ─
    case "goal": {
      const sub = goalArgs[0];

      // devos goal status <id>
      if (sub === "status") {
        const goalId = goalArgs[1];
        if (!goalId) {
          console.error("❌ Usage: ts-node index.ts goal status <id>");
          process.exit(1);
        }
        const status = await goalEngine.getStatus(goalId);
        if (!status.goal) {
          console.error(`❌ Goal not found: ${goalId}`);
          process.exit(1);
        }
        const { goal: g, projects, tasks } = status;
        const statusIcon = g.status === "completed" ? "✅"
          : g.status === "failed"    ? "❌"
          : g.status === "active"    ? "🔵"
          : g.status === "paused"    ? "⏸ "
          : g.status === "planning"  ? "🧠"
          : "⏳";
        console.log(`\n${statusIcon} Goal: ${g.title}`);
        console.log(`   ID:          ${g.id}`);
        console.log(`   Status:      ${g.status}`);
        console.log(`   Description: ${g.description}`);
        console.log(`   Created:     ${new Date(g.createdAt).toLocaleString()}`);
        if (g.completedAt) console.log(`   Completed:   ${new Date(g.completedAt).toLocaleString()}`);
        console.log(`\n   Projects (${projects.length}):`);
        for (const p of projects) {
          const pIcon = p.status === "completed" ? "✅" : p.status === "failed" ? "❌" : p.status === "active" ? "🔵" : "⏳";
          const ptasks = tasks.filter(t => t.projectId === p.id);
          console.log(`   ${pIcon} [${p.order}] ${p.title}  (${ptasks.length} tasks, ${p.status})`);
          for (const t of ptasks) {
            const tIcon = t.status === "completed" ? "✅" : t.status === "failed" ? "❌" : t.status === "active" ? "▶ " : "·";
            console.log(`      ${tIcon} [p${t.priority}] ${t.title}  [${t.status}]`);
            if (t.error) console.log(`           ↳ Error: ${t.error}`);
          }
        }
        console.log("");
        break;
      }

      // devos goal "<title>" "<description>"
      const titleArg = sub;
      const descArg  = goalArgs[1];
      if (!titleArg || !descArg) {
        console.error('❌ Usage: ts-node index.ts goal "<title>" "<description>"');
        process.exit(1);
      }
      await assertOllamaReady();
      console.log(`\n🎯 Starting goal: "${titleArg}"\n`);
      const finalGoal = await goalEngine.run(titleArg, descArg);
      const icon = finalGoal.status === "completed" ? "✅" : "❌";
      console.log(`\n${icon} Goal finished: ${finalGoal.status}`);
      console.log(`   ID:       ${finalGoal.id}`);
      console.log(`   Projects: ${finalGoal.projects.length}`);
      break;
    }

    // ── devos goals ───────────────────────────────────────────
    case "goals": {
      const all = await goalEngine.list();
      if (!all.length) {
        console.log("📭 No goals yet. Run: ts-node index.ts goal \"<title>\" \"<description>\"");
        break;
      }
      console.log(`\n🎯 Goals (${all.length})\n`);
      for (const g of [...all].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())) {
        const icon = g.status === "completed" ? "✅"
          : g.status === "failed"   ? "❌"
          : g.status === "active"   ? "🔵"
          : g.status === "paused"   ? "⏸ "
          : g.status === "planning" ? "🧠"
          : "⏳";
        const date = new Date(g.createdAt).toLocaleDateString();
        console.log(`  ${icon} [${g.status.padEnd(9)}] ${g.id.slice(0, 12)}  ${date}  Projects: ${g.projects.length}`);
        console.log(`           "${g.title}"`);
      }
      console.log("");
      break;
    }

    // ── devos agents ──────────────────────────────────────────
    case "agents": {
      // ── devos agents personal — background agent list ──────
      if (rawArgs[0]?.toLowerCase() === 'personal') {
        const bgAgents = backgroundAgents.listAgents()
        console.log(`\n🤖 Background Agents (${bgAgents.length})\n`)
        console.log('  ' + 'Name'.padEnd(22) + 'Status'.padEnd(12) + 'Schedule')
        console.log('  ' + '─'.repeat(50))
        for (const a of bgAgents) {
          const icon = a.status === 'enabled' ? '✅' : '⏸ '
          console.log(`  ${icon} ${a.name.padEnd(20)} ${a.status.padEnd(12)} ${a.schedule}`)
        }
        console.log('')
        break
      }
      // ── devos agents — agent registry list ────────────────
      const all = agentRegistry.list();
      console.log(`\n🤖 Agent Layer (${all.length} agents)\n`);
      for (const a of all) {
        const statusIcon = a.status === "idle"      ? "💤"
          : a.status === "thinking"  ? "🧠"
          : a.status === "executing" ? "⚙️ "
          : a.status === "waiting"   ? "⏳"
          : "❌";
        const lastActive = a.lastActiveAt
          ? new Date(a.lastActiveAt).toLocaleString()
          : "never";
        const successRate = a.completedTasks + a.failedTasks > 0
          ? `${((a.completedTasks / (a.completedTasks + a.failedTasks)) * 100).toFixed(0)}%`
          : "n/a";
        console.log(`  ${statusIcon} [${a.role.padEnd(10)}] ${a.name}`);
        console.log(`           Status:   ${a.status}  |  Done: ${a.completedTasks}  Failed: ${a.failedTasks}  Rate: ${successRate}`);
        console.log(`           Tools:    ${a.tools.join(", ")}`);
        console.log(`           Active:   ${lastActive}`);
        if (a.currentTaskId) console.log(`           Task:     ${a.currentTaskId}`);
        console.log("");
      }
      break;
    }

    // ── devos coordinate "<title>" "<description>" ────────────
    case "coordinate": {
      const titleArg = goalArgs[0];
      const descArg  = goalArgs[1];
      if (!titleArg || !descArg) {
        console.error('❌ Usage: ts-node index.ts coordinate "<title>" "<description>"');
        process.exit(1);
      }
      await assertOllamaReady();
      console.log(`\n🔄 Starting multi-agent coordination: "${titleArg}"\n`);

      // Create + plan goal first, then run coordination loop
      const coordGoal = goalStore.createGoal(titleArg, descArg);
      console.log(`[Coordinate] 🎯 Goal created: ${coordGoal.id}`);

      const { goalPlanner } = await import("./goals/goalPlanner");
      await goalPlanner.plan(coordGoal.id);

      await coordinationLoop.start(coordGoal.id);

      const finalCoordGoal = goalStore.getGoal(coordGoal.id)!;
      const coordIcon = finalCoordGoal.status === "completed" ? "✅" : "❌";
      console.log(`\n${coordIcon} Coordination finished: ${finalCoordGoal.status}`);
      console.log(`   ID:       ${finalCoordGoal.id}`);
      console.log(`   Projects: ${finalCoordGoal.projects.length}`);
      console.log(`   Run: ts-node index.ts goal status ${finalCoordGoal.id}`);
      break;
    }

    // ── devos api ─────────────────────────────────────────────
    case "api": {
      const apiSub = goalArgs[0];

      // devos api keygen <role> <label>
      if (apiSub === "keygen") {
        const role  = goalArgs[1] as "admin" | "automation" | "read-only";
        const label = goalArgs.slice(2).join(" ") || "unnamed";
        if (!["admin", "automation", "read-only"].includes(role)) {
          console.log("Usage: ts-node index.ts api keygen <admin|automation|read-only> <label>");
          process.exit(1);
        }
        const key = generateApiKey(role, label);
        console.log(`\n✅ API Key generated:`);
        console.log(`   Key:   ${key}`);
        console.log(`   Role:  ${role}`);
        console.log(`   Label: ${label}`);
        console.log(`\n   Add to requests: Authorization: Bearer ${key}`);
        console.log(`   ⚠️  Save this key — it will not be shown again\n`);
        break;
      }

      // devos api  — print endpoint listing
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║              DevOS REST API  (port ${apiConfig.port})               ║
╚══════════════════════════════════════════════════════════════╝

Start the API:  ts-node index.ts serve
Docs:           http://localhost:${apiConfig.port}/api/docs

Goals
  POST   /api/goals                   Submit a goal { goal, async? }
  GET    /api/goals                   List recent goals (last 20)
  GET    /api/goals/:id               Get goal detail (status, plan, result)
  DELETE /api/goals/:id               Cancel a running goal
  POST   /api/goals/:id/retry         Retry a failed goal

Pilots
  GET    /api/pilots                  List all pilots with status + last run
  GET    /api/pilots/:id              Get pilot detail + last 5 runs
  POST   /api/pilots/:id/run          Trigger pilot immediately
  POST   /api/pilots/:id/enable       Enable a pilot
  POST   /api/pilots/:id/disable      Disable a pilot
  GET    /api/pilots/:id/history      Full run history for a pilot
  PUT    /api/pilots/:id              Update pilot manifest fields

Knowledge
  GET    /api/knowledge               List all knowledge entries
  POST   /api/knowledge/ingest        Ingest { filePath } | { url } | { text, title }
  POST   /api/knowledge/query         Query { question } → { answer, sources, confidence }
  GET    /api/knowledge/:id           Get specific knowledge entry
  DELETE /api/knowledge/:id           Delete a knowledge entry

Memory
  GET    /api/memory                  List all execution memory entries
  GET    /api/memory/stats            { totalEntries, successRate, topPatterns }
  DELETE /api/memory/prune            Prune low-quality entries
  GET    /api/memory/:goalType        Entries for a specific goal type

System
  GET    /api/system/health           Health check (no auth required)
  GET    /api/system/status           Full status: goals, pilots, memory, knowledge
  POST   /api/system/stop             Emergency stop all running goals
  GET    /api/system/sessions         Recent agent sessions
  GET    /api/system/skills           All indexed skills
  GET    /api/system/blueprints       All product blueprints
  GET    /api/system/audit            Audit log — last 50 entries (admin only)

Streaming (SSE)
  GET    /api/stream                  All DevOS events
  GET    /api/stream/goals/:id        Events for a specific goal

Docs
  GET    /api/docs                    OpenAPI 3.0 spec (JSON)

Auth & Keys
  devos api keygen <role> <label>     Generate a hashed API key
  Roles: admin | automation | read-only
  Pass as: Authorization: Bearer <key>
  Empty key = dev mode (no auth required).
`);
      break;
    }

    // ── devos install ─────────────────────────────────────────
    case "install": {
      await runInstaller();
      break;
    }

    // ── devos mission "<goal>" | mission status|pause|resume|cancel <id> ─
    case "mission": {
      const { autonomousMission } = await import('./coordination/autonomousMission')
      const { missionState: ms }  = await import('./coordination/missionState')
      const { missionTodo: mt }   = await import('./coordination/missionTodo')
      const { eventBus: eb }      = await import('./core/eventBus')

      const sub = goalArgs[0]

      // devos mission status <id>
      if (sub === 'status') {
        const mId = goalArgs[1]
        if (!mId) { console.error('❌ Usage: ts-node index.ts mission status <id>'); process.exit(1) }
        const m = ms.loadMission(mId)
        if (!m) { console.error(`❌ Mission not found: ${mId}`); process.exit(1) }
        console.log(`\n🚀 Mission: ${m.goal}`)
        console.log(`   ID:      ${m.id}`)
        console.log(`   Status:  ${m.status}`)
        console.log(`   Type:    ${m.type}`)
        console.log(`   Tasks:   ${m.tasksDone}/${m.tasksTotal} done  ${m.tasksFailed} failed`)
        console.log(`   Loops:   ${m.loopCount}`)
        console.log(`   Started: ${new Date(m.startedAt).toLocaleString()}`)
        if (m.completedAt) console.log(`   Ended:   ${new Date(m.completedAt).toLocaleString()}`)
        const todo = mt.readTodo(m.id)
        if (todo) { console.log(`\n${todo}`) }
        break
      }

      // devos mission pause <id>
      if (sub === 'pause') {
        const mId = goalArgs[1]
        if (!mId) { console.error('❌ Usage: ts-node index.ts mission pause <id>'); process.exit(1) }
        autonomousMission.pauseMission(mId)
        console.log(`⏸  Mission paused: ${mId}`)
        break
      }

      // devos mission resume <id>
      if (sub === 'resume') {
        const mId = goalArgs[1]
        if (!mId) { console.error('❌ Usage: ts-node index.ts mission resume <id>'); process.exit(1) }
        await assertOllamaReady()
        autonomousMission.resumeMission(mId).catch(() => {})
        console.log(`▶️  Mission resuming: ${mId}`)
        break
      }

      // devos mission cancel <id>
      if (sub === 'cancel') {
        const mId = goalArgs[1]
        if (!mId) { console.error('❌ Usage: ts-node index.ts mission cancel <id>'); process.exit(1) }
        autonomousMission.cancelMission(mId)
        console.log(`🚫 Mission cancelled: ${mId}`)
        break
      }

      // devos mission "<goal>" — start new mission, stream liveThinking to terminal
      const missionGoal = goalArgs.join(' ').trim()
      if (!missionGoal) {
        console.error('❌ Usage: ts-node index.ts mission "<goal>"')
        console.error('         ts-node index.ts mission status|pause|resume|cancel <id>')
        process.exit(1)
      }
      await assertOllamaReady()

      // Stream liveThinking events to terminal
      eb.on('agent_thinking', (evt: any) => {
        const icon = evt.type === 'thinking' ? '🧠'
          : evt.type === 'acting'   ? '⚙️ '
          : evt.type === 'done'     ? '✅'
          : '❌'
        console.log(`  ${icon} [${String(evt.agent).toUpperCase()}] ${evt.message}`)
      })

      console.log(`\n🚀 Starting mission: "${missionGoal}"\n`)
      const mResult = await autonomousMission.startMission(missionGoal, missionGoal)
      const mIcon = mResult.status === 'complete' ? '✅' : mResult.status === 'failed' ? '❌' : '⏸ '
      console.log(`\n${mIcon} Mission ${mResult.status}: ${mResult.goal}`)
      console.log(`   ID:    ${mResult.id}`)
      console.log(`   Tasks: ${mResult.tasksDone}/${mResult.tasksTotal} done`)
      console.log(`   Run:   ts-node index.ts mission status ${mResult.id}\n`)
      break
    }

    // ── devos missions — list all missions ─────────────────────
    case "missions": {
      const { missionState: ms2 } = await import('./coordination/missionState')
      const all = ms2.listMissions()
      if (!all.length) {
        console.log('📭 No missions yet. Run: ts-node index.ts mission "<your goal>"')
        break
      }
      console.log(`\n🚀 Missions (${all.length})\n`)
      for (const m of all) {
        const icon = m.status === 'complete'   ? '✅'
          : m.status === 'failed'    ? '❌'
          : m.status === 'active'    ? '🔵'
          : m.status === 'paused'    ? '⏸ '
          : m.status === 'cancelled' ? '🚫'
          : '⏳'
        const date = new Date(m.startedAt).toLocaleDateString()
        console.log(`  ${icon} [${m.status.padEnd(9)}] ${m.id.slice(0, 12)}  ${date}  ${m.tasksDone}/${m.tasksTotal} tasks`)
        console.log(`           "${m.goal}"`)
      }
      console.log('')
      break
    }

    // ── devos chat ["<message>"] — interactive or single-shot chat ──
    case "chat": {
      const message = rawArgs.join(' ').trim()

      if (message) {
        // Single-shot mode: devos chat "what can you do"
        process.stdout.write('\nDevOS: ')
        for await (const chunk of dialogueEngine.chat(message)) {
          process.stdout.write(chunk)
        }
        process.stdout.write('\n\n')
      } else {
        // REPL mode: interactive loop
        const readline = await import('readline')
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
        console.log('\n🤖 DevOS Chat — type your message or "exit" to quit\n')

        const prompt = () => {
          rl.question('You: ', async (input: string) => {
            const text = input.trim()
            if (!text) { prompt(); return }
            if (text === 'exit' || text === 'quit') { rl.close(); return }

            process.stdout.write('DevOS: ')
            for await (const chunk of dialogueEngine.chat(text)) {
              process.stdout.write(chunk)
            }
            process.stdout.write('\n\n')
            prompt()
          })
        }
        prompt()
        await new Promise<void>(resolve => rl.on('close', resolve))
      }
      break
    }

    // ── devos profile [reset | pilots on|off] ─────────────────
    case "profile": {
      const sub = rawArgs[0]?.toLowerCase()

      if (sub === 'reset') {
        userProfile.reset()
        conversationMemory.clear()
        console.log('🔄 Profile and conversation memory cleared. Next run will trigger onboarding.')
        break
      }

      if (sub === 'pilots') {
        const onOff = rawArgs[1]?.toLowerCase()
        if (onOff === 'on' || onOff === 'off') {
          const p = userProfile.patch({ pilotsEnabled: onOff === 'on' })
          console.log(`⚡ Pilots ${p.pilotsEnabled ? 'enabled' : 'disabled'}.`)
        } else {
          console.error('Usage: ts-node index.ts profile pilots on|off')
        }
        break
      }

      // Default: print profile
      const profile = userProfile.loadProfile()
      const facts   = conversationMemory.getFacts()
      console.log('\n👤 DevOS User Profile\n')
      console.log(`  Name:           ${profile.name ?? '(not set)'}`)
      console.log(`  Primary Goal:   ${profile.primaryGoal ?? '(not set)'}`)
      console.log(`  Experience:     ${profile.experience ?? '(not set)'}`)
      console.log(`  Stack:          ${profile.preferredStack ?? '(not set)'}`)
      console.log(`  Pilots:         ${profile.pilotsEnabled ? '✅ enabled' : '❌ disabled'}`)
      console.log(`  Onboarding:     ${profile.onboardingDone ? '✅ done' : '⏳ pending'}`)
      console.log(`  First seen:     ${new Date(profile.firstSeenAt).toLocaleString()}`)
      console.log(`  Last seen:      ${new Date(profile.lastSeenAt).toLocaleString()}`)
      console.log(`  Total goals:    ${profile.totalGoals}`)
      if (profile.recentGoalTypes.length > 0) {
        console.log(`  Recent goals:   ${profile.recentGoalTypes.slice(-3).join(' | ')}`)
      }
      if (facts.length > 0) {
        console.log(`\n📌 Extracted Facts (${facts.length}):`)
        facts.slice(-5).forEach(f => console.log(`  • ${f.fact}`))
      }
      console.log('')
      break
    }

    // ── devos personal — switch to personal mode ──────────────
    case "personal": {
      const envFile = path.join(process.cwd(), '.env')
      let envContent = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf-8') : ''
      if (envContent.includes('DEVOS_MODE=')) {
        envContent = envContent.replace(/DEVOS_MODE=.*/g, 'DEVOS_MODE=personal')
      } else {
        envContent += '\nDEVOS_MODE=personal\n'
      }
      fs.writeFileSync(envFile, envContent)
      console.log('🎯 Switched to Personal mode. Restart DevOS to apply.')
      break
    }

    // ── devos builder — switch to builder mode ─────────────────
    case "builder": {
      const envFile2 = path.join(process.cwd(), '.env')
      let envContent2 = fs.existsSync(envFile2) ? fs.readFileSync(envFile2, 'utf-8') : ''
      if (envContent2.includes('DEVOS_MODE=')) {
        envContent2 = envContent2.replace(/DEVOS_MODE=.*/g, 'DEVOS_MODE=builder')
      } else {
        envContent2 += '\nDEVOS_MODE=builder\n'
      }
      fs.writeFileSync(envFile2, envContent2)
      console.log('🔨 Switched to Builder mode.')
      break
    }

    // ── devos briefing — generate morning briefing ─────────────
    case "briefing": {
      console.log('\n🌅 Generating your morning briefing...\n')
      const text = await morningBriefing.generate()
      console.log(text)
      console.log('')
      break
    }

    // ── devos teach "<name>" — start recording a workflow ──────
    case "teach": {
      const workflowName = rawArgs.join(' ').trim()
      if (!workflowName) {
        console.error('❌ Usage: ts-node index.ts teach "<workflow name>"')
        break
      }
      teachMode.startRecording(workflowName)
      break
    }

    // ── devos telegram setup|test|status ─────────────────────
    case "telegram": {
      const sub = rawArgs[0]?.toLowerCase()

      if (!sub || sub === 'setup') {
        console.log(`
Telegram Bot Setup
──────────────────
1. Open Telegram and message @BotFather
2. Send /newbot and follow the prompts to create your bot
3. Copy the bot token
4. Open config/integrations.json
5. Set: "botToken": "<your-token>"
6. Set: "allowedUserIds": [<your-telegram-user-id>]
   (Get your ID by messaging @userinfobot on Telegram)
7. Set: "enabled": true
8. Restart DevOS

When running devos serve, DevOS will:
  • Poll for Telegram messages
  • Notify you on goal/mission completions
  • Route dangerous action approvals through inline buttons
        `.trim())
        break
      }

      if (sub === 'status') {
        const cfgPath = path.join(process.cwd(), 'config/integrations.json')
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')).telegram || {}
        const maskedToken = cfg.botToken
          ? '...' + String(cfg.botToken).slice(-6)
          : '(not set)'
        console.log('\n📱 Telegram Config\n')
        console.log(`  Enabled:                 ${cfg.enabled ?? false}`)
        console.log(`  Bot Token:               ${maskedToken}`)
        console.log(`  Allowed User IDs:        ${cfg.allowedUserIds?.length ? cfg.allowedUserIds.join(', ') : '(none — open access)'}`)
        console.log(`  Notify on Goal:          ${cfg.notifyOnGoalComplete ?? false}`)
        console.log(`  Notify on Mission:       ${cfg.notifyOnMissionComplete ?? false}`)
        console.log(`  Notify on Pilot:         ${cfg.notifyOnPilotComplete ?? false}`)
        console.log(`  Approval for Dangerous:  ${cfg.requireApprovalForDangerous ?? false}`)
        console.log('')
        if (!cfg.enabled) {
          console.log('  ⚠️  Telegram is disabled. Run: ts-node index.ts telegram setup')
        }
        break
      }

      if (sub === 'test') {
        const cfgPath = path.join(process.cwd(), 'config/integrations.json')
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')).telegram || {}
        if (!cfg.enabled || !cfg.botToken) {
          console.log('⚠️  Telegram is not enabled. Run: ts-node index.ts telegram setup')
          break
        }
        console.log('📱 Starting Telegram bot to send test message...')
        const { telegramBot: tb } = await import('./integrations/telegram/telegramBot')
        await tb.start()
        const chatId = tb.getPrimaryChatId()
        if (!chatId) {
          console.log('⚠️  No allowedUserIds set. Add your user ID to config/integrations.json')
          tb.stop()
          break
        }
        const bot = tb.getBot()
        await bot.sendMessage(chatId, 'DevOS connected ✅')
        console.log('✅ Test message sent!')
        tb.stop()
        break
      }

      console.error(`❌ Unknown telegram sub-command: ${sub}. Try: setup, status, test`)
      break
    }

    // ── devos sandbox ─────────────────────────────────────────
    case "sandbox": {
      const sub = rawArgs[0]?.toLowerCase()
      const { sandboxManager } = await import('./sandbox/sandboxManager')

      if (sub === 'status' || !sub) {
        const sandboxes = sandboxManager.listActiveSandboxes()
        const enabled   = process.env.DEVOS_SANDBOX === 'true'
        console.log(`\n🐳 Docker Sandbox\n`)
        console.log(`  Mode:   ${enabled ? '✅ ENABLED (DEVOS_SANDBOX=true)' : '⚠️  DISABLED (set DEVOS_SANDBOX=true to enable)'}`)
        console.log(`  Active: ${sandboxes.length} sandbox(es)\n`)
        if (sandboxes.length > 0) {
          console.log('  TaskID                   Container     Status       Uptime')
          console.log('  ' + '─'.repeat(70))
          for (const s of sandboxes) {
            const uptime = Math.floor((Date.now() - s.createdAt) / 1000)
            console.log(`  ${s.taskId.padEnd(25)}  ${s.containerId.slice(0, 12)}  ${s.status.padEnd(12)}  ${uptime}s`)
          }
        } else {
          console.log('  No active sandboxes.')
        }
        break
      }

      if (sub === 'enable') {
        console.log('✅ Docker sandbox mode enabled for this session.')
        console.log('   To persist across restarts, add DEVOS_SANDBOX=true to your .env file.')
        process.env.DEVOS_SANDBOX = 'true'
        break
      }

      if (sub === 'disable') {
        console.log('⚠️  Docker sandbox mode disabled for this session.')
        process.env.DEVOS_SANDBOX = 'false'
        break
      }

      if (sub === 'clean') {
        const before = sandboxManager.listActiveSandboxes().length
        if (before === 0) {
          console.log('✅ No active sandboxes to clean.')
        } else {
          console.log(`🗑️  Destroying ${before} active sandbox(es)...`)
          await sandboxManager.cleanupAll()
          console.log(`✅ Cleaned up ${before} sandbox(es).`)
        }
        break
      }

      console.error(`❌ Unknown sandbox sub-command: ${sub}. Try: status, enable, disable, clean`)
      break
    }

    // ── devos ui ──────────────────────────────────────────────
    case "ui": {
      const { execSync } = require("child_process") as typeof import("child_process");
      const uiDir = path.join(process.cwd(), "ui");
      console.log("[DevOS] 🖥️  Starting Mission Control UI...");
      console.log(`[DevOS]    Directory: ${uiDir}`);
      console.log("[DevOS]    Installing dependencies (first run may take ~30s)...");
      try {
        execSync("npm install", { cwd: uiDir, stdio: "inherit" });
        console.log("[DevOS] 🚀 Launching Vite dev server at http://localhost:5173");
        console.log("[DevOS]    Make sure DevOS API is running: ts-node index.ts serve");
        execSync("npm run dev", { cwd: uiDir, stdio: "inherit" });
      } catch (e: any) {
        console.error("[DevOS] UI failed:", e.message ?? String(e));
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
  serve                Start DevOS server + API at http://localhost:4200
  ui                   Start Mission Control web dashboard at http://localhost:5173
  api                  Print all available API endpoints with descriptions
  dashboard            Start Mission Control UI at http://localhost:3000
  capabilities <goal>  Analyze what capabilities a goal needs
  company   <goal>     Launch multi-agent Company Mode
  evolve               Run Skill Evolution Engine (analyze + improve + deploy)
  research  <topic>    Research a topic — DDG search + page fetch + LLM synthesis
  skills               List all indexed skills with tier + success rate
  cron list            List all scheduled cron jobs
  cron add <s> <goal>  Add cron job e.g. cron add "0 9 * * *" "check issues"
  cron remove <id>     Remove a cron job by ID
  webhook list         List registered webhook endpoints
  webhook add <p> <g>  Register webhook e.g. webhook add /deploy "deploy app"
  sessions             List all agent sessions with status and goal
  session   <id>       Show full session detail including history
  memory               Show top 10 execution memory patterns with success rates
  memory prune         Run memory aging and prune low-quality entries

Pilots:
  pilot list                List all pilots with schedule, status, last run
  pilot run <id>            Run a pilot immediately
  pilot enable <id>         Enable a pilot (auto-schedules on next serve)
  pilot disable <id>        Disable a pilot
  pilot history <id>        Show last 5 runs for a pilot

Autonomous Missions:
  mission "<goal>"          Start a full autonomous multi-agent mission
  missions                  List all missions with status + task counts
  mission status <id>       Show mission detail + live TODO file
  mission pause <id>        Pause a running mission
  mission resume <id>       Resume a paused mission
  mission cancel <id>       Cancel a mission permanently

Personality:
  chat                      Start interactive REPL chat with DevOS
  chat "<message>"          Send a single message to DevOS
  profile                   Show your user profile + extracted facts
  profile reset             Clear profile + conversation memory (re-triggers onboarding)
  profile pilots on|off     Enable or disable autonomous pilots

Personal Mode:
  personal                  Switch to Personal mode (set DEVOS_MODE=personal in .env)
  builder                   Switch to Builder mode (set DEVOS_MODE=builder in .env)
  briefing                  Generate an LLM morning briefing with recent activity
  teach "<name>"            Start recording a workflow by name
  stop                      Stop recording and save the workflow
  run workflow "<name>"     Replay a saved workflow
  agents personal           List all background agents with status + schedule

Telegram:
  telegram setup            Configure Telegram bot (print step-by-step instructions)
  telegram status           Show current Telegram config (token masked)
  telegram test             Send a test message via the configured bot

Docker Sandbox:
  sandbox                   Show sandbox status + active containers
  sandbox enable            Enable sandboxed skill execution (DEVOS_SANDBOX=true)
  sandbox disable           Disable sandboxed execution (back to in-process)
  sandbox clean             Destroy all active sandbox containers

Goal Engine:
  goal "<title>" "<desc>"   Create, plan, and execute a structured goal
  goals                     List all goals with status + project count
  goal status <id>          Show full goal breakdown: projects + tasks + status

Agent Layer:
  agents                    List all agents: CEO, Engineer, Researcher, Operator
  agent <role>              Show agent detail + recent messages (role: ceo|engineer|researcher|operator)
  coordinate "<t>" "<d>"    Run full multi-agent coordination on a new goal

Product Engine:
  blueprints                List available product blueprints
  build     "<goal>"        Match blueprint, generate product, deploy locally
  products                  List all product builds with status

Knowledge:
  knowledge list            List all entries in the knowledge store
  knowledge ingest <file>   Ingest a file or URL into the knowledge store
  knowledge query "<q>"     Query the knowledge store with natural language

Integrations:
  install                   Run setup wizard — checks Node, workspace, deps, Ollama
  github issues [repo]      List open GitHub issues (repo: owner/repo)

Flags:
  --dry-run    Plan but don't execute actions
  --clean      Wipe sandbox before running

Examples:
  ts-node index.ts doctor
  ts-node index.ts test
  ts-node index.ts plan "Build niche SaaS for real estate agents"
  ts-node index.ts grow "AI backtesting platform for NSE traders"
  ts-node index.ts agent "Build and market a SaaS for freelancers"
  ts-node index.ts research "best Node.js frameworks for REST APIs 2026"
      `);
    }
  }
}

handleCLI().catch((err) => {
  console.error("[DevOS] Fatal error:", err);
  process.exit(1);
});
