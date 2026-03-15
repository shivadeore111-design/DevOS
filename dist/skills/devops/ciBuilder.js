"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CIBuilder = void 0;
const promises_1 = require("fs/promises");
const path_1 = __importDefault(require("path"));
const environmentBuilder_1 = require("../system/environmentBuilder");
class CIBuilder {
    constructor(environmentBuilder) {
        this.environmentBuilder = environmentBuilder ?? new environmentBuilder_1.EnvironmentBuilder();
    }
    async generate(projectDir, options) {
        const environment = await this.environmentBuilder.detect(projectDir);
        const packageJson = await this.readPackageJson(projectDir);
        const testCommand = options?.testCommand ?? this.detectScript(packageJson, "test") ?? "npm test";
        const buildCommand = options?.buildCommand ?? this.detectScript(packageJson, "build") ?? "npm run build --if-present";
        const lintCommand = this.detectScript(packageJson, "lint");
        const deployTarget = options?.deployTarget ?? "none";
        const content = this.buildWorkflowContent({
            environment,
            testCommand,
            buildCommand,
            lintCommand,
            deployTarget
        });
        const workflowDir = path_1.default.join(projectDir, ".github", "workflows");
        const workflowPath = path_1.default.join(workflowDir, "ci.yml");
        await (0, promises_1.mkdir)(workflowDir, { recursive: true });
        await (0, promises_1.writeFile)(workflowPath, content, "utf-8");
        return {
            success: true,
            workflowPath,
            content
        };
    }
    async readPackageJson(projectDir) {
        try {
            const raw = await (0, promises_1.readFile)(path_1.default.join(projectDir, "package.json"), "utf-8");
            return JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
    detectScript(packageJson, script) {
        if (!packageJson) {
            return null;
        }
        const scripts = packageJson["scripts"];
        return scripts?.[script] ? `npm run ${script}` : null;
    }
    buildWorkflowContent(params) {
        const lines = [
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
            lines.push("      - name: Setup Node.js", "        uses: actions/setup-node@v4", "        with:", "          node-version: '20'", "", "      - name: Install dependencies", "        run: npm ci");
            if (params.lintCommand) {
                lines.push("", "      - name: Lint", `        run: ${params.lintCommand}`);
            }
            lines.push("", "      - name: Test", `        run: ${params.testCommand}`, "", "      - name: Build", `        run: ${params.buildCommand}`);
        }
        else {
            lines.push("", "      - name: Install dependencies", "        run: echo \"No install step configured for detected environment\"", "", "      - name: Lint", "        run: echo \"No lint step configured\"", "", "      - name: Test", "        run: echo \"No test step configured\"", "", "      - name: Build", "        run: echo \"No build step configured\"");
        }
        if (params.deployTarget !== "none") {
            lines.push("", "      - name: Deploy", `        run: ${this.deployCommand(params.deployTarget)}`);
        }
        return `${lines.join("\n")}\n`;
    }
    deployCommand(target) {
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
exports.CIBuilder = CIBuilder;
