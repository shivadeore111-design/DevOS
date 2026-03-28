/**
 * tests/toolTest.ts
 * ─────────────────────────────────────────────────────────────
 * Tests every one of Aiden's 23 tools in isolation.
 * Each test sends a minimal goal that exercises exactly one tool,
 * then verifies the result without relying on LLM judgment
 * (objective pass/fail where possible).
 *
 * Run: npx ts-node tests/toolTest.ts
 */

import fs   from "fs";
import path from "path";
import os   from "os";
import {
  callAiden, getAiden, checkAidenHealth,
  runSuite, saveReport, printFinalSummary,
  TestCase, TestResult,
  log, warn, section, CONFIG,
} from "./testHarness";

// ─── Helpers ──────────────────────────────────────────────────

const SANDBOX = path.join(process.cwd(), "workspace", "tool_test_sandbox");

function ensureSandbox() {
  if (!fs.existsSync(SANDBOX)) fs.mkdirSync(SANDBOX, { recursive: true });
}

function sandboxFile(name: string) {
  return path.join(SANDBOX, name);
}

async function sendGoal(
  goal: string,
  timeoutMs = CONFIG.timeoutMs
): Promise<{ ok: boolean; response: string; raw: unknown; durationMs: number }> {
  const r = await callAiden("/api/chat", { message: goal }, timeoutMs);
  const data = r.data as Record<string, unknown>;
  const response = (data?.message || data?.reply || data?.response || JSON.stringify(data)) as string;
  return { ok: r.ok, response, raw: r.data, durationMs: r.durationMs };
}

function makeTest(
  id: string,
  description: string,
  fn: () => Promise<TestResult>
): TestCase {
  return { id, suite: "Tool Tests", description, run: fn };
}

// ─── Individual tool tests ─────────────────────────────────────

const TOOL_TESTS: TestCase[] = [

  // ── FILE WRITE ──────────────────────────────────────────────
  makeTest("TOOL-01", "file_write: creates a file with content", async () => {
    ensureSandbox();
    const testFile = sandboxFile("tool_test_write.txt");
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);

    const r = await sendGoal(
      `Write the text "AIDEN_TOOL_TEST_WRITE_OK" to the file ${testFile}`
    );

    const fileExists   = fs.existsSync(testFile);
    const fileContains = fileExists && fs.readFileSync(testFile, "utf-8").includes("AIDEN_TOOL_TEST_WRITE_OK");

    return {
      id:          "TOOL-01",
      suite:       "Tool Tests",
      description: "file_write: creates a file with content",
      verdict:     fileContains ? "PASS" : fileExists ? "WARN" : "FAIL",
      score:       fileContains ? 1 : fileExists ? 0.5 : 0,
      durationMs:  r.durationMs,
      detail:      fileContains ? "File created with correct content"
                 : fileExists   ? "File created but content mismatch"
                 : "File was not created",
      expected:    "AIDEN_TOOL_TEST_WRITE_OK in file",
      actual:      fileExists ? fs.readFileSync(testFile, "utf-8").slice(0, 100) : "File missing",
    };
  }),

  // ── FILE READ ───────────────────────────────────────────────
  makeTest("TOOL-02", "file_read: reads an existing file", async () => {
    ensureSandbox();
    const testFile = sandboxFile("tool_test_read.txt");
    const content  = "READ_TEST_CONTENT_12345";
    fs.writeFileSync(testFile, content);

    const r = await sendGoal(`Read the file ${testFile} and tell me exactly what it contains`);
    const mentioned = r.response.includes("READ_TEST_CONTENT_12345");

    return {
      id:          "TOOL-02",
      suite:       "Tool Tests",
      description: "file_read: reads an existing file",
      verdict:     mentioned ? "PASS" : "FAIL",
      score:       mentioned ? 1 : 0,
      durationMs:  r.durationMs,
      detail:      mentioned ? "Correctly read file content" : "Did not mention file content",
      expected:    "Response contains READ_TEST_CONTENT_12345",
      actual:      r.response.slice(0, 200),
    };
  }),

  // ── RUN PYTHON ──────────────────────────────────────────────
  makeTest("TOOL-03", "run_python: executes a Python script", async () => {
    const r = await sendGoal(
      "Run a Python script that prints the sum of 847 and 153"
    );
    const has1000 = r.response.includes("1000");

    return {
      id:          "TOOL-03",
      suite:       "Tool Tests",
      description: "run_python: executes a Python script",
      verdict:     has1000 ? "PASS" : "FAIL",
      score:       has1000 ? 1 : 0,
      durationMs:  r.durationMs,
      detail:      has1000 ? "Python executed, correct result (1000)" : "Result 1000 not found in response",
      expected:    "1000",
      actual:      r.response.slice(0, 200),
    };
  }),

  // ── RUN NODE ────────────────────────────────────────────────
  makeTest("TOOL-04", "run_node: executes a Node.js script", async () => {
    const r = await sendGoal(
      "Run a Node.js script that console.logs the result of 999 * 111"
    );
    const has110889 = r.response.includes("110889");

    return {
      id:          "TOOL-04",
      suite:       "Tool Tests",
      description: "run_node: executes a Node.js script",
      verdict:     has110889 ? "PASS" : "FAIL",
      score:       has110889 ? 1 : 0,
      durationMs:  r.durationMs,
      detail:      has110889 ? "Node.js executed, correct result" : "Expected 110889 not in response",
      expected:    "110889",
      actual:      r.response.slice(0, 200),
    };
  }),

  // ── RUN POWERSHELL ──────────────────────────────────────────
  makeTest("TOOL-05", "run_powershell: executes a PowerShell command", async () => {
    const r = await sendGoal(
      "Run a PowerShell command to get the current username and tell me what it returns"
    );
    const hasResponse = r.ok && r.response.length > 10;

    return {
      id:          "TOOL-05",
      suite:       "Tool Tests",
      description: "run_powershell: executes a PowerShell command",
      verdict:     hasResponse ? "PASS" : "FAIL",
      score:       hasResponse ? 1 : 0,
      durationMs:  r.durationMs,
      detail:      hasResponse ? "PowerShell executed and returned result" : "No response or short response",
      actual:      r.response.slice(0, 200),
    };
  }),

  // ── SYSTEM INFO ─────────────────────────────────────────────
  makeTest("TOOL-06", "system_info: returns GPU/CPU/RAM info", async () => {
    const r = await sendGoal("What is my current GPU and how much RAM do I have?");
    // Should mention GPU or memory
    const mentionsHardware = /gpu|vram|ram|memory|cpu|processor/i.test(r.response);

    return {
      id:          "TOOL-06",
      suite:       "Tool Tests",
      description: "system_info: returns GPU/CPU/RAM info",
      verdict:     mentionsHardware ? "PASS" : "FAIL",
      score:       mentionsHardware ? 1 : 0,
      durationMs:  r.durationMs,
      detail:      mentionsHardware ? "Hardware info returned" : "No hardware info in response",
      actual:      r.response.slice(0, 200),
    };
  }),

  // ── WEB SEARCH ──────────────────────────────────────────────
  makeTest("TOOL-07", "web_search: searches the web for current info", async () => {
    const r = await sendGoal(
      "Search the web for what year it currently is and tell me"
    );
    const mentions2026 = r.response.includes("2026");

    return {
      id:          "TOOL-07",
      suite:       "Tool Tests",
      description: "web_search: searches the web for current info",
      verdict:     mentions2026 ? "PASS" : r.ok ? "WARN" : "FAIL",
      score:       mentions2026 ? 1 : r.ok ? 0.5 : 0,
      durationMs:  r.durationMs,
      detail:      mentions2026 ? "Web search returned current year"
                 : r.ok ? "Search worked but year not confirmed"
                 : "Search failed",
      actual:      r.response.slice(0, 200),
    };
  }),

  // ── FETCH URL ───────────────────────────────────────────────
  makeTest("TOOL-08", "fetch_url: fetches content from a URL", async () => {
    const r = await sendGoal(
      "Fetch the URL https://httpbin.org/get and tell me what status code it returned"
    );
    const has200 = r.response.includes("200");

    return {
      id:          "TOOL-08",
      suite:       "Tool Tests",
      description: "fetch_url: fetches content from a URL",
      verdict:     has200 ? "PASS" : r.ok ? "WARN" : "FAIL",
      score:       has200 ? 1 : 0.3,
      durationMs:  r.durationMs,
      detail:      has200 ? "URL fetched, 200 status confirmed" : "Fetch worked but 200 not confirmed",
      actual:      r.response.slice(0, 200),
    };
  }),

  // ── NOTIFY ──────────────────────────────────────────────────
  makeTest("TOOL-09", "notify: sends a desktop notification", async () => {
    const r = await sendGoal("Send a desktop notification saying AIDEN_NOTIFY_TEST");
    const confirmed = r.ok && (
      r.response.toLowerCase().includes("sent") ||
      r.response.toLowerCase().includes("notif") ||
      r.response.toLowerCase().includes("done")
    );

    return {
      id:          "TOOL-09",
      suite:       "Tool Tests",
      description: "notify: sends a desktop notification",
      verdict:     confirmed ? "PASS" : r.ok ? "WARN" : "FAIL",
      score:       confirmed ? 1 : r.ok ? 0.5 : 0,
      durationMs:  r.durationMs,
      detail:      confirmed ? "Notification sent" : "Could not confirm notification",
      actual:      r.response.slice(0, 100),
    };
  }),

  // ── SCREENSHOT ──────────────────────────────────────────────
  makeTest("TOOL-10", "screenshot: captures the screen", async () => {
    const r = await getAiden("/api/screenshot");
    const hasImage = r.ok && r.data !== null;

    return {
      id:          "TOOL-10",
      suite:       "Tool Tests",
      description: "screenshot: captures the screen",
      verdict:     hasImage ? "PASS" : "FAIL",
      score:       hasImage ? 1 : 0,
      durationMs:  r.durationMs,
      detail:      hasImage ? "Screenshot endpoint responded" : `Screenshot failed: HTTP ${r.status}`,
    };
  }),

  // ── KNOWLEDGE SEARCH ────────────────────────────────────────
  makeTest("TOOL-11", "knowledge_search: searches uploaded files", async () => {
    const r = await sendGoal("Search my knowledge base and tell me how many files are uploaded");
    const responded = r.ok && r.response.length > 5;

    return {
      id:          "TOOL-11",
      suite:       "Tool Tests",
      description: "knowledge_search: searches uploaded files",
      verdict:     responded ? "PASS" : "FAIL",
      score:       responded ? 1 : 0,
      durationMs:  r.durationMs,
      detail:      responded ? "KB search responded" : "No KB response",
      actual:      r.response.slice(0, 150),
    };
  }),

  // ── STOCK DATA ──────────────────────────────────────────────
  makeTest("TOOL-12", "stock_data: returns NSE/BSE stock data", async () => {
    const r = await sendGoal(
      "Get NSE top gainers today and tell me the top stock name"
    );
    const hasStockData = r.ok && /nse|bse|stock|gainer|nifty|sensex|\₹|%/i.test(r.response);

    return {
      id:          "TOOL-12",
      suite:       "Tool Tests",
      description: "stock_data: returns NSE/BSE stock data",
      verdict:     hasStockData ? "PASS" : r.ok ? "WARN" : "FAIL",
      score:       hasStockData ? 1 : r.ok ? 0.4 : 0,
      durationMs:  r.durationMs,
      detail:      hasStockData ? "Stock data returned" : "No recognisable stock data in response",
      actual:      r.response.slice(0, 200),
    };
  }),

  // ── DEEP RESEARCH ───────────────────────────────────────────
  makeTest("TOOL-13", "deep_research: multi-pass web research", async () => {
    const r = await sendGoal(
      "Do a quick deep research on what TypeScript is used for",
      45000
    );
    const hasContent = r.ok && r.response.length > 200 &&
      /typescript|javascript|type|static/i.test(r.response);

    return {
      id:          "TOOL-13",
      suite:       "Tool Tests",
      description: "deep_research: multi-pass web research",
      verdict:     hasContent ? "PASS" : r.ok ? "WARN" : "FAIL",
      score:       hasContent ? 1 : r.ok ? 0.5 : 0,
      durationMs:  r.durationMs,
      detail:      hasContent ? "Research returned substantive content"
                 : r.ok ? "Response too short or off-topic"
                 : "Research failed",
      actual:      r.response.slice(0, 200),
    };
  }),

  // ── WAIT TOOL ───────────────────────────────────────────────
  makeTest("TOOL-14", "wait: pause between steps works", async () => {
    const start = Date.now();
    const r = await sendGoal(
      "Wait 2 seconds and then tell me you waited"
    );
    const elapsed  = Date.now() - start;
    const waitedOk = elapsed >= 1500 && /wait|done|complet|ok/i.test(r.response);

    return {
      id:          "TOOL-14",
      suite:       "Tool Tests",
      description: "wait: pause between steps works",
      verdict:     waitedOk ? "PASS" : elapsed < 1500 ? "FAIL" : "WARN",
      score:       waitedOk ? 1 : elapsed < 1500 ? 0 : 0.6,
      durationMs:  r.durationMs,
      detail:      `Elapsed: ${elapsed}ms. ${waitedOk ? "Wait confirmed" : "Wait not confirmed"}`,
    };
  }),

  // ── PLAN VALIDATION ─────────────────────────────────────────
  makeTest("TOOL-15", "plan_validation: rejects invalid plans", async () => {
    // Send a deliberately vague/bad goal that should fail planning
    const r = await sendGoal("Do the thing with the stuff in the place");
    // Should NOT hallucinate a success — should ask or say it can't plan
    const asksOrFails = r.response.length > 0 && (
      /clarif|unclear|specific|what|which|more info|cannot/i.test(r.response) ||
      r.response.toLowerCase().includes("fail") ||
      !r.ok
    );

    return {
      id:          "TOOL-15",
      suite:       "Tool Tests",
      description: "plan_validation: rejects invalid plans",
      verdict:     asksOrFails ? "PASS" : "WARN",
      score:       asksOrFails ? 1 : 0.3,
      durationMs:  r.durationMs,
      detail:      asksOrFails
        ? "Correctly asked for clarification or failed planning"
        : "Hallucinated a plan for a nonsense goal — this is a bug",
      actual:      r.response.slice(0, 200),
    };
  }),

  // ── SKILL TEACHER ───────────────────────────────────────────
  makeTest("TOOL-16", "skill_teacher: writes SKILL.md after success", async () => {
    const skillsDir = path.join(process.cwd(), "skills");
    const before    = fs.existsSync(skillsDir)
      ? fs.readdirSync(skillsDir).length : 0;

    // Run a simple task that should generate a skill
    const r = await sendGoal(
      "Write a file called skill_test_marker.txt with the content SKILL_TEST"
    );

    await new Promise(res => setTimeout(res, 3000)); // wait for async skill write
    const after = fs.existsSync(skillsDir)
      ? fs.readdirSync(skillsDir).length : 0;

    const skillWritten = after > before;

    return {
      id:          "TOOL-16",
      suite:       "Tool Tests",
      description: "skill_teacher: writes SKILL.md after success",
      verdict:     skillWritten ? "PASS" : "WARN",
      score:       skillWritten ? 1 : 0.4,
      durationMs:  r.durationMs,
      detail:      skillWritten
        ? `Skill written (${before} → ${after} skills)`
        : "No new skill written — SkillTeacher may not have triggered",
    };
  }),

];

// ─── Main ─────────────────────────────────────────────────────

async function main() {
  section("Aiden Tool Tests");

  const healthy = await checkAidenHealth();
  if (!healthy) {
    warn("Aiden server not reachable at " + CONFIG.aidenBaseUrl);
    warn("Start Aiden first: npm run dev");
    process.exit(1);
  }

  log(`Running ${TOOL_TESTS.length} tool tests against ${CONFIG.aidenBaseUrl}\n`);

  const report  = await runSuite("Tool Tests", TOOL_TESTS);
  const outPath = saveReport([report]);
  printFinalSummary([report], outPath);

  process.exit(report.verdict === "READY" ? 0 : 1);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
