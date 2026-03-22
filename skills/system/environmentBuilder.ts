import { access } from "fs/promises";
import path from "path";
import { TerminalOperator } from "./terminalOperator";

export type EnvironmentType = "node" | "python" | "docker" | "unknown";

export class EnvironmentBuilder {
  private readonly terminalOperator: TerminalOperator;

  constructor(terminalOperator?: TerminalOperator) {
    this.terminalOperator = terminalOperator ?? new TerminalOperator();
  }

  public async detect(dir: string): Promise<EnvironmentType> {
    if (await this.exists(path.join(dir, "package.json"))) {
      return "node";
    }

    if (
      (await this.exists(path.join(dir, "requirements.txt"))) ||
      (await this.exists(path.join(dir, "pyproject.toml")))
    ) {
      return "python";
    }

    if (await this.exists(path.join(dir, "Dockerfile"))) {
      return "docker";
    }

    return "unknown";
  }

  public async prepare(
    dir: string
  ): Promise<{ success: boolean; type: string; output: string }> {
    const type = await this.detect(dir);

    if (type === "unknown") {
      return {
        success: false,
        type,
        output: "No supported environment files found"
      };
    }

    const command = this.getPrepareCommand(type);
    const result = await this.terminalOperator.execute(command, { cwd: dir });

    return {
      success: result.success,
      type,
      output: [result.stdout, result.stderr].filter(Boolean).join("\n").trim()
    };
  }

  private getPrepareCommand(type: Exclude<EnvironmentType, "unknown">): string {
    switch (type) {
      case "node":
        return "npm install";
      case "python":
        return "pip install -r requirements.txt";
      case "docker":
        return "docker build -t devos-app .";
      default:
        return "";
    }
  }

  private async exists(filePath: string): Promise<boolean> {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
