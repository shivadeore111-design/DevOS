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
}

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
      return {
        name: name || path.basename(path.dirname(filePath)),
        description: description || "",
        path: filePath,
        category: path.basename(path.dirname(path.dirname(filePath)))
      };
    });
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

export const skillLoader = new SkillLoader();
