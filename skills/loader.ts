import fs from "fs";
import os from "os";
import path from "path";

import { TerminalOperator } from "./system/terminalOperator";

export interface SyncResult {
  success: boolean;
  skillsFound: number;
  path: string;
}

export interface ExternalSkill {
  name: string;
  description: string;
  path: string;
  category: string;
  /** true = ships with DevOS repo (trusted). false = community/external (untrusted). */
  trusted: boolean;
}

// ── Security configuration ─────────────────────────────────────

function _loadSecurityConfig(): { skillVault: { enabled: boolean; trustBuiltIn: boolean; trustCommunity: boolean } } {
  try {
    const cfgPath = path.join(process.cwd(), "config", "security.json");
    if (fs.existsSync(cfgPath)) {
      return JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
    }
  } catch { /* use defaults */ }
  return { skillVault: { enabled: true, trustBuiltIn: true, trustCommunity: false } };
}

// ── The local skills/ directory inside the DevOS repo ──────────
const BUILTIN_SKILLS_DIR = path.join(process.cwd(), "skills");

export class SkillLoader {
  private readonly terminal: TerminalOperator;

  constructor(terminal = new TerminalOperator()) {
    this.terminal = terminal;
  }

  public async sync(targetDir?: string): Promise<SyncResult> {
    const resolvedDir = this.resolveTargetDir(targetDir);

    const command = fs.existsSync(resolvedDir)
      ? `git -C ${this.quote(resolvedDir)} pull`
      : `git clone https://github.com/sickn33/antigravity-awesome-skills.git ${this.quote(resolvedDir)}`;

    const result = await this.terminal.execute(command);
    const skills = await this.list(resolvedDir);

    return {
      success: result.success,
      skillsFound: skills.length,
      path: resolvedDir
    };
  }

  public async list(targetDir?: string): Promise<ExternalSkill[]> {
    const resolvedDir = this.resolveTargetDir(targetDir);
    const skillsRoot = path.join(resolvedDir, "skills");

    if (!fs.existsSync(skillsRoot)) {
      return [];
    }

    const files = this.findSkillFiles(skillsRoot);

    return files.map((filePath) => {
      const content = fs.readFileSync(filePath, "utf-8");
      const { name, description } = this.parseFrontmatter(content);

      // A skill is "built-in" (trusted) if it lives inside the DevOS repo's
      // skills/ directory; anything synced from external repos is community.
      const trusted = path.resolve(filePath).startsWith(path.resolve(BUILTIN_SKILLS_DIR));

      return {
        name: name || path.basename(path.dirname(filePath)),
        description: description || "",
        path: filePath,
        category: path.basename(path.dirname(path.dirname(filePath))),
        trusted,
      };
    });
  }

  /**
   * Run a skill by name.
   * - Built-in skills (trusted)   → executed in-process via require()
   * - Community skills (untrusted) → executed inside a SkillVault Docker sandbox
   */
  public async run(skillName: string, params: Record<string, unknown> = {}, targetDir?: string): Promise<unknown> {
    const skills = await this.list(targetDir);
    const match  = skills.find((s) => s.name.toLowerCase() === skillName.toLowerCase());

    if (!match) {
      throw new Error(`[SkillLoader] Skill not found: ${skillName}`);
    }

    const secCfg = _loadSecurityConfig();
    const useVault =
      secCfg.skillVault.enabled &&
      !match.trusted &&
      !secCfg.skillVault.trustCommunity;

    if (useVault) {
      return this._runInVault(match, params);
    }

    return this._runInProcess(match, params);
  }

  /** In-process execution — trusted skills only */
  private async _runInProcess(skill: ExternalSkill, params: Record<string, unknown>): Promise<unknown> {
    const indexPath = path.join(path.dirname(skill.path), "index.js");
    if (!fs.existsSync(indexPath)) {
      throw new Error(`[SkillLoader] No index.js found for skill "${skill.name}" at ${indexPath}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(indexPath) as { run?: (p: Record<string, unknown>) => Promise<unknown> };
    if (typeof mod.run !== "function") {
      throw new Error(`[SkillLoader] Skill "${skill.name}" index.js does not export a run() function`);
    }

    console.log(`[SkillLoader] ▶ Running built-in skill "${skill.name}" in-process`);
    return mod.run(params);
  }

  /** Sandboxed execution — untrusted/community skills */
  private async _runInVault(skill: ExternalSkill, params: Record<string, unknown>): Promise<unknown> {
    const { skillVault } = await import("../security/skillVault");
    const taskId = `skill-${skill.name}-${Date.now()}`;

    console.log(`[SkillLoader] 🔒 Running community skill "${skill.name}" in SkillVault`);

    const vault = await skillVault.createVault(taskId);

    try {
      // Copy skill directory into the vault workspace
      const skillDir    = path.dirname(skill.path);
      const vaultSkills = path.join(vault.workspacePath, "skill");
      fs.mkdirSync(vaultSkills, { recursive: true });
      _copyDirSync(skillDir, vaultSkills);

      // Write params as JSON so the skill can read them
      fs.writeFileSync(
        path.join(vault.workspacePath, "params.json"),
        JSON.stringify(params),
        "utf-8"
      );

      // Write a tiny runner that calls skill/index.js with params
      const runner = `
const params = JSON.parse(require("fs").readFileSync("/workspace/params.json","utf-8"));
require("/workspace/skill/index.js").run(params).then(r => {
  console.log(JSON.stringify({ ok: true, result: r }));
}).catch(e => {
  console.error(JSON.stringify({ ok: false, error: e.message }));
  process.exit(1);
});`;
      fs.writeFileSync(path.join(vault.workspacePath, "runner.js"), runner, "utf-8");

      const result = await skillVault.runInVault(taskId, "node /workspace/runner.js");

      if (result.exitCode !== 0) {
        throw new Error(`[SkillLoader] Vault skill failed (exit ${result.exitCode}): ${result.stderr.slice(0, 300)}`);
      }

      try {
        return JSON.parse(result.stdout.trim());
      } catch {
        return { stdout: result.stdout, stderr: result.stderr };
      }
    } finally {
      await skillVault.destroyVault(taskId);
    }
  }

  public async load(skillName: string, targetDir?: string): Promise<string> {
    const skills = await this.list(targetDir);
    const match = skills.find((skill) => skill.name.toLowerCase() === skillName.toLowerCase());

    if (!match) {
      throw new Error(`Skill not found: ${skillName}`);
    }

    return fs.readFileSync(match.path, "utf-8");
  }

  private resolveTargetDir(targetDir?: string): string {
    return targetDir ?? path.join(os.homedir(), ".devos", "skill-library");
  }

  private findSkillFiles(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const found: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        found.push(...this.findSkillFiles(fullPath));
      } else if (entry.isFile() && entry.name === "SKILL.md") {
        found.push(fullPath);
      }
    }

    return found;
  }

  private parseFrontmatter(content: string): { name: string; description: string } {
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) {
      return { name: "", description: "" };
    }

    const lines = match[1].split("\n");
    let name = "";
    let description = "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.startsWith("name:")) {
        name = line.slice("name:".length).trim().replace(/^['\"]|['\"]$/g, "");
      }
      if (line.startsWith("description:")) {
        description = line
          .slice("description:".length)
          .trim()
          .replace(/^['\"]|['\"]$/g, "");
      }
    }

    return { name, description };
  }

  private quote(value: string): string {
    return JSON.stringify(value);
  }
}

// ── Module-level helpers ───────────────────────────────────────

function _copyDirSync(src: string, dest: string): void {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath  = path.join(src,  entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      _copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export const skillLoader = new SkillLoader();
