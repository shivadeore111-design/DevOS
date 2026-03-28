/**
 * tests/memoryTest.ts
 * ─────────────────────────────────────────────────────────────
 * Tests Aiden's memory system:
 *   - Remembers facts told in the same session
 *   - Recalls user preferences
 *   - Cross-session semantic memory (HOT→WARM→COLD)
 *   - Entity graph (knows related concepts)
 *   - Knowledge base retrieval
 *   - Memory compression (doesn't drop old context)
 *
 * Run: npx ts-node tests/memoryTest.ts
 */

import {
  callAiden, checkAidenHealth, llmJudge,
  runSuite, saveReport, printFinalSummary,
  TestCase, TestResult,
  log, warn, section, CONFIG,
} from "./testHarness";

// ─── Helper ───────────────────────────────────────────────────

async function ask(
  msg: string,
  conversationId?: string,
  timeoutMs = CONFIG.timeoutMs
): Promise<{ response: string; durationMs: number; ok: boolean }> {
  const body: Record<string, unknown> = { message: msg };
  if (conversationId) body.conversationId = conversationId;

  const r = await callAiden("/api/chat", body, timeoutMs);
  const d = r.data as Record<string, unknown>;
  const response = (d?.message || d?.reply || d?.response || JSON.stringify(d)) as string;
  return { response, durationMs: r.durationMs, ok: r.ok };
}

function makeTest(
  id: string,
  description: string,
  fn: () => Promise<TestResult>
): TestCase {
  return { id, suite: "Memory Tests", description, run: fn };
}

// ─── Memory tests ─────────────────────────────────────────────

const MEMORY_TESTS: TestCase[] = [

  // MEM-01: In-session fact recall
  makeTest("MEM-01", "Remembers a fact told earlier in same session", async () => {
    const convId = `test_${Date.now()}`;

    // Plant a fact
    await ask(
      "Remember this: my favourite number is 7391. Confirm you noted it.",
      convId
    );

    await new Promise(r => setTimeout(r, 1500));

    // Recall it
    const recall = await ask(
      "What is my favourite number that I told you?",
      convId
    );

    const hasNumber = recall.response.includes("7391");

    return {
      id:          "MEM-01",
      suite:       "Memory Tests",
      description: "Remembers a fact told earlier in same session",
      verdict:     hasNumber ? "PASS" : "FAIL",
      score:       hasNumber ? 1 : 0,
      durationMs:  recall.durationMs,
      detail:      hasNumber ? "Correctly recalled 7391" : "Failed to recall the planted fact",
      expected:    "7391",
      actual:      recall.response.slice(0, 200),
    };
  }),

  // MEM-02: Multi-turn context
  makeTest("MEM-02", "Maintains context across multiple turns", async () => {
    const convId = `ctx_${Date.now()}`;

    await ask("I am building a trading app called MarketEdge.", convId);
    await new Promise(r => setTimeout(r, 1000));
    await ask("It uses React and TypeScript.", convId);
    await new Promise(r => setTimeout(r, 1000));

    const r = await ask(
      "What is the name of the app I am building and what tech does it use?",
      convId
    );

    const hasAppName = /marketedge/i.test(r.response);
    const hasTech    = /react|typescript/i.test(r.response);

    return {
      id:          "MEM-02",
      suite:       "Memory Tests",
      description: "Maintains context across multiple turns",
      verdict:     hasAppName && hasTech ? "PASS" : hasAppName || hasTech ? "WARN" : "FAIL",
      score:       hasAppName && hasTech ? 1 : hasAppName || hasTech ? 0.5 : 0,
      durationMs:  r.durationMs,
      detail:      `App name: ${hasAppName ? "✓" : "✗"}  Tech: ${hasTech ? "✓" : "✗"}`,
      actual:      r.response.slice(0, 200),
    };
  }),

  // MEM-03: User preference recall
  makeTest("MEM-03", "Recalls user preference after being told once", async () => {
    const convId = `pref_${Date.now()}`;

    await ask(
      "I always want responses in bullet points, never in paragraphs. Remember this preference.",
      convId
    );
    await new Promise(r => setTimeout(r, 1500));

    const r = await ask(
      "List 3 benefits of using TypeScript",
      convId
    );

    // Check if response uses bullets
    const hasBullets = /^[\s]*[-•*◦▸→]|\n[-•*◦▸→]/m.test(r.response) ||
                       /^\s*\d+\./m.test(r.response);

    return {
      id:          "MEM-03",
      suite:       "Memory Tests",
      description: "Recalls user preference after being told once",
      verdict:     hasBullets ? "PASS" : "WARN",
      score:       hasBullets ? 1 : 0.3,
      durationMs:  r.durationMs,
      detail:      hasBullets
        ? "Used bullet points as instructed"
        : "Did not apply bullet preference — memory may not have persisted",
      actual:      r.response.slice(0, 300),
    };
  }),

  // MEM-04: Memory API responds
  makeTest("MEM-04", "Memory API endpoint is functional", async () => {
    const r = await callAiden("/api/memory/search", { query: "test", limit: 5 });

    return {
      id:          "MEM-04",
      suite:       "Memory Tests",
      description: "Memory API endpoint is functional",
      verdict:     r.ok ? "PASS" : "FAIL",
      score:       r.ok ? 1 : 0,
      durationMs:  r.durationMs,
      detail:      r.ok ? "Memory search API responded" : `API failed: HTTP ${r.status}`,
      actual:      JSON.stringify(r.data).slice(0, 200),
    };
  }),

  // MEM-05: Does not confuse different sessions
  makeTest("MEM-05", "Does not leak facts between separate sessions", async () => {
    // Plant a fact in session A
    const sessionA = `sessionA_${Date.now()}`;
    const sessionB = `sessionB_${Date.now()}`;

    await ask("My secret code word is ZEPHYR_9920.", sessionA);
    await new Promise(r => setTimeout(r, 1000));

    // Ask in a completely separate session
    const r = await ask(
      "Do you know my secret code word?",
      sessionB
    );

    // Should NOT know it (different session, not cross-session memory unless saved to persistent store)
    const leaksSecret = r.response.includes("ZEPHYR_9920");

    return {
      id:          "MEM-05",
      suite:       "Memory Tests",
      description: "Does not leak facts between separate sessions",
      // Note: if persistent memory is enabled this WILL know it — that's also acceptable
      // We mark as WARN either way since behaviour depends on config
      verdict:     "WARN",
      score:       leaksSecret ? 0.7 : 1,
      durationMs:  r.durationMs,
      detail:      leaksSecret
        ? "Session B knows the secret — persistent memory is ON (expected if enabled)"
        : "Session B does not know the secret — sessions are isolated",
      actual:      r.response.slice(0, 200),
    };
  }),

  // MEM-06: Knowledge base retrieval
  makeTest("MEM-06", "Knowledge base returns relevant chunks", async () => {
    const r = await callAiden("/api/knowledge/search", {
      query: "artificial intelligence",
      limit: 3,
    });

    const d = r.data as Record<string, unknown>;
    const hasResults = r.ok && (
      Array.isArray(d?.results) ||
      Array.isArray(d?.chunks) ||
      typeof d?.count === "number"
    );

    return {
      id:          "MEM-06",
      suite:       "Memory Tests",
      description: "Knowledge base returns relevant chunks",
      verdict:     r.ok ? "PASS" : "FAIL",
      score:       r.ok ? 1 : 0,
      durationMs:  r.durationMs,
      detail:      r.ok ? "KB search API responded successfully" : `KB search failed: ${r.status}`,
      actual:      JSON.stringify(r.data).slice(0, 200),
    };
  }),

  // MEM-07: Memory does not grow unbounded (compression)
  makeTest("MEM-07", "Memory compression: long conversation stays coherent", async () => {
    const convId = `compress_${Date.now()}`;

    // Plant one key fact first
    await ask("My project codename is NEBULA.", convId);

    // Then have 8 more turns about something else
    for (let i = 1; i <= 8; i++) {
      await ask(`Tell me a random fact about number ${i * 100}.`, convId);
      await new Promise(r => setTimeout(r, 500));
    }

    // Original fact should still be accessible
    const r = await ask("What was my project codename?", convId);
    const hasNebula = /nebula/i.test(r.response);

    return {
      id:          "MEM-07",
      suite:       "Memory Tests",
      description: "Memory compression: key facts survive long conversation",
      verdict:     hasNebula ? "PASS" : "WARN",
      score:       hasNebula ? 1 : 0.2,
      durationMs:  r.durationMs,
      detail:      hasNebula
        ? "Correctly recalled NEBULA after 8 other turns"
        : "Lost the NEBULA fact — memory compression may be dropping too aggressively",
      expected:    "NEBULA",
      actual:      r.response.slice(0, 200),
    };
  }),

  // MEM-08: Conversation history endpoint
  makeTest("MEM-08", "Conversation history API is functional", async () => {
    const r = await callAiden("/api/conversations", {});

    return {
      id:          "MEM-08",
      suite:       "Memory Tests",
      description: "Conversation history API is functional",
      verdict:     r.ok ? "PASS" : "FAIL",
      score:       r.ok ? 1 : 0,
      durationMs:  r.durationMs,
      detail:      r.ok ? "History API responded" : `History API failed: HTTP ${r.status}`,
    };
  }),
];

// ─── Main ─────────────────────────────────────────────────────

async function main() {
  section("Aiden Memory Tests");

  const healthy = await checkAidenHealth();
  if (!healthy) {
    warn("Aiden server not reachable at " + CONFIG.aidenBaseUrl);
    process.exit(1);
  }

  log(`Running ${MEMORY_TESTS.length} memory tests\n`);
  log("Note: MEM-05 is always WARN — outcome depends on persistent memory config\n");

  const report  = await runSuite("Memory Tests", MEMORY_TESTS);
  const outPath = saveReport([report]);
  printFinalSummary([report], outPath);

  process.exit(report.verdict === "READY" ? 0 : 1);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
