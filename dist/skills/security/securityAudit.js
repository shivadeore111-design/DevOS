"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityAudit = void 0;
const promises_1 = require("fs/promises");
const path_1 = __importDefault(require("path"));
class SecurityAudit {
    async scan(projectDir) {
        const files = await this.collectSourceFiles(projectDir);
        const critical = [];
        const high = [];
        const medium = [];
        for (const file of files) {
            const content = await (0, promises_1.readFile)(file, "utf-8");
            const lines = content.split("\n");
            lines.forEach((line, index) => {
                const lineNumber = index + 1;
                if (this.isSqlInjection(line)) {
                    high.push({
                        type: "sql-injection",
                        file,
                        line: lineNumber,
                        description: "Potential SQL injection via string concatenation in query-like statement.",
                        recommendation: "Use parameterized queries or query builders to avoid user input concatenation."
                    });
                }
                if (this.isHardcodedSecret(line)) {
                    critical.push({
                        type: "hardcoded-secret",
                        file,
                        line: lineNumber,
                        description: "Potential hardcoded credential or token discovered.",
                        recommendation: "Move secrets to environment variables or a secret manager."
                    });
                }
                if (this.isXssPattern(line)) {
                    high.push({
                        type: "xss",
                        file,
                        line: lineNumber,
                        description: "Potential cross-site scripting sink detected.",
                        recommendation: "Sanitize input/output and avoid assigning unsanitized data to DOM sinks."
                    });
                }
                if (this.isMissingAuth(line)) {
                    medium.push({
                        type: "missing-auth",
                        file,
                        line: lineNumber,
                        description: "Route definition appears to be missing auth middleware.",
                        recommendation: "Add auth middleware (e.g., authenticate/authorize) before the handler."
                    });
                }
            });
        }
        const summary = `Security audit completed. Critical: ${critical.length}, High: ${high.length}, Medium: ${medium.length}.`;
        return {
            critical,
            high,
            medium,
            summary
        };
    }
    async collectSourceFiles(dir) {
        const entries = await (0, promises_1.readdir)(dir, { withFileTypes: true });
        const files = await Promise.all(entries.map(async (entry) => {
            const fullPath = path_1.default.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (["node_modules", ".git", "dist"].includes(entry.name)) {
                    return [];
                }
                return this.collectSourceFiles(fullPath);
            }
            if (entry.isFile() && (fullPath.endsWith(".ts") || fullPath.endsWith(".js"))) {
                return [fullPath];
            }
            return [];
        }));
        return files.flat();
    }
    isSqlInjection(line) {
        const sqlRegex = /(select|insert|update|delete)[\s\S]{0,80}(\+|\$\{)/i;
        return sqlRegex.test(line);
    }
    isHardcodedSecret(line) {
        const secretRegex = /(password|api_key|secret|token)\s*[:=]\s*["'`][^"'`]+["'`]/i;
        return secretRegex.test(line);
    }
    isXssPattern(line) {
        return /(innerHTML\s*=|document\.write\s*\()/i.test(line);
    }
    isMissingAuth(line) {
        const routeNoMiddlewareRegex = /\b(app|router)\.(get|post|put|delete|patch)\s*\(\s*["'`][^"'`]+["'`]\s*,\s*(async\s+)?\(?.*=>/i;
        const hasAuthSignal = /(auth|authorize|middleware|guard)/i.test(line);
        return routeNoMiddlewareRegex.test(line) && !hasAuthSignal;
    }
}
exports.SecurityAudit = SecurityAudit;
