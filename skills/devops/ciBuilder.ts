import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { EnvironmentBuilder } from "../system/environmentBuilder";

export interface CIResult {
  success: boolean;
  workflowPath: string;
  content: string;
}

export class CIBuilder {
  private readonly environmentBuilder: EnvironmentBuilder;

  constructor(environmentBuilder?: EnvironmentBuilder) {
    this.environmentBuilder = environmentBuilder ?? new EnvironmentBuilder();
  }

  public async generate(
    projectDir: string,
    options?: {
      testCommand?: string;
      buildCommand?: string;
      deployTarget?: "vercel" | "railway" | "docker" | "none";
    }
  ): Promise<CIResult> {
    const environment = await this.environmentBuilder.detect(projectDir);
    const packageJson = await this.readPackageJson(projectDir);

    const testCommand = options?.testCommand ?? this.detectScript(packageJson, "test") ?? "npm test";
    const buildCommand =
      options?.buildCommand ?? this.detectScript(packageJson, "build") ?? "npm run build --if-present";
    const lintCommand = this.detectScript(packageJson, "lint");
    const deployTarget = options?.deployTarget ?? "none";

    const content = this.buildWorkflowContent({
      environment,
      testCommand,
      buildCommand,
      lintCommand,
      deployTarget
    });

    const workflowDir = path.join(projectDir, ".github", "workflows");
    const workflowPath = path.join(workflowDir, "ci.yml");

    await mkdir(workflowDir, { recursive: true });
    await writeFile(workflowPath, content, "utf-8");

    return {
      success: true,
      workflowPath,
      content
    };
  }

  private async readPackageJson(projectDir: string): Promise<Record<string, unknown> | null> {
    try {
      const raw = await readFile(path.join(projectDir, "package.json"), "utf-8");
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private detectScript(packageJson: Record<string, unknown> | null, script: string): string | null {
    if (!packageJson) {
      return null;
    }

    const scripts = packageJson["scripts"] as Record<string, string> | undefined;
    return scripts?.[script] ? `npm run ${script}` : null;
  }

  private buildWorkflowContent(params: {
    environment: string;
    testCommand: string;
    buildCommand: string;
    lintCommand: string | null;
    deployTarget: "vercel" | "railway" | "docker" | "none";
  }): string {
    const lines: string[] = [
      "name: CI",
      "",
      "on:",
      "  push:",
      "    branches: [\"main\", \"master\"]",
      "  pull_request:",
      "    branches: [\"main\", \"master\"]",
      "",
      "jobs:",
      "  build:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - name: Checkout",
      "        uses: actions/checkout@v4"
    ];

    if (params.environment === "node") {
      lines.push(
        "      - name: Setup Node.js",
        "        uses: actions/setup-node@v4",
        "        with:",
        "          node-version: '20'",
        "",
        "      - name: Install dependencies",
        "        run: npm ci"
      );

      if (params.lintCommand) {
        lines.push("", "      - name: Lint", `        run: ${params.lintCommand}`);
      }

      lines.push(
        "",
        "      - name: Test",
        `        run: ${params.testCommand}`,
        "",
        "      - name: Build",
        `        run: ${params.buildCommand}`
      );
    } else {
      lines.push(
        "",
        "      - name: Install dependencies",
        "        run: echo \"No install step configured for detected environment\"",
        "",
        "      - name: Lint",
        "        run: echo \"No lint step configured\"",
        "",
        "      - name: Test",
        "        run: echo \"No test step configured\"",
        "",
        "      - name: Build",
        "        run: echo \"No build step configured\""
      );
    }

    if (params.deployTarget !== "none") {
      lines.push("", "      - name: Deploy", `        run: ${this.deployCommand(params.deployTarget)}`);
    }

    return `${lines.join("\n")}\n`;
  }

  private deployCommand(target: "vercel" | "railway" | "docker"): string {
    switch (target) {
      case "vercel":
        return "npx vercel --prod --yes";
      case "railway":
        return "npx railway up";
      case "docker":
        return "docker build -t app:latest .";
      default:
        return "echo \"No deployment target\"";
    }
  }
}
