import { LogAnalyzer } from "./logAnalyzer";
import { RootCauseAnalyzer } from "./rootCauseAnalyzer";

export interface DebugResult {
  success: boolean;
  rootCause: string;
  fixApplied: string;
  attempts: number;
}

export class SystematicDebugger {
  private readonly logAnalyzer: LogAnalyzer;
  private readonly rootCauseAnalyzer: RootCauseAnalyzer;

  constructor(rootCauseAnalyzer?: RootCauseAnalyzer, logAnalyzer?: LogAnalyzer) {
    this.rootCauseAnalyzer = rootCauseAnalyzer ?? new RootCauseAnalyzer();
    this.logAnalyzer = logAnalyzer ?? new LogAnalyzer();
  }

  public async debug(
    errorLog: string,
    stackTrace: string,
    applyFix?: (fix: string) => Promise<void>
  ): Promise<DebugResult> {
    console.log("[SystematicDebugger] Step 1: Capturing error context...");

    console.log("[SystematicDebugger] Step 2: Running log analysis...");
    const analysis = this.logAnalyzer.analyze(errorLog);
    console.log("[SystematicDebugger] Log analysis result:", analysis);

    console.log("[SystematicDebugger] Step 3: Requesting root cause analysis...");
    const rootCauseResult = await this.rootCauseAnalyzer.analyze(analysis, stackTrace);
    console.log("[SystematicDebugger] Root cause result:", rootCauseResult);

    let fixApplied = rootCauseResult.fix;
    let success = true;

    if (applyFix) {
      console.log("[SystematicDebugger] Step 4: Applying suggested fix...");
      try {
        await applyFix(rootCauseResult.fix);
        console.log("[SystematicDebugger] Fix applied successfully.");
      } catch (error) {
        success = false;
        const message = error instanceof Error ? error.message : String(error);
        fixApplied = `Failed to apply fix: ${message}`;
        console.error("[SystematicDebugger] Failed to apply fix:", message);
      }
    } else {
      console.log("[SystematicDebugger] Step 4: No applyFix callback provided; returning suggestion only.");
    }

    return {
      success,
      rootCause: rootCauseResult.rootCause,
      fixApplied,
      attempts: 1
    };
  }
}
