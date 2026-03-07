import { EnvironmentBuilder } from "./system/environmentBuilder";
import { TerminalOperator } from "./system/terminalOperator";

export interface Skill {
  name: string;
  description: string;
  category: string;
  execute(input: any): Promise<any>;
}

export class SkillRegistry {
  private readonly skills = new Map<string, Skill>();

  constructor() {
    this.registerDefaultSkills();
  }

  public register(skill: Skill): void {
    this.skills.set(skill.name, skill);
  }

  public get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  public list(): Skill[] {
    return Array.from(this.skills.values());
  }

  public findByCategory(category: string): Skill[] {
    return this.list().filter((skill) => skill.category === category);
  }

  private registerDefaultSkills(): void {
    const terminalOperator = new TerminalOperator();
    const environmentBuilder = new EnvironmentBuilder(terminalOperator);

    this.register({
      name: "terminalOperator",
      description: "Safely executes shell commands with timeout support",
      category: "system",
      execute: async (input: { command: string; timeout?: number; cwd?: string } | string) => {
        if (typeof input === "string") {
          return terminalOperator.execute(input);
        }

        return terminalOperator.execute(input.command, {
          timeout: input.timeout,
          cwd: input.cwd
        });
      }
    });

    this.register({
      name: "environmentBuilder",
      description: "Detects and prepares development environments",
      category: "system",
      execute: async (input: { dir: string; mode?: "detect" | "prepare" }) => {
        if (input.mode === "detect") {
          return environmentBuilder.detect(input.dir);
        }

        return environmentBuilder.prepare(input.dir);
      }
    });
  }
}

export const registry = new SkillRegistry();
