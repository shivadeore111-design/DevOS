import fs from "fs";
import path from "path";

const METRICS_FILE = path.join(process.cwd(), "workspace", "memory", "skillMetrics.json");

export interface SkillMetric {
  name: string;
  totalRuns: number;
  successes: number;
  failures: number;
  successRate: number;
  avgDurationMs: number;
  lastRunAt: string;
  lastFailureAt?: string;
  lastFailure?: string;
  failurePatterns: string[];
  tags: string[];
}

export interface SkillExecutionRecord {
  skillName: string;
  success: boolean;
  durationMs: number;
  error?: string;
  tags?: string[];
}

function load(): Record<string, SkillMetric> {
  try {
    if (fs.existsSync(METRICS_FILE)) {
      return JSON.parse(fs.readFileSync(METRICS_FILE, "utf-8")) as Record<string, SkillMetric>;
    }
  } catch {
    return {};
  }

  return {};
}

function save(store: Record<string, SkillMetric>): void {
  const dir = path.dirname(METRICS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tmp = `${METRICS_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, METRICS_FILE);
}

export class SkillMemory {
  public async record(record: SkillExecutionRecord): Promise<SkillMetric> {
    return SkillMemory.record(
      record.skillName,
      record.success,
      record.durationMs,
      record.error,
      record.tags ?? []
    );
  }

  public async getStats(skillName: string): Promise<SkillMetric | undefined> {
    return SkillMemory.get(skillName);
  }

  static record(
    name: string,
    success: boolean,
    durationMs: number,
    error?: string,
    tags: string[] = []
  ): SkillMetric {
    const store = load();
    const now = new Date().toISOString();

    const existing: SkillMetric = store[name] ?? {
      name,
      totalRuns: 0,
      successes: 0,
      failures: 0,
      successRate: 0,
      avgDurationMs: 0,
      lastRunAt: now,
      failurePatterns: [],
      tags
    };

    existing.totalRuns += 1;
    existing.lastRunAt = now;

    if (success) {
      existing.successes += 1;
    } else {
      existing.failures += 1;
      existing.lastFailureAt = now;
      existing.lastFailure = error;

      if (error) {
        const signature = error.slice(0, 80);
        if (!existing.failurePatterns.includes(signature)) {
          existing.failurePatterns = [signature, ...existing.failurePatterns].slice(0, 5);
        }
      }
    }

    existing.avgDurationMs =
      (existing.avgDurationMs * (existing.totalRuns - 1) + durationMs) / existing.totalRuns;
    existing.successRate = existing.successes / existing.totalRuns;
    existing.tags = tags.length > 0 ? tags : existing.tags;

    store[name] = existing;
    save(store);

    return existing;
  }

  static get(name: string): SkillMetric | undefined {
    return load()[name];
  }

  static getAll(): SkillMetric[] {
    return Object.values(load()).sort((a, b) => b.successRate - a.successRate);
  }

  static recommend(taskDescription: string): SkillMetric[] {
    const lower = taskDescription.toLowerCase();
    return this.getAll()
      .filter((skill) => skill.totalRuns >= 2 && skill.successRate >= 0.5)
      .filter(
        (skill) =>
          skill.name.toLowerCase().includes(lower.split(" ")[0]) ||
          skill.tags.some((tag) => lower.includes(tag))
      )
      .slice(0, 3);
  }

  static getUnreliable(threshold = 0.5): SkillMetric[] {
    return this.getAll().filter((skill) => skill.totalRuns >= 3 && skill.successRate < threshold);
  }

  static report(): string {
    const all = this.getAll();
    if (all.length === 0) {
      return "  No skill usage recorded yet.\n";
    }

    const lines = ["  Skill Performance\n  " + "─".repeat(50)];

    for (const skill of all) {
      const rate = (skill.successRate * 100).toFixed(0).padStart(3);
      const runs = String(skill.totalRuns).padStart(4);
      const filled = Math.round(skill.successRate * 10);
      const bar = "█".repeat(filled) + "░".repeat(10 - filled);
      lines.push(`  ${skill.name.padEnd(30)} ${bar} ${rate}% (${runs} runs)`);

      if (skill.lastFailure) {
        lines.push(`    └─ Last failure: ${skill.lastFailure.slice(0, 60)}`);
      }
    }

    return `${lines.join("\n")}\n`;
  }
}
