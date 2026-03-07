import { TerminalOperator } from "../system/terminalOperator";

export interface DeployResult {
  success: boolean;
  tag: string;
  output: string;
  duration: number;
}

export class DeploymentEngineer {
  private readonly terminalOperator: TerminalOperator;

  constructor(terminalOperator?: TerminalOperator) {
    this.terminalOperator = terminalOperator ?? new TerminalOperator();
  }

  public async build(projectDir: string, tag: string): Promise<DeployResult> {
    console.log(`[DeploymentEngineer] Starting Docker build for ${projectDir} with tag ${tag}`);
    const start = Date.now();
    const command = `docker build -t ${tag} .`;

    const result = await this.terminalOperator.execute(command, {
      cwd: projectDir,
      timeout: 10 * 60_000
    });

    const duration = Date.now() - start;
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();

    console.log(
      `[DeploymentEngineer] Docker build ${result.success ? "completed" : "failed"} in ${duration}ms`
    );

    return {
      success: result.success,
      tag,
      output,
      duration
    };
  }

  public async healthCheck(
    containerName: string
  ): Promise<{ healthy: boolean; status: string }> {
    console.log(`[DeploymentEngineer] Running health check for container ${containerName}`);

    const psResult = await this.terminalOperator.execute(
      `docker ps --filter "name=${containerName}" --format "{{.Names}}|{{.Status}}"`
    );

    if (!psResult.success) {
      const status = [psResult.stdout, psResult.stderr]
        .filter(Boolean)
        .join("\n")
        .trim() || "Unable to list running containers";

      console.log(`[DeploymentEngineer] Health check failed during docker ps: ${status}`);
      return { healthy: false, status };
    }

    const foundContainer = psResult.stdout
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith(`${containerName}|`));

    if (!foundContainer) {
      const status = "Container is not running";
      console.log(`[DeploymentEngineer] ${status}`);
      return { healthy: false, status };
    }

    const inspectResult = await this.terminalOperator.execute(
      `docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' ${containerName}`
    );

    if (!inspectResult.success) {
      const status = [inspectResult.stdout, inspectResult.stderr]
        .filter(Boolean)
        .join("\n")
        .trim() || "Unable to inspect container";

      console.log(`[DeploymentEngineer] Health check failed during docker inspect: ${status}`);
      return { healthy: false, status };
    }

    const status = inspectResult.stdout.trim() || "unknown";
    const healthy = ["healthy", "running"].includes(status.toLowerCase());

    console.log(`[DeploymentEngineer] Health check status for ${containerName}: ${status}`);
    return { healthy, status };
  }

  public async rollback(containerName: string, previousTag: string): Promise<DeployResult> {
    console.log(
      `[DeploymentEngineer] Starting rollback for ${containerName} using image tag ${previousTag}`
    );

    const start = Date.now();
    const steps: string[] = [];

    const stopResult = await this.terminalOperator.execute(`docker stop ${containerName}`);
    steps.push(`[stop] ${[stopResult.stdout, stopResult.stderr].filter(Boolean).join("\n").trim()}`);

    const removeResult = await this.terminalOperator.execute(`docker rm ${containerName}`);
    steps.push(
      `[remove] ${[removeResult.stdout, removeResult.stderr].filter(Boolean).join("\n").trim()}`
    );

    const runResult = await this.terminalOperator.execute(
      `docker run -d --name ${containerName} ${previousTag}`,
      { timeout: 120_000 }
    );
    steps.push(`[run] ${[runResult.stdout, runResult.stderr].filter(Boolean).join("\n").trim()}`);

    const duration = Date.now() - start;
    const success = runResult.success;

    console.log(
      `[DeploymentEngineer] Rollback ${success ? "completed" : "failed"} for ${containerName} in ${duration}ms`
    );

    return {
      success,
      tag: previousTag,
      output: steps.filter(Boolean).join("\n").trim(),
      duration
    };
  }
}
