import { TerminalOperator } from "../system/terminalOperator";

export interface AuditReport {
  critical: number;
  high: number;
  moderate: number;
  low: number;
  total: number;
  fixAvailable: boolean;
  recommendations: string[];
  raw: unknown;
}

export class DependencyAudit {
  private readonly terminalOperator: TerminalOperator;

  constructor(terminalOperator?: TerminalOperator) {
    this.terminalOperator = terminalOperator ?? new TerminalOperator();
  }

  public async audit(projectDir: string): Promise<AuditReport> {
    const result = await this.terminalOperator.execute("npm audit --json", {
      cwd: projectDir,
      timeout: 120_000
    });

    const rawOutput = result.stdout.trim() || result.stderr.trim();

    if (!rawOutput) {
      return this.emptyReport(null, ["No audit output received. Ensure npm dependencies are installed."]);
    }

    try {
      const parsed = JSON.parse(rawOutput) as {
        metadata?: { vulnerabilities?: Record<string, number> };
      };

      const vulnerabilities = parsed.metadata?.vulnerabilities;

      if (!vulnerabilities) {
        return this.emptyReport(parsed);
      }

      const critical = vulnerabilities.critical ?? 0;
      const high = vulnerabilities.high ?? 0;
      const moderate = vulnerabilities.moderate ?? 0;
      const low = vulnerabilities.low ?? 0;
      const total = critical + high + moderate + low;

      if (total === 0) {
        return this.emptyReport(parsed);
      }

      const recommendations: string[] = [
        "Run npm audit fix to automatically remediate patchable issues.",
        "Update high-risk direct dependencies manually where fixes are available.",
        "Review advisories for transitive dependencies and pin safe versions."
      ];

      return {
        critical,
        high,
        moderate,
        low,
        total,
        fixAvailable: true,
        recommendations,
        raw: parsed
      };
    } catch {
      return this.emptyReport(rawOutput, ["Failed to parse npm audit JSON output."]);
    }
  }

  private emptyReport(raw: unknown, recommendations?: string[]): AuditReport {
    return {
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0,
      total: 0,
      fixAvailable: false,
      recommendations: recommendations ?? ["No known vulnerabilities detected."],
      raw
    };
  }
}
