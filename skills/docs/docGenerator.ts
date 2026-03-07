import axios from "axios";
import { readdir, readFile, writeFile } from "fs/promises";
import path from "path";

interface OllamaResponse {
  response?: string;
}

export class DocGenerator {
  constructor(private readonly baseUrl: string = "http://localhost:11434") {}

  public async generateJSDoc(filePath: string): Promise<string> {
    const source = await readFile(filePath, "utf-8");
    const prompt = [
      "Add JSDoc comments to all exported functions and classes in this TypeScript file.",
      "Return only the fully annotated source code.",
      "",
      source
    ].join("\n");

    return this.callOllama(prompt);
  }

  public async generateReadme(projectDir: string): Promise<string> {
    const structure = await this.describeProjectStructure(projectDir);
    const prompt = [
      "Write a complete README.md for this TypeScript autonomous AI operating system project.",
      "Include sections: Overview, Features, Installation, Usage, Architecture, Skills, Development, and Troubleshooting.",
      "Use the provided project structure as context.",
      "",
      "Project structure:",
      structure
    ].join("\n");

    const content = await this.callOllama(prompt);
    const readmePath = path.join(projectDir, "README.md");
    await writeFile(readmePath, content, "utf-8");

    return content;
  }

  private async callOllama(prompt: string): Promise<string> {
    const response = await axios.post<OllamaResponse>(`${this.baseUrl}/api/generate`, {
      model: "llama3.2",
      prompt,
      stream: false
    });

    const output = response.data.response?.trim();
    if (!output) {
      throw new Error("Ollama returned an empty response.");
    }

    return output;
  }

  private async describeProjectStructure(projectDir: string): Promise<string> {
    const entries: string[] = [];

    const walk = async (currentDir: string, depth: number): Promise<void> => {
      if (depth > 3) {
        return;
      }

      const dirEntries = await readdir(currentDir, { withFileTypes: true });
      for (const entry of dirEntries) {
        if (["node_modules", ".git", "dist"].includes(entry.name)) {
          continue;
        }

        const fullPath = path.join(currentDir, entry.name);
        const relative = path.relative(projectDir, fullPath) || ".";
        entries.push(`${"  ".repeat(depth)}- ${relative}${entry.isDirectory() ? "/" : ""}`);

        if (entry.isDirectory()) {
          await walk(fullPath, depth + 1);
        }
      }
    };

    await walk(projectDir, 0);
    return entries.join("\n");
  }
}
