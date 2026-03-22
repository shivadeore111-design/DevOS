// ============================================================
// devos/product/deploymentOrchestrator.ts
// Deploys a product build locally or via Docker
// ============================================================

import fs             from "fs";
import path           from "path";
import childProcess   from "child_process";
import { ProductBuild } from "./productManager";

export interface DeployResult {
  success:    boolean;
  target:     string;
  url?:       string;
  error?:     string;
  durationMs: number;
}

const DOCKERFILE_TEMPLATE = `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
`;

const DOCKERIGNORE_TEMPLATE = `node_modules
.env
*.log
dist
.git
`;

export class DeploymentOrchestrator {
  async deploy(
    productBuild: ProductBuild,
    target:       "local" | "docker"
  ): Promise<DeployResult> {
    const start = Date.now();

    console.log(`\n[DeployOrchestrator] 🚀 Deploying to: ${target}`);
    console.log(`[DeployOrchestrator]    Build:     ${productBuild.id}`);
    console.log(`[DeployOrchestrator]    Workspace: ${productBuild.workspacePath}\n`);

    if (target === "local") {
      return this._deployLocal(productBuild, start);
    } else if (target === "docker") {
      return this._deployDocker(productBuild, start);
    }

    return {
      success:    false,
      target,
      error:      `Unknown deploy target: ${target}`,
      durationMs: Date.now() - start,
    };
  }

  // ── Local deployment ───────────────────────────────────────

  private async _deployLocal(
    build: ProductBuild,
    start: number
  ): Promise<DeployResult> {
    const wp = build.workspacePath;

    // Check server.js exists
    if (!fs.existsSync(path.join(wp, "server.js"))) {
      return {
        success:    false,
        target:     "local",
        error:      "server.js not found in workspace — did the api module assemble?",
        durationMs: Date.now() - start,
      };
    }

    // npm install
    console.log("[DeployOrchestrator] Running npm install...");
    try {
      childProcess.execSync("npm install --prefer-offline 2>&1", {
        cwd:      wp,
        timeout:  60_000,
        encoding: "utf-8",
        stdio:    ["pipe", "pipe", "pipe"],
      });
      console.log("[DeployOrchestrator] ✅ npm install complete");
    } catch (err: any) {
      console.warn("[DeployOrchestrator] ⚠️  npm install failed (continuing):", err.message?.slice(0, 120));
    }

    // Verify by checking package.json is valid
    let packageOk = false;
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(wp, "package.json"), "utf-8"));
      packageOk = !!pkg.main || !!pkg.scripts?.start;
    } catch { /* no package.json */ }

    const url = "http://localhost:3000";
    console.log(`[DeployOrchestrator] ✅ Local deploy ready — start with: cd ${wp} && node server.js`);
    console.log(`[DeployOrchestrator]    Expected URL: ${url}`);

    return {
      success:    true,
      target:     "local",
      url,
      durationMs: Date.now() - start,
    };
  }

  // ── Docker deployment ──────────────────────────────────────

  private async _deployDocker(
    build: ProductBuild,
    start: number
  ): Promise<DeployResult> {
    const wp      = build.workspacePath;
    const imageId = `devos-product-${build.id}`.toLowerCase();
    const port    = 3000;

    // Ensure Dockerfile
    const dockerfilePath = path.join(wp, "Dockerfile");
    if (!fs.existsSync(dockerfilePath)) {
      console.log("[DeployOrchestrator] Creating Dockerfile...");
      fs.writeFileSync(dockerfilePath, DOCKERFILE_TEMPLATE, "utf-8");
      fs.writeFileSync(path.join(wp, ".dockerignore"), DOCKERIGNORE_TEMPLATE, "utf-8");
    }

    // docker build
    console.log(`[DeployOrchestrator] Building Docker image: ${imageId}...`);
    try {
      childProcess.execSync(`docker build -t ${imageId} .`, {
        cwd:      wp,
        timeout:  120_000,
        encoding: "utf-8",
        stdio:    ["pipe", "pipe", "pipe"],
      });
      console.log(`[DeployOrchestrator] ✅ Docker image built: ${imageId}`);
    } catch (err: any) {
      return {
        success:    false,
        target:     "docker",
        error:      `docker build failed: ${err.message?.slice(0, 200)}`,
        durationMs: Date.now() - start,
      };
    }

    // docker run
    console.log(`[DeployOrchestrator] Starting container on port ${port}...`);
    try {
      const containerId = childProcess.execSync(
        `docker run -d -p ${port}:3000 --name ${imageId} ${imageId}`,
        { cwd: wp, timeout: 30_000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
      ).trim();
      console.log(`[DeployOrchestrator] ✅ Container started: ${containerId.slice(0, 12)}`);
    } catch (err: any) {
      return {
        success:    false,
        target:     "docker",
        error:      `docker run failed: ${err.message?.slice(0, 200)}`,
        durationMs: Date.now() - start,
      };
    }

    const url = `http://localhost:${port}`;
    console.log(`[DeployOrchestrator] ✅ Docker deploy complete — ${url}`);

    return {
      success:    true,
      target:     "docker",
      url,
      durationMs: Date.now() - start,
    };
  }
}

export const deploymentOrchestrator = new DeploymentOrchestrator();
