/**
 * tests/testHarness.ts
 * ─────────────────────────────────────────────────────────────
 * Shared infrastructure for all Aiden test suites.
 * Handles: LLM judge, API calls to Aiden server, report writing,
 * coloured console output, and Evidently-compatible JSON export.
 */

import fs   from "fs";
import path from "path";
import http from "http";

// ─── Types ────────────────────────────────────────────────────

export type Verdict = "PASS" | "FAIL" | "WARN" | "SKIP";

export interface TestCase {
  id:          string;
  suite:       string;
  description: string;
  run:         () => Promise<TestResult>;
}

export interface TestResult {
  id:          string;
  suite:       string;
  description: string;
  verdict:     Verdict;
  score:       number;        // 0.0 – 1.0
  durationMs:  number;
  detail:      string;        // what happened
  expected?:   string;
  actual?:     string;
  raw?:        unknown;       // full Aiden response
}

export interface SuiteReport {
  suite:       string;
  timestamp:   string;
  durationMs:  number;
  total:       number;
  passed:      number;
  failed:      number;
  warned:      number;
  skipped:     number;
  passRate:    number;        // 0–100
  results:     TestResult[];
  verdict:     "READY" | "NEEDS_WORK" | "BROKEN";
}

// ─── Config ───────────────────────────────────────────────────

export const CONFIG = {
  aidenBaseUrl:   process.env.AIDEN_URL     || "http://localhost:4200",
  ollamaUrl:      process.env.OLLAMA_URL    || "http://localhost:11434",
  judgeModel:     process.env.JUDGE_MODEL   || "qwen2.5-coder:7b",
  timeoutMs:      parseInt(process.env.TEST_TIMEOUT_MS  || "30000"),
  reportDir:      process.env.REPORT_DIR    || path.join(process.cwd(), "workspace", "test_reports"),
  passThreshold:  parseFloat(process.env.PASS_THRESHOLD || "0.90"),
};

// ─── Console colours ──────────────────────────────────────────

const C = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  dim:    "\x1b[2m",
  green:  "\x1b[32m",
  red:    "\x1b[31m",
  yellow: "\x1b[33m",
  cyan:   "\x1b[36m",
  white:  "\x1b[37m",
  grey:   "\x1b[90m",
};

export function log(msg: string)        { console.log(msg); }
export function ok(msg: string)         { console.log(`${C.green}✓${C.reset} ${msg}`); }
export function fail(msg: string)       { console.log(`${C.red}✗${C.reset} ${msg}`); }
export function warn(msg: string)       { console.log(`${C.yellow}⚠${C.reset} ${msg}`); }
export function info(msg: string)       { console.log(`${C.cyan}→${C.reset} ${msg}`); }
export function dim(msg: string)        { console.log(`${C.grey}  ${msg}${C.reset}`); }
export function section(title: string)  {
  console.log(`\n${C.bold}${C.cyan}${"═".repeat(60)}${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ${title}${C.reset}`);
  console.log(`${C.cyan}${"─".repeat(60)}${C.reset}`);
}

// ─── HTTP helpers ─────────────────────────────────────────────

export async function callAiden(
  endpoint: string,
  body: Record<string, unknown>,
  timeoutMs = CONFIG.timeoutMs
): Promise<{ ok: boolean; status: number; data: unknown; durationMs: number }> {
  const start = Date.now();
  const url   = `${CONFIG.aidenBaseUrl}${endpoint}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
      signal:  controller.signal,
    });
    clearTimeout(timer);

    let data: unknown;
    try { data = await res.json(); } catch { data = await (res as any).text(); }

    return { ok: res.ok, status: res.status, data, durationMs: Date.now() - start };
  } catch (err: any) {
    return {
      ok:         false,
      status:     0,
      data:       { error: err?.message || String(err) },
      durationMs: Date.now() - start,
    };
  }
}

export async function getAiden(
  endpoint: string,
  timeoutMs = CONFIG.timeoutMs
): Promise<{ ok: boolean; status: number; data: unknown; durationMs: number }> {
  const start = Date.now();
  const url   = `${CONFIG.aidenBaseUrl}${endpoint}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    let data: unknown;
    try { data = await res.json(); } catch { data = null; }
    return { ok: res.ok, status: res.status, data, durationMs: Date.now() - start };
  } catch (err: any) {
    return { ok: false, status: 0, data: { error: String(err) }, durationMs: Date.now() - start };
  }
}

/** Check if Aiden server is up before running tests */
export async function checkAidenHealth(): Promise<boolean> {
  try {
    const r = await getAiden("/api/health", 5000);
    return r.ok;
  } catch {
    return false;
  }
}

// ─── LLM Judge ────────────────────────────────────────────────

interface JudgeInput {
  task:     string;
  response: string;
  criteria: string[];
}

interface JudgeOutput {
  score:   number;   // 0.0 – 1.0
  verdict: Verdict;
  reason:  string;
}

/**
 * Uses the local Ollama model to score Aiden's response.
 * Returns a score 0–1 based on supplied criteria.
 */
export async function llmJudge(input: JudgeInput): Promise<JudgeOutput> {
  const prompt = `You are an AI quality evaluator. Score the following agent response.

TASK GIVEN TO AGENT:
${input.task}

AGENT RESPONSE:
${input.response}

EVALUATION CRITERIA (score each 0 or 1):
${input.criteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Reply ONLY with JSON in this exact format:
{
  "scores": [1, 0, 1, ...],
  "overall": 0.75,
  "reason": "one sentence explanation"
}`;

  try {
    const res = await fetch(`${CONFIG.ollamaUrl}/api/generate`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        model:  CONFIG.judgeModel,
        prompt,
        stream: false,
        options: { temperature: 0 },
      }),
    });

    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const body = await res.json() as { response?: string };
    const raw  = body.response || "";

    // Extract JSON from response
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in judge response");

    const parsed = JSON.parse(match[0]) as {
      scores?: number[];
      overall?: number;
      reason?:  string;
    };

    const score = typeof parsed.overall === "number"
      ? Math.max(0, Math.min(1, parsed.overall))
      : (parsed.scores || []).reduce((a, b) => a + b, 0) / (parsed.scores?.length || 1);

    return {
      score,
      verdict: score >= 0.7 ? "PASS" : score >= 0.4 ? "WARN" : "FAIL",
      reason:  parsed.reason || "No reason given",
    };
  } catch (err: any) {
    // If judge fails, return neutral WARN
    return { score: 0.5, verdict: "WARN", reason: `Judge error: ${err.message}` };
  }
}

// ─── Test runner ──────────────────────────────────────────────

export async function runSuite(
  suiteName: string,
  cases: TestCase[]
): Promise<SuiteReport> {
  section(`${suiteName} (${cases.length} tests)`);

  const results: TestResult[] = [];
  const suiteStart = Date.now();

  for (const tc of cases) {
    const start = Date.now();
    info(`[${tc.id}] ${tc.description}`);

    let result: TestResult;
    try {
      result = await tc.run();
    } catch (err: any) {
      result = {
        id:          tc.id,
        suite:       tc.suite,
        description: tc.description,
        verdict:     "FAIL",
        score:       0,
        durationMs:  Date.now() - start,
        detail:      `Uncaught error: ${err.message}`,
      };
    }

    results.push(result);

    const icon  = result.verdict === "PASS" ? `${C.green}✓${C.reset}`
                : result.verdict === "WARN" ? `${C.yellow}⚠${C.reset}`
                : result.verdict === "SKIP" ? `${C.grey}-${C.reset}`
                : `${C.red}✗${C.reset}`;

    console.log(`  ${icon} ${result.description} ${C.grey}(${result.durationMs}ms, score:${(result.score * 100).toFixed(0)}%)${C.reset}`);
    if (result.verdict !== "PASS") {
      dim(`    ${result.detail}`);
    }
  }

  const passed  = results.filter(r => r.verdict === "PASS").length;
  const failed  = results.filter(r => r.verdict === "FAIL").length;
  const warned  = results.filter(r => r.verdict === "WARN").length;
  const skipped = results.filter(r => r.verdict === "SKIP").length;
  const passRate = (passed / Math.max(cases.length - skipped, 1)) * 100;

  const report: SuiteReport = {
    suite:      suiteName,
    timestamp:  new Date().toISOString(),
    durationMs: Date.now() - suiteStart,
    total:      cases.length,
    passed,
    failed,
    warned,
    skipped,
    passRate,
    results,
    verdict: passRate >= 90 ? "READY"
           : passRate >= 60 ? "NEEDS_WORK"
           : "BROKEN",
  };

  // Summary line
  console.log(`\n  ${C.bold}Result: ${passRate.toFixed(1)}% pass rate — ${report.verdict}${C.reset}`);
  console.log(`  ${C.green}${passed} passed${C.reset}  ${C.red}${failed} failed${C.reset}  ${C.yellow}${warned} warned${C.reset}  ${C.grey}${skipped} skipped${C.reset}`);

  return report;
}

// ─── Report writer ────────────────────────────────────────────

export function saveReport(reports: SuiteReport[]): string {
  if (!fs.existsSync(CONFIG.reportDir)) {
    fs.mkdirSync(CONFIG.reportDir, { recursive: true });
  }

  const date      = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  const filename  = `test_report_${date}.json`;
  const filepath  = path.join(CONFIG.reportDir, filename);

  const totalPassed = reports.reduce((a, r) => a + r.passed, 0);
  const totalTests  = reports.reduce((a, r) => a + r.total - r.skipped, 0);
  const overallRate = totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;

  const fullReport = {
    generated:   new Date().toISOString(),
    version:     "DevOS Aiden Test Suite v1.0",
    overallRate: parseFloat(overallRate.toFixed(1)),
    overallVerdict: overallRate >= 90 ? "LAUNCH_READY"
                  : overallRate >= 70 ? "NEEDS_WORK"
                  : "NOT_READY",
    suites: reports,
    // Evidently AI compatible format
    evidentlyRows: reports.flatMap(r =>
      r.results.map(res => ({
        test_id:     res.id,
        suite:       res.suite,
        description: res.description,
        score:       res.score,
        verdict:     res.verdict,
        duration_ms: res.durationMs,
        detail:      res.detail,
      }))
    ),
  };

  fs.writeFileSync(filepath, JSON.stringify(fullReport, null, 2));
  return filepath;
}

// ─── Print full summary ───────────────────────────────────────

export function printFinalSummary(reports: SuiteReport[], reportPath: string): void {
  section("FULL TEST SUITE SUMMARY");

  const totalPassed = reports.reduce((a, r) => a + r.passed, 0);
  const totalFailed = reports.reduce((a, r) => a + r.failed, 0);
  const totalWarned = reports.reduce((a, r) => a + r.warned, 0);
  const totalTests  = reports.reduce((a, r) => a + r.total - r.skipped, 0);
  const overallRate = totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;

  for (const r of reports) {
    const icon = r.verdict === "READY"      ? `${C.green}●${C.reset}`
               : r.verdict === "NEEDS_WORK" ? `${C.yellow}●${C.reset}`
               : `${C.red}●${C.reset}`;
    console.log(`  ${icon} ${r.suite.padEnd(25)} ${r.passRate.toFixed(0).padStart(3)}%  ${r.verdict}`);
  }

  console.log(`\n${C.bold}  Overall: ${overallRate.toFixed(1)}% (${totalPassed}/${totalTests} tests passed)${C.reset}`);

  const launchReady = overallRate >= 90;
  if (launchReady) {
    console.log(`\n  ${C.green}${C.bold}✓ LAUNCH READY — above 90% threshold${C.reset}`);
  } else {
    const gap = 90 - overallRate;
    console.log(`\n  ${C.red}${C.bold}✗ NOT READY — ${gap.toFixed(1)}% below 90% target${C.reset}`);
    console.log(`  ${C.yellow}Fix the FAIL cases above before Product Hunt${C.reset}`);
  }

  console.log(`\n  ${C.grey}Full report: ${reportPath}${C.reset}\n`);
}
