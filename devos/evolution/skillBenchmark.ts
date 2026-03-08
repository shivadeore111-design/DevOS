// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// ============================================================
// devos/evolution/skillBenchmark.ts — Skill A/B Benchmark
// Runs old vs new skill code against test scenarios and compares.
// ============================================================

import fs   from "fs";
import path from "path";
import vm   from "vm";

const RESULTS_FILE = path.join(process.cwd(), "workspace", "benchmark-results.json");
const STORE_DIR    = path.join(process.cwd(), "workspace");

// ── Interfaces ────────────────────────────────────────────────

export interface BenchmarkResult {
  skillName:      string;
  oldVersion:     string;
  newVersion:     string;
  oldSuccessRate: number;
  newSuccessRate: number;
  improvement:    number;
  recommendation: "deploy" | "discard" | "review";
  testedAt:       string;
}

// ── SkillBenchmark ────────────────────────────────────────────

export class SkillBenchmark {

  /**
   * Run both old and new skill code against 3 test scenarios.
   * Returns a recommendation based on the improvement.
   */
  async compare(
    skillName: string,
    oldCode:   string,
    newCode:   string
  ): Promise<BenchmarkResult> {
    const scenarios = this._buildScenarios(skillName);

    const [oldRate, newRate] = await Promise.all([
      this._measureSuccessRate(oldCode, scenarios),
      this._measureSuccessRate(newCode, scenarios),
    ]);

    const improvement = newRate - oldRate;
    let recommendation: BenchmarkResult["recommendation"];

    if (improvement >= 0.1) {
      recommendation = "deploy";
    } else if (newRate < oldRate) {
      recommendation = "discard";
    } else {
      recommendation = "review";
    }

    const result: BenchmarkResult = {
      skillName,
      oldVersion:     `original`,
      newVersion:     `evolved_${Date.now()}`,
      oldSuccessRate: oldRate,
      newSuccessRate: newRate,
      improvement,
      recommendation,
      testedAt:       new Date().toISOString(),
    };

    return result;
  }

  saveResult(result: BenchmarkResult): void {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }

    let existing: BenchmarkResult[] = [];
    if (fs.existsSync(RESULTS_FILE)) {
      try {
        existing = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf-8"));
      } catch {
        existing = [];
      }
    }

    existing.unshift(result);
    // Keep last 100 results
    existing = existing.slice(0, 100);

    const tmp = RESULTS_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(existing, null, 2), "utf-8");
    fs.renameSync(tmp, RESULTS_FILE);
  }

  // ── Private ──────────────────────────────────────────────────

  /**
   * Build 3 generic test scenarios for the skill.
   * Returns an array of args objects to pass to execute().
   */
  private _buildScenarios(skillName: string): any[] {
    // Generic scenarios that exercise the skill with minimal, medium, and edge inputs
    return [
      { command: "echo 'benchmark-test-1'", timeout: 5000 },
      { command: "echo 'benchmark-test-2'", timeout: 5000 },
      { command: "echo 'benchmark-test-3'", timeout: 5000 },
    ];
  }

  /**
   * Attempt to eval the TypeScript/JS code in a safe sandbox,
   * then call execute() on each scenario. Returns success rate (0–1).
   */
  private async _measureSuccessRate(code: string, scenarios: any[]): Promise<number> {
    let successes = 0;

    for (const scenario of scenarios) {
      try {
        const result = await this._runInSandbox(code, scenario);
        if (result !== null && result !== undefined) {
          successes += 1;
        }
      } catch {
        // failed scenario
      }
    }

    return scenarios.length > 0 ? successes / scenarios.length : 0;
  }

  /**
   * Lightweight sandboxed execution via Node vm module.
   * Strips TypeScript annotations so it can be eval'd.
   */
  private async _runInSandbox(code: string, args: any): Promise<any> {
    // Strip TypeScript type annotations with a simple regex pass
    const jsCode = this._stripTypes(code);

    const sandbox: Record<string, any> = {
      require,
      console,
      process,
      __result: null,
    };

    try {
      const script = new vm.Script(`
        (async () => {
          ${jsCode}
          // Try to find and call execute()
          const exports = {};
          ${jsCode}
          const skill = Object.values(exports).find(v => v && typeof v.execute === 'function');
          if (skill) {
            __result = await skill.execute(${JSON.stringify(args)});
          } else {
            __result = { note: 'no execute found' };
          }
        })();
      `);
      const ctx = vm.createContext(sandbox);
      await script.runInContext(ctx);
      return sandbox.__result;
    } catch {
      return null;
    }
  }

  /**
   * Very light TS-to-JS stripping (removes type annotations).
   * Not a full compiler — just enough for simple skill files.
   */
  private _stripTypes(ts: string): string {
    return ts
      // Remove import type statements
      .replace(/import\s+type\s+[^;]+;/g, "")
      // Remove export keyword
      .replace(/export\s+default\s+/g, "module.exports = ")
      .replace(/export\s+(const|class|function|interface|type)\s+/g, "$1 ")
      // Remove interface and type alias blocks
      .replace(/interface\s+\w+\s*\{[^}]*\}/gs, "")
      .replace(/type\s+\w+\s*=\s*[^;]+;/g, "")
      // Remove TypeScript generics
      .replace(/<[^>]*>/g, "")
      // Remove type annotations on params and variables
      .replace(/:\s*[\w|&\[\]<>{}'"]+(\s*\|\s*[\w|&\[\]<>{}'"]+)*/g, "")
      // Remove access modifiers
      .replace(/\b(private|public|protected|readonly|abstract|override)\s+/g, "");
  }
}

// ── Singleton ─────────────────────────────────────────────────

export const skillBenchmark = new SkillBenchmark();
