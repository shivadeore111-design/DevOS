"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogAnalyzer = void 0;
class LogAnalyzer {
    analyze(log) {
        const normalizedLog = log ?? "";
        const syntaxMatch = normalizedLog.match(/SyntaxError:\s*([^\n]+)(?:\n\s*at\s+.*\(([^:()\n]+):(\d+):(\d+)\))?/i);
        if (syntaxMatch) {
            return {
                errorType: "syntax",
                message: syntaxMatch[1].trim(),
                file: syntaxMatch[2],
                line: this.safeParseInt(syntaxMatch[3]),
                suggestion: "Review the indicated file for missing brackets, commas, or malformed syntax near the reported line."
            };
        }
        const typeAssignMatch = normalizedLog.match(/([^\n]+)\s+is not assignable to type\s+([^\n]+)/i);
        if (typeAssignMatch) {
            return {
                errorType: "type",
                message: `${typeAssignMatch[1].trim()} is not assignable to type ${typeAssignMatch[2].trim()}`,
                file: this.extractTsFile(normalizedLog),
                line: this.extractLine(normalizedLog),
                suggestion: "Align the value and expected TypeScript type by updating interfaces, generics, or function return types."
            };
        }
        const cannotFindModuleMatch = normalizedLog.match(/(?:Error:\s*)?Cannot find module\s+'([^']+)'/i);
        if (cannotFindModuleMatch) {
            return {
                errorType: "import",
                message: `Cannot find module '${cannotFindModuleMatch[1]}'`,
                file: this.extractTsFile(normalizedLog),
                line: this.extractLine(normalizedLog),
                suggestion: "Verify module path spelling, package installation, and tsconfig path aliases."
            };
        }
        const typeErrorMatch = normalizedLog.match(/TypeError:\s*([^\n]+)(?:\n\s*at\s+.*\(([^:()\n]+):(\d+):(\d+)\))?/i);
        if (typeErrorMatch) {
            return {
                errorType: "runtime",
                message: typeErrorMatch[1].trim(),
                file: typeErrorMatch[2],
                line: this.safeParseInt(typeErrorMatch[3]),
                suggestion: "Check null/undefined values and object shapes before property access or method invocation."
            };
        }
        const uncaughtMatch = normalizedLog.match(/Uncaught\s+(?:Exception|Error):\s*([^\n]+)/i);
        if (uncaughtMatch) {
            return {
                errorType: "runtime",
                message: uncaughtMatch[1].trim(),
                file: this.extractTsFile(normalizedLog),
                line: this.extractLine(normalizedLog),
                suggestion: "Inspect the uncaught exception source and add defensive checks or error handling around failing operations."
            };
        }
        return {
            errorType: "unknown",
            message: normalizedLog.split("\n").find((line) => line.trim().length > 0) ?? "Unknown error",
            file: this.extractTsFile(normalizedLog),
            line: this.extractLine(normalizedLog),
            suggestion: "Collect a full stack trace and isolate the failing code path to identify the underlying issue."
        };
    }
    extractTsFile(log) {
        const fileMatch = log.match(/([\w./\\-]+\.(?:ts|tsx|js|mjs|cjs))/);
        return fileMatch?.[1];
    }
    extractLine(log) {
        const lineMatch = log.match(/\.(?:ts|tsx|js|mjs|cjs):(\d+):\d+/);
        return this.safeParseInt(lineMatch?.[1]);
    }
    safeParseInt(value) {
        if (!value) {
            return undefined;
        }
        const parsed = Number.parseInt(value, 10);
        return Number.isNaN(parsed) ? undefined : parsed;
    }
}
exports.LogAnalyzer = LogAnalyzer;
