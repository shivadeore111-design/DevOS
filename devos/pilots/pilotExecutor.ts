// ============================================================
// devos/pilots/pilotExecutor.ts
// Executes a pilot: runs the goal through DevOS pipeline,
// stores output, handles format routing (file / slack / json)
// ============================================================

import fs   from "fs";
import path from "path";
import { pilotRegistry }  from "./pilotRegistry";
import { PilotRun }       from "./types";
import { knowledgeStore } from "../../knowledge/knowledgeStore";
import { slack }          from "../../integrations/slack";
import { Runner }         from "../../core/runner";
import { DevOSEngine }    from "../../executor/engine";
import { generatePlan }   from "../../core/planner_v2";

const RUNS_FILE = path.join(process.cwd(), "workspace", "pilot-runs.json");

function makeId(): string {
  return "pr_" + Math.random().toString(36).slice(2, 9);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export class PilotExecutor {
  private runs: PilotRun[] = [];

  constructor() {
    this._load();
  }

  // ── Persistence ───────────────────────────────────────────

  private _load(): void {
    try {
      if (!fs.existsSync(RUNS_FILE)) return;
      const raw: any[] = JSON.parse(fs.readFileSync(RUNS_FILE, "utf-8"));
      this.runs = raw.map(r => ({
        ...r,
        startedAt:   new Date(r.startedAt),
        completedAt: r.completedAt ? new Date(r.completedAt) : undefined,
      }));
    } catch { /* first run */ }
  }

  private _persist(): void {
    const dir = path.dirname(RUNS_FILE);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(RUNS_FILE, JSON.stringify(this.runs, null, 2), "utf-8");
  }

  // ── Run a pilot ───────────────────────────────────────────

  async run(pilotId: string): Promise<PilotRun> {
    const manifest = pilotRegistry.get(pilotId);
    if (!manifest) {
      throw new Error(`Pilot not found: ${pilotId}`);
    }

    const start = Date.now();

    // 1. Create PilotRun record
    const pilotRun: PilotRun = {
      id:             makeId(),
      pilotId,
      startedAt:      new Date(),
      status:         "running",
      iterationsUsed: 0,
    };
    this.runs.push(pilotRun);
    this._persist();

    console.log(`\n[PilotExecutor] 🚀 Starting pilot: ${manifest.name}`);

    try {
      // 2. Build goal string — include the expert system prompt so planner gets full context
      const goal = manifest.systemPrompt
        ? `[Pilot: ${manifest.name}]\n\n${manifest.systemPrompt}`
        : `[Pilot: ${manifest.name}] ${manifest.description}`;

      // 3. Run via DevOS pipeline
      const workspacePath = path.join(process.cwd(), "workspace", "sandbox");
      fs.mkdirSync(workspacePath, { recursive: true });

      const engine = new DevOSEngine(workspacePath, false);
      const runner = new Runner({ agentId: `pilot-${pilotId}`, engine });

      let plan: any;
      try {
        plan = await generatePlan(goal);
      } catch {
        // Fallback: single llm_task using the pilot's expert systemPrompt
        plan = {
          summary:    goal,
          complexity: "low",
          actions:    [{
            type:         "llm_task",
            query:        manifest.description,
            description:  manifest.description,
            systemPrompt: manifest.systemPrompt,
          }],
        };
      }

      const task = await runner.runOnce(goal, plan);

      // 4. Capture output
      const output: string = typeof task.result === "string"
        ? task.result
        : JSON.stringify(task.result ?? {}, null, 2);

      pilotRun.output         = output;
      pilotRun.iterationsUsed = plan?.actions?.length ?? 1;

      // 5. Store in knowledge store under memoryKey
      const existingId = this._findExistingEntry(manifest.memoryKey);
      if (existingId) {
        // Update access count by searching — re-add is fine (store deduplicates by source)
        knowledgeStore.add({
          title:   `[Pilot: ${manifest.name}] ${todayStr()}`,
          content: output,
          chunks:  [output.slice(0, 500)],
          source:  `pilot:${pilotId}:${pilotRun.id}`,
          tags:    [manifest.memoryKey, "pilot", pilotId, todayStr()],
        });
      } else {
        knowledgeStore.add({
          title:   `[Pilot: ${manifest.name}] ${todayStr()}`,
          content: output,
          chunks:  [output.slice(0, 500)],
          source:  `pilot:${pilotId}:${pilotRun.id}`,
          tags:    [manifest.memoryKey, "pilot", pilotId, todayStr()],
        });
      }

      // 6. Output routing
      if (manifest.outputFormat === "slack") {
        await slack.send(
          `*[Pilot: ${manifest.name}]* Run completed ${todayStr()}\n${output.slice(0, 2000)}`
        ).catch(() => {});
      }

      if (manifest.outputFormat === "file" && manifest.outputPath) {
        const filePath = manifest.outputPath.replace("{date}", todayStr());
        const absPath  = path.isAbsolute(filePath)
          ? filePath
          : path.join(process.cwd(), filePath);
        fs.mkdirSync(path.dirname(absPath), { recursive: true });
        fs.writeFileSync(absPath, output, "utf-8");
        console.log(`[PilotExecutor] 📄 Output written: ${absPath}`);
      }

      if (manifest.outputFormat === "json" && manifest.outputPath) {
        const filePath = manifest.outputPath.replace("{date}", todayStr());
        const absPath  = path.isAbsolute(filePath)
          ? filePath
          : path.join(process.cwd(), filePath);
        fs.mkdirSync(path.dirname(absPath), { recursive: true });
        let parsed: any = output;
        try { parsed = JSON.parse(output); } catch { /* keep string */ }
        fs.writeFileSync(absPath, JSON.stringify(parsed, null, 2), "utf-8");
      }

      // 7. Update PilotRun status
      pilotRun.status      = task.status === "completed" ? "completed" : "failed";
      pilotRun.completedAt = new Date();

      const duration = Date.now() - start;
      console.log(`[PilotExecutor] ✅ Pilot completed: ${manifest.name} in ${duration}ms`);

    } catch (err: any) {
      pilotRun.status      = "failed";
      pilotRun.error       = err.message;
      pilotRun.completedAt = new Date();
      console.error(`[PilotExecutor] ❌ Pilot failed: ${manifest.name} — ${err.message}`);
    }

    this._persist();
    return pilotRun;
  }

  // ── History accessors ─────────────────────────────────────

  getHistory(pilotId: string): PilotRun[] {
    return this.runs
      .filter(r => r.pilotId === pilotId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  getLastRun(pilotId: string): PilotRun | null {
    return this.getHistory(pilotId)[0] ?? null;
  }

  // ── Helpers ───────────────────────────────────────────────

  private _findExistingEntry(memoryKey: string): string | null {
    const results = knowledgeStore.search(memoryKey, 1);
    return results.length > 0 ? results[0].id : null;
  }
}

export const pilotExecutor = new PilotExecutor();
