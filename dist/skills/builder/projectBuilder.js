"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectBuilder = void 0;
const promises_1 = require("fs/promises");
const path_1 = __importDefault(require("path"));
const environmentBuilder_1 = require("../system/environmentBuilder");
const selfRepair_1 = require("../debug/selfRepair");
class ProjectBuilder {
    constructor(baseUrl = "http://localhost:11434") {
        this.baseUrl = baseUrl;
        this.environmentBuilder = new environmentBuilder_1.EnvironmentBuilder();
        this.selfRepair = new selfRepair_1.SelfRepair();
    }
    async build(goal, outputDir) {
        const errors = [];
        const writtenFiles = [];
        try {
            const architecture = await this.selfRepair.execute(async () => this.generateArchitecture(goal), {
                onFailure: async (error, attempt) => `Architecture generation failed on attempt ${attempt}: ${error.message}`
            });
            const projectDir = path_1.default.resolve(outputDir, architecture.projectName || "generated-project");
            await (0, promises_1.mkdir)(projectDir, { recursive: true });
            for (const fileSpec of architecture.files) {
                const filePath = path_1.default.resolve(projectDir, fileSpec.path);
                const parentDir = path_1.default.dirname(filePath);
                await (0, promises_1.mkdir)(parentDir, { recursive: true });
                await (0, promises_1.writeFile)(filePath, fileSpec.content, "utf-8");
                writtenFiles.push(path_1.default.relative(projectDir, filePath));
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
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            errors.push(message);
            return {
                success: false,
                projectDir: path_1.default.resolve(outputDir),
                files: writtenFiles,
                installOutput: "",
                errors
            };
        }
    }
    async generateArchitecture(goal) {
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
        const data = (await response.json());
        if (!data.response) {
            throw new Error("Ollama returned an empty architecture response.");
        }
        const jsonBlockMatch = data.response.match(/\{[\s\S]*\}/);
        const candidate = jsonBlockMatch ? jsonBlockMatch[0] : data.response;
        const parsed = JSON.parse(candidate);
        if (!Array.isArray(parsed.files) || parsed.files.length === 0) {
            throw new Error("Generated architecture does not include any files.");
        }
        const files = parsed.files.filter((file) => typeof file?.path === "string" && typeof file?.content === "string");
        if (files.length === 0) {
            throw new Error("Generated architecture files are invalid.");
        }
        return {
            projectName: parsed.projectName,
            files
        };
    }
}
exports.ProjectBuilder = ProjectBuilder;
