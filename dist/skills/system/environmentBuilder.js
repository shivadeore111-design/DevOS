"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnvironmentBuilder = void 0;
const promises_1 = require("fs/promises");
const path_1 = __importDefault(require("path"));
const terminalOperator_1 = require("./terminalOperator");
class EnvironmentBuilder {
    constructor(terminalOperator) {
        this.terminalOperator = terminalOperator ?? new terminalOperator_1.TerminalOperator();
    }
    async detect(dir) {
        if (await this.exists(path_1.default.join(dir, "package.json"))) {
            return "node";
        }
        if ((await this.exists(path_1.default.join(dir, "requirements.txt"))) ||
            (await this.exists(path_1.default.join(dir, "pyproject.toml")))) {
            return "python";
        }
        if (await this.exists(path_1.default.join(dir, "Dockerfile"))) {
            return "docker";
        }
        return "unknown";
    }
    async prepare(dir) {
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
    getPrepareCommand(type) {
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
    async exists(filePath) {
        try {
            await (0, promises_1.access)(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.EnvironmentBuilder = EnvironmentBuilder;
