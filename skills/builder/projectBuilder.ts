import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { EnvironmentBuilder } from "../system/environmentBuilder";
import { SelfRepair } from "../debug/selfRepair";

export interface BuildResult {
  success: boolean;
  projectDir: string;
  files: string[];
  installOutput: string;
  errors: string[];
}

interface ProjectFileSpec {
  path: string;
  content: string;
}

interface ProjectArchitecture {
  projectName?: string;
  files: ProjectFileSpec[];
}

interface OllamaGenerateResponse {
  response?: string;
}

export class ProjectBuilder {
  private readonly baseUrl: string;
  private readonly environmentBuilder: EnvironmentBuilder;
  private readonly selfRepair: SelfRepair;

  constructor(baseUrl = "http://localhost:11434") {
    this.baseUrl = baseUrl;
    this.environmentBuilder = new EnvironmentBuilder();
    this.selfRepair = new SelfRepair();
  }

  public async build(goal: string, outputDir: string): Promise<BuildResult> {
    const errors: string[] = [];
    const writtenFiles: string[] = [];

    try {
      const architecture = await this.selfRepair.execute(
        async () => this.generateArchitecture(goal),
        {
          onFailure: async (error, attempt) =>
            `Architecture generation failed on attempt ${attempt}: ${error.message}`
        }
      );

      const projectDir = path.resolve(outputDir, architecture.projectName || "generated-project");
      await mkdir(projectDir, { recursive: true });

      for (const fileSpec of architecture.files) {
        const filePath = path.resolve(projectDir, fileSpec.path);
        const parentDir = path.dirname(filePath);

        await mkdir(parentDir, { recursive: true });
        await writeFile(filePath, fileSpec.content, "utf-8");
        writtenFiles.push(path.relative(projectDir, filePath));
      }

      const installResult = await this.environmentBuilder.prepare(projectDir);
      if (!installResult.success) {
        errors.push(installResult.output || "Dependency installation failed.");
      }

      return {
        success: errors.length === 0,
        projectDir,
        files: writtenFiles,
        installOutput: installResult.output,
        errors
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);

      return {
        success: false,
        projectDir: path.resolve(outputDir),
        files: writtenFiles,
        installOutput: "",
        errors
      };
    }
  }

  private async generateArchitecture(goal: string): Promise<ProjectArchitecture> {
    const prompt = [
      "You are a software scaffolding assistant.",
      "Given a project goal, return a JSON object with this exact shape:",
      "{\"projectName\": string, \"files\": [{\"path\": string, \"content\": string}]}",
      "Return valid JSON only and include complete file contents.",
      `Goal: ${goal}`
    ].join("\n");

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3.2",
        stream: false,
        prompt
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as OllamaGenerateResponse;

    if (!data.response) {
      throw new Error("Ollama returned an empty architecture response.");
    }

    const jsonBlockMatch = data.response.match(/\{[\s\S]*\}/);
    const candidate = jsonBlockMatch ? jsonBlockMatch[0] : data.response;

    const parsed = JSON.parse(candidate) as Partial<ProjectArchitecture>;

    if (!Array.isArray(parsed.files) || parsed.files.length === 0) {
      throw new Error("Generated architecture does not include any files.");
    }

    const files = parsed.files.filter(
      (file): file is ProjectFileSpec =>
        typeof file?.path === "string" && typeof file?.content === "string"
    );

    if (files.length === 0) {
      throw new Error("Generated architecture files are invalid.");
    }

    return {
      projectName: parsed.projectName,
      files
    };
  }
}
