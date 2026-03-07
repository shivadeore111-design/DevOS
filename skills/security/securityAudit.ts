import { readFile, readdir } from "fs/promises";
import path from "path";

export interface SecurityReport {
  critical: SecurityFinding[];
  high: SecurityFinding[];
  medium: SecurityFinding[];
  summary: string;
}

export interface SecurityFinding {
  type: "sql-injection" | "hardcoded-secret" | "missing-auth" | "xss" | "insecure-dependency";
  file: string;
  line: number;
  description: string;
  recommendation: string;
}

export class SecurityAudit {
  public async scan(projectDir: string): Promise<SecurityReport> {
    const files = await this.collectSourceFiles(projectDir);
    const critical: SecurityFinding[] = [];
    const high: SecurityFinding[] = [];
    const medium: SecurityFinding[] = [];

    for (const file of files) {
      const content = await readFile(file, "utf-8");
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

  private async collectSourceFiles(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (["node_modules", ".git", "dist"].includes(entry.name)) {
            return [] as string[];
          }

          return this.collectSourceFiles(fullPath);
        }

        if (entry.isFile() && (fullPath.endsWith(".ts") || fullPath.endsWith(".js"))) {
          return [fullPath];
        }

        return [] as string[];
      })
    );

    return files.flat();
  }

  private isSqlInjection(line: string): boolean {
    const sqlRegex = /(select|insert|update|delete)[\s\S]{0,80}(\+|\$\{)/i;
    return sqlRegex.test(line);
  }

  private isHardcodedSecret(line: string): boolean {
    const secretRegex = /(password|api_key|secret|token)\s*[:=]\s*["'`][^"'`]+["'`]/i;
    return secretRegex.test(line);
  }

  private isXssPattern(line: string): boolean {
    return /(innerHTML\s*=|document\.write\s*\()/i.test(line);
  }

  private isMissingAuth(line: string): boolean {
    const routeNoMiddlewareRegex =
      /\b(app|router)\.(get|post|put|delete|patch)\s*\(\s*["'`][^"'`]+["'`]\s*,\s*(async\s+)?\(?.*=>/i;
    const hasAuthSignal = /(auth|authorize|middleware|guard)/i.test(line);
    return routeNoMiddlewareRegex.test(line) && !hasAuthSignal;
  }
}
