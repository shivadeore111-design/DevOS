"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.skillLoader = exports.SkillLoader = void 0;
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const terminalOperator_1 = require("./system/terminalOperator");
class SkillLoader {
    constructor(terminal = new terminalOperator_1.TerminalOperator()) {
        this.terminal = terminal;
    }
    async sync(targetDir) {
        const resolvedDir = this.resolveTargetDir(targetDir);
        const command = fs_1.default.existsSync(resolvedDir)
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
    async list(targetDir) {
        const resolvedDir = this.resolveTargetDir(targetDir);
        const skillsRoot = path_1.default.join(resolvedDir, "skills");
        if (!fs_1.default.existsSync(skillsRoot)) {
            return [];
        }
        const files = this.findSkillFiles(skillsRoot);
        return files.map((filePath) => {
            const content = fs_1.default.readFileSync(filePath, "utf-8");
            const { name, description } = this.parseFrontmatter(content);
            return {
                name: name || path_1.default.basename(path_1.default.dirname(filePath)),
                description: description || "",
                path: filePath,
                category: path_1.default.basename(path_1.default.dirname(path_1.default.dirname(filePath)))
            };
        });
    }
    async load(skillName, targetDir) {
        const skills = await this.list(targetDir);
        const match = skills.find((skill) => skill.name.toLowerCase() === skillName.toLowerCase());
        if (!match) {
            throw new Error(`Skill not found: ${skillName}`);
        }
        return fs_1.default.readFileSync(match.path, "utf-8");
    }
    resolveTargetDir(targetDir) {
        return targetDir ?? path_1.default.join(os_1.default.homedir(), ".devos", "skill-library");
    }
    findSkillFiles(dir) {
        const entries = fs_1.default.readdirSync(dir, { withFileTypes: true });
        const found = [];
        for (const entry of entries) {
            const fullPath = path_1.default.join(dir, entry.name);
            if (entry.isDirectory()) {
                found.push(...this.findSkillFiles(fullPath));
            }
            else if (entry.isFile() && entry.name === "SKILL.md") {
                found.push(fullPath);
            }
        }
        return found;
    }
    parseFrontmatter(content) {
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
    quote(value) {
        return JSON.stringify(value);
    }
}
exports.SkillLoader = SkillLoader;
exports.skillLoader = new SkillLoader();
