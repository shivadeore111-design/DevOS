"use strict";
// ============================================================
// devos/pilots/pilotExecutor.ts
// Executes a pilot: runs the goal through DevOS pipeline,
// stores output, handles format routing (file / slack / json)
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pilotExecutor = exports.PilotExecutor = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const pilotRegistry_1 = require("./pilotRegistry");
const knowledgeStore_1 = require("../../knowledge/knowledgeStore");
const slack_1 = require("../../integrations/slack");
const runner_1 = require("../../core/runner");
const engine_1 = require("../../executor/engine");
const planner_v2_1 = require("../../core/planner_v2");
const RUNS_FILE = path_1.default.join(process.cwd(), "workspace", "pilot-runs.json");
function makeId() {
    return "pr_" + Math.random().toString(36).slice(2, 9);
}
function todayStr() {
    return new Date().toISOString().slice(0, 10);
}
class PilotExecutor {
    constructor() {
        this.runs = [];
        this._load();
    }
    // ── Persistence ───────────────────────────────────────────
    _load() {
        try {
            if (!fs_1.default.existsSync(RUNS_FILE))
                return;
            const raw = JSON.parse(fs_1.default.readFileSync(RUNS_FILE, "utf-8"));
            this.runs = raw.map(r => ({
                ...r,
                startedAt: new Date(r.startedAt),
                completedAt: r.completedAt ? new Date(r.completedAt) : undefined,
            }));
        }
        catch { /* first run */ }
    }
    _persist() {
        const dir = path_1.default.dirname(RUNS_FILE);
        fs_1.default.mkdirSync(dir, { recursive: true });
        fs_1.default.writeFileSync(RUNS_FILE, JSON.stringify(this.runs, null, 2), "utf-8");
    }
    // ── Run a pilot ───────────────────────────────────────────
    async run(pilotId) {
        const manifest = pilotRegistry_1.pilotRegistry.get(pilotId);
        if (!manifest) {
            throw new Error(`Pilot not found: ${pilotId}`);
        }
        const start = Date.now();
        // 1. Create PilotRun record
        const pilotRun = {
            id: makeId(),
            pilotId,
            startedAt: new Date(),
            status: "running",
            iterationsUsed: 0,
        };
        this.runs.push(pilotRun);
        this._persist();
        console.log(`\n[PilotExecutor] 🚀 Starting pilot: ${manifest.name}`);
        try {
            // 2. Build goal string
            const goal = `[Pilot: ${manifest.name}] ${manifest.description}`;
            // 3. Run via DevOS pipeline
            const workspacePath = path_1.default.join(process.cwd(), "workspace", "sandbox");
            fs_1.default.mkdirSync(workspacePath, { recursive: true });
            const engine = new engine_1.DevOSEngine(workspacePath, false);
            const runner = new runner_1.Runner({ agentId: `pilot-${pilotId}`, engine });
            let plan;
            try {
                plan = await (0, planner_v2_1.generatePlan)(goal);
            }
            catch {
                plan = {
                    summary: goal,
                    complexity: "low",
                    actions: [{ type: "llm_task", query: goal, description: manifest.description }],
                };
            }
            const task = await runner.runOnce(goal, plan);
            // 4. Capture output
            const output = typeof task.result === "string"
                ? task.result
                : JSON.stringify(task.result ?? {}, null, 2);
            pilotRun.output = output;
            pilotRun.iterationsUsed = plan?.actions?.length ?? 1;
            // 5. Store in knowledge store under memoryKey
            const existingId = this._findExistingEntry(manifest.memoryKey);
            if (existingId) {
                // Update access count by searching — re-add is fine (store deduplicates by source)
                knowledgeStore_1.knowledgeStore.add({
                    title: `[Pilot: ${manifest.name}] ${todayStr()}`,
                    content: output,
                    chunks: [output.slice(0, 500)],
                    source: `pilot:${pilotId}:${pilotRun.id}`,
                    tags: [manifest.memoryKey, "pilot", pilotId, todayStr()],
                });
            }
            else {
                knowledgeStore_1.knowledgeStore.add({
                    title: `[Pilot: ${manifest.name}] ${todayStr()}`,
                    content: output,
                    chunks: [output.slice(0, 500)],
                    source: `pilot:${pilotId}:${pilotRun.id}`,
                    tags: [manifest.memoryKey, "pilot", pilotId, todayStr()],
                });
            }
            // 6. Output routing
            if (manifest.outputFormat === "slack") {
                await slack_1.slack.send(`*[Pilot: ${manifest.name}]* Run completed ${todayStr()}\n${output.slice(0, 2000)}`).catch(() => { });
            }
            if (manifest.outputFormat === "file" && manifest.outputPath) {
                const filePath = manifest.outputPath.replace("{date}", todayStr());
                const absPath = path_1.default.isAbsolute(filePath)
                    ? filePath
                    : path_1.default.join(process.cwd(), filePath);
                fs_1.default.mkdirSync(path_1.default.dirname(absPath), { recursive: true });
                fs_1.default.writeFileSync(absPath, output, "utf-8");
                console.log(`[PilotExecutor] 📄 Output written: ${absPath}`);
            }
            if (manifest.outputFormat === "json" && manifest.outputPath) {
                const filePath = manifest.outputPath.replace("{date}", todayStr());
                const absPath = path_1.default.isAbsolute(filePath)
                    ? filePath
                    : path_1.default.join(process.cwd(), filePath);
                fs_1.default.mkdirSync(path_1.default.dirname(absPath), { recursive: true });
                let parsed = output;
                try {
                    parsed = JSON.parse(output);
                }
                catch { /* keep string */ }
                fs_1.default.writeFileSync(absPath, JSON.stringify(parsed, null, 2), "utf-8");
            }
            // 7. Update PilotRun status
            pilotRun.status = task.status === "completed" ? "completed" : "failed";
            pilotRun.completedAt = new Date();
            const duration = Date.now() - start;
            console.log(`[PilotExecutor] ✅ Pilot completed: ${manifest.name} in ${duration}ms`);
        }
        catch (err) {
            pilotRun.status = "failed";
            pilotRun.error = err.message;
            pilotRun.completedAt = new Date();
            console.error(`[PilotExecutor] ❌ Pilot failed: ${manifest.name} — ${err.message}`);
        }
        this._persist();
        return pilotRun;
    }
    // ── History accessors ─────────────────────────────────────
    getHistory(pilotId) {
        return this.runs
            .filter(r => r.pilotId === pilotId)
            .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    }
    getLastRun(pilotId) {
        return this.getHistory(pilotId)[0] ?? null;
    }
    // ── Helpers ───────────────────────────────────────────────
    _findExistingEntry(memoryKey) {
        const results = knowledgeStore_1.knowledgeStore.search(memoryKey, 1);
        return results.length > 0 ? results[0].id : null;
    }
}
exports.PilotExecutor = PilotExecutor;
exports.pilotExecutor = new PilotExecutor();
