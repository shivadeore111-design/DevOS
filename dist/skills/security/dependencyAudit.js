"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DependencyAudit = void 0;
const terminalOperator_1 = require("../system/terminalOperator");
class DependencyAudit {
    constructor(terminalOperator) {
        this.terminalOperator = terminalOperator ?? new terminalOperator_1.TerminalOperator();
    }
    async audit(projectDir) {
        const result = await this.terminalOperator.execute("npm audit --json", {
            cwd: projectDir,
            timeout: 120000
        });
        const rawOutput = result.stdout.trim() || result.stderr.trim();
        if (!rawOutput) {
            return this.emptyReport(null, ["No audit output received. Ensure npm dependencies are installed."]);
        }
        try {
            const parsed = JSON.parse(rawOutput);
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
            const recommendations = [
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
        }
        catch {
            return this.emptyReport(rawOutput, ["Failed to parse npm audit JSON output."]);
        }
    }
    emptyReport(raw, recommendations) {
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
exports.DependencyAudit = DependencyAudit;
