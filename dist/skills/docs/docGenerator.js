"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocGenerator = void 0;
const axios_1 = __importDefault(require("axios"));
const promises_1 = require("fs/promises");
const path_1 = __importDefault(require("path"));
class DocGenerator {
    constructor(baseUrl = "http://localhost:11434") {
        this.baseUrl = baseUrl;
    }
    async generateJSDoc(filePath) {
        const source = await (0, promises_1.readFile)(filePath, "utf-8");
        const prompt = [
            "Add JSDoc comments to all exported functions and classes in this TypeScript file.",
            "Return only the fully annotated source code.",
            "",
            source
        ].join("\n");
        return this.callOllama(prompt);
    }
    async generateReadme(projectDir) {
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
        const readmePath = path_1.default.join(projectDir, "README.md");
        await (0, promises_1.writeFile)(readmePath, content, "utf-8");
        return content;
    }
    async callOllama(prompt) {
        const response = await axios_1.default.post(`${this.baseUrl}/api/generate`, {
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
    async describeProjectStructure(projectDir) {
        const entries = [];
        const walk = async (currentDir, depth) => {
            if (depth > 3) {
                return;
            }
            const dirEntries = await (0, promises_1.readdir)(currentDir, { withFileTypes: true });
            for (const entry of dirEntries) {
                if (["node_modules", ".git", "dist"].includes(entry.name)) {
                    continue;
                }
                const fullPath = path_1.default.join(currentDir, entry.name);
                const relative = path_1.default.relative(projectDir, fullPath) || ".";
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
exports.DocGenerator = DocGenerator;
