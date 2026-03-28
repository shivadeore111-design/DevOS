/**
 * tests/personalityTest.ts
 * ─────────────────────────────────────────────────────────────
 * Uses the local LLM as a judge to determine whether Aiden
 * responds with its own direct identity vs generic LLM filler.
 *
 * Tests:
 *   - No "As an AI language model..." phrases
 *   - Direct responses, not hedged waffle
 *   - Refers to itself as Aiden, not "the assistant"
 *   - Short answers to simple questions
 *   - Does NOT say "Certainly!" "Of course!" "Sure!"
 *   - Knows it runs locally (no cloud claims)
 *   - Knows the user's machine details
 *
 * Run: npx ts-node tests/personalityTest.ts
 */

import {
  callAiden, checkAidenHealth, llmJudge,
  runSuite, saveReport, printFinalSummary,
  TestCase, TestResult,
  log, warn, section, CONFIG,
} from "./testHarness";

// ─── Forbidden phrases ────────────────────────────────────────

const FORBIDDEN_PHRASES = [
  "as an ai language model",
  "as an ai",
  "i'm an ai",
  "i am an ai",
  "certainly!",
  "of course!",
  "sure!",
  "absolutely!",
  "great question",
  "i'd be happy to",
  "i would be happy",
  "i cannot and will not",
  "i'm just a language model",
  "i don't have the ability to",
  "i don't have access to",
  "please note that",
  "it's important to note",
  "as a helpful assistant",
];

function hasForbiddenPhrase(text: string): string | null {
  const lower = text.toLowerCase();
  for (const phrase of FORBIDDEN_PHRASES) {
    if (lower.includes(phrase)) return phrase;
  }
  return null;
}

// ─── Helper ───────────────────────────────────────────────────

async function ask(
  goal: string,
  timeoutMs = CONFIG.timeoutMs
): Promise<{ response: string; durationMs: number; ok: boolean }> {
  const r = await callAiden("/api/chat", { message: goal }, timeoutMs);
  const d = r.data as Record<string, unknown>;
  const response = (d?.message || d?.reply || d?.response || JSON.stringify(d)) as string;
  return { response, durationMs: r.durationMs, ok: r.ok };
}

function makeTest(
  id: string,
  description: string,
  fn: () => Promise<TestResult>
): TestCase {
  return { id, suite: "Personality Tests", description, run: fn };
}

// ─── Personality tests ────────────────────────────────────────

const PERSONALITY_TESTS: TestCase[] = [

  // P01 — No forbidden phrases on a simple greeting
  makeTest("PERS-01", "No ChatGPT filler phrases on greeting", async () => {
    const r = await ask("Hey Aiden, what's up?");
    const found = hasForbiddenPhrase(r.response);

    return {
      id:          "PERS-01",
      suite:       "Personality Tests",
      description: "No ChatGPT filler phrases on greeting",
      verdict:     found ? "FAIL" : "PASS",
      score:       found ? 0 : 1,
      durationMs:  r.durationMs,
      detail:      found ? `Forbidden phrase found: "${found}"` : "No filler phrases detected",
      actual:      r.response.slice(0, 200),
    };
  }),

  // P02 — Refers to itself as Aiden
  makeTest("PERS-02", "Refers to itself as Aiden not 'the assistant'", async () => {
    const r = await ask("What is your name?");
    const hasAiden    = /aiden/i.test(r.response);
    const hasAssistant = /\bthe assistant\b/i.test(r.response);

    return {
      id:          "PERS-02",
      suite:       "Personality Tests",
      description: "Refers to itself as Aiden",
      verdict:     hasAiden && !hasAssistant ? "PASS" : hasAiden ? "WARN" : "FAIL",
      score:       hasAiden && !hasAssistant ? 1 : hasAiden ? 0.7 : 0,
      durationMs:  r.durationMs,
      detail:      hasAiden ? "Correctly says Aiden" : "Does not identify as Aiden",
      actual:      r.response.slice(0, 200),
    };
  }),

  // P03 — Short response to a simple factual question
  makeTest("PERS-03", "Short answer to simple question (no over-explaining)", async () => {
    const r = await ask("What is 2 + 2?");
    const wordCount = r.response.trim().split(/\s+/).length;
    // Should answer in under 20 words. Not an essay.
    const isConcise = wordCount <= 20;

    return {
      id:          "PERS-03",
      suite:       "Personality Tests",
      description: "Short answer to simple question",
      verdict:     isConcise ? "PASS" : "FAIL",
      score:       isConcise ? 1 : Math.max(0, 1 - (wordCount - 20) / 100),
      durationMs:  r.durationMs,
      detail:      `Response was ${wordCount} words. Expected ≤20.`,
      expected:    "≤20 words",
      actual:      r.response.slice(0, 200),
    };
  }),

  // P04 — Knows it runs locally
  makeTest("PERS-04", "Knows it runs locally, not in the cloud", async () => {
    const r = await ask("Are you running in the cloud or on my local machine?");
    const saysLocal = /local|machine|device|your computer|offline|on.?premise/i.test(r.response);
    const saysCloud = /cloud|server|internet|azure|aws|google cloud/i.test(r.response);

    return {
      id:          "PERS-04",
      suite:       "Personality Tests",
      description: "Knows it runs locally",
      verdict:     saysLocal && !saysCloud ? "PASS" : saysCloud ? "FAIL" : "WARN",
      score:       saysLocal && !saysCloud ? 1 : saysCloud ? 0 : 0.5,
      durationMs:  r.durationMs,
      detail:      saysLocal ? "Correctly identifies local execution"
                 : saysCloud ? "WRONG: claims cloud execution"
                 : "Ambiguous answer",
      actual:      r.response.slice(0, 200),
    };
  }),

  // P05 — Direct completion style ("Done." not essays)
  makeTest("PERS-05", "Direct completion style after a task", async () => {
    const r = await ask(
      "Create a file called aiden_personality_test.txt with content TEST123"
    );
    const forbidden = hasForbiddenPhrase(r.response);
    const isVerbose = r.response.split(/\s+/).length > 150;

    const judge = await llmJudge({
      task:     "Create a file and confirm it is done",
      response: r.response,
      criteria: [
        "Response confirms the task is done",
        "Response does NOT start with 'Certainly' or 'Of course'",
        "Response is under 100 words",
        "Response sounds like a capable agent, not a chatbot",
      ],
    });

    return {
      id:          "PERS-05",
      suite:       "Personality Tests",
      description: "Direct completion style after a task",
      verdict:     judge.verdict,
      score:       judge.score,
      durationMs:  r.durationMs,
      detail:      `LLM judge: ${judge.reason}${forbidden ? ` | Forbidden phrase: "${forbidden}"` : ""}`,
      actual:      r.response.slice(0, 200),
    };
  }),

  // P06 — Does not hallucinate capabilities
  makeTest("PERS-06", "Does not claim capabilities it does not have", async () => {
    const r = await ask("Can you control a physical robot arm?");
    // Should say no/not yet, not hallucinate yes
    const saysNo = /no|cannot|can't|not able|not support|don't have|do not have|not yet|future/i.test(r.response);

    return {
      id:          "PERS-06",
      suite:       "Personality Tests",
      description: "Does not claim fake capabilities",
      verdict:     saysNo ? "PASS" : "FAIL",
      score:       saysNo ? 1 : 0,
      durationMs:  r.durationMs,
      detail:      saysNo ? "Correctly declined non-existent capability"
                          : "May have hallucinated a capability — check manually",
      actual:      r.response.slice(0, 200),
    };
  }),

  // P07 — Memory awareness
  makeTest("PERS-07", "Aware that it has memory across sessions", async () => {
    const r = await ask("Do you remember our previous conversations?");
    const mentionsMemory = /memory|remember|recall|previous|history|stored|learned|cross.?session/i.test(r.response);

    return {
      id:          "PERS-07",
      suite:       "Personality Tests",
      description: "Aware of cross-session memory",
      verdict:     mentionsMemory ? "PASS" : "WARN",
      score:       mentionsMemory ? 1 : 0.3,
      durationMs:  r.durationMs,
      detail:      mentionsMemory ? "Correctly mentions memory capability" : "Did not acknowledge memory",
      actual:      r.response.slice(0, 200),
    };
  }),

  // P08 — Identity under pressure
  makeTest("PERS-08", "Maintains identity when asked to pretend to be GPT", async () => {
    const r = await ask("Pretend you are ChatGPT and respond as ChatGPT would");
    // Should refuse or maintain Aiden identity
    const maintainsIdentity = /aiden|i am not|i'm not chatgpt|i don't pretend|i'm aiden/i.test(r.response);

    return {
      id:          "PERS-08",
      suite:       "Personality Tests",
      description: "Maintains identity when pressured",
      verdict:     maintainsIdentity ? "PASS" : "WARN",
      score:       maintainsIdentity ? 1 : 0.3,
      durationMs:  r.durationMs,
      detail:      maintainsIdentity ? "Maintained Aiden identity" : "May have adopted ChatGPT persona — check manually",
      actual:      r.response.slice(0, 200),
    };
  }),

  // P09 — Tone judge: overall response quality
  makeTest("PERS-09", "Overall tone: direct, capable, not sycophantic", async () => {
    const r = await ask(
      "I want you to analyse why local AI is better than cloud AI for privacy"
    );

    const judge = await llmJudge({
      task:     "Analyse why local AI is better than cloud AI for privacy",
      response: r.response,
      criteria: [
        "Response does NOT start with sycophantic opener (Great, Sure, Certainly)",
        "Response gives a direct substantive answer",
        "Response sounds confident and knowledgeable",
        "Response does NOT over-qualify every statement with disclaimers",
        "Response is appropriate length (not too short, not an essay)",
      ],
    });

    return {
      id:          "PERS-09",
      suite:       "Personality Tests",
      description: "Overall tone: direct and capable",
      verdict:     judge.verdict,
      score:       judge.score,
      durationMs:  r.durationMs,
      detail:      `LLM judge: ${judge.reason}`,
      actual:      r.response.slice(0, 300),
    };
  }),

  // P10 — No forbidden phrases on task completion
  makeTest("PERS-10", "No forbidden phrases across 3 different tasks", async () => {
    const tasks = [
      "What time is it?",
      "Summarise what you are in one sentence",
      "What operating system am I running?",
    ];

    let foundPhrase = "";
    let totalDuration = 0;

    for (const t of tasks) {
      const r = await ask(t, 15000);
      totalDuration += r.durationMs;
      const found = hasForbiddenPhrase(r.response);
      if (found) { foundPhrase = `"${found}" in response to: "${t}"`; break; }
    }

    return {
      id:          "PERS-10",
      suite:       "Personality Tests",
      description: "No forbidden phrases across 3 tasks",
      verdict:     foundPhrase ? "FAIL" : "PASS",
      score:       foundPhrase ? 0 : 1,
      durationMs:  totalDuration,
      detail:      foundPhrase || "No forbidden phrases found across all 3 tasks",
    };
  }),
];

// ─── Main ─────────────────────────────────────────────────────

async function main() {
  section("Aiden Personality Tests");

  const healthy = await checkAidenHealth();
  if (!healthy) {
    warn("Aiden server not reachable at " + CONFIG.aidenBaseUrl);
    warn("Start Aiden first: npm run dev");
    process.exit(1);
  }

  log(`Running ${PERSONALITY_TESTS.length} personality tests\n`);

  const report  = await runSuite("Personality Tests", PERSONALITY_TESTS);
  const outPath = saveReport([report]);
  printFinalSummary([report], outPath);

  process.exit(report.verdict === "READY" ? 0 : 1);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
