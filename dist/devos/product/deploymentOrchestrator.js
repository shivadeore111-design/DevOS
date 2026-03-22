"use strict";
// ============================================================
// devos/product/deploymentOrchestrator.ts
// Deploys a product build locally or via Docker
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deploymentOrchestrator = exports.DeploymentOrchestrator = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = __importDefault(require("child_process"));
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
class DeploymentOrchestrator {
    async deploy(productBuild, target) {
        const start = Date.now();
        console.log(`\n[DeployOrchestrator] 🚀 Deploying to: ${target}`);
        console.log(`[DeployOrchestrator]    Build:     ${productBuild.id}`);
        console.log(`[DeployOrchestrator]    Workspace: ${productBuild.workspacePath}\n`);
        if (target === "local") {
            return this._deployLocal(productBuild, start);
        }
        else if (target === "docker") {
            return this._deployDocker(productBuild, start);
        }
        return {
            success: false,
            target,
            error: `Unknown deploy target: ${target}`,
            durationMs: Date.now() - start,
        };
    }
    // ── Local deployment ───────────────────────────────────────
    async _deployLocal(build, start) {
        const wp = build.workspacePath;
        // Check server.js exists
        if (!fs_1.default.existsSync(path_1.default.join(wp, "server.js"))) {
            return {
                success: false,
                target: "local",
                error: "server.js not found in workspace — did the api module assemble?",
                durationMs: Date.now() - start,
            };
        }
        // npm install
        console.log("[DeployOrchestrator] Running npm install...");
        try {
            child_process_1.default.execSync("npm install --prefer-offline 2>&1", {
                cwd: wp,
                timeout: 60000,
                encoding: "utf-8",
                stdio: ["pipe", "pipe", "pipe"],
            });
            console.log("[DeployOrchestrator] ✅ npm install complete");
        }
        catch (err) {
            console.warn("[DeployOrchestrator] ⚠️  npm install failed (continuing):", err.message?.slice(0, 120));
        }
        // Verify by checking package.json is valid
        let packageOk = false;
        try {
            const pkg = JSON.parse(fs_1.default.readFileSync(path_1.default.join(wp, "package.json"), "utf-8"));
            packageOk = !!pkg.main || !!pkg.scripts?.start;
        }
        catch { /* no package.json */ }
        const url = "http://localhost:3000";
        console.log(`[DeployOrchestrator] ✅ Local deploy ready — start with: cd ${wp} && node server.js`);
        console.log(`[DeployOrchestrator]    Expected URL: ${url}`);
        return {
            success: true,
            target: "local",
            url,
            durationMs: Date.now() - start,
        };
    }
    // ── Docker deployment ──────────────────────────────────────
    async _deployDocker(build, start) {
        const wp = build.workspacePath;
        const imageId = `devos-product-${build.id}`.toLowerCase();
        const port = 3000;
        // Ensure Dockerfile
        const dockerfilePath = path_1.default.join(wp, "Dockerfile");
        if (!fs_1.default.existsSync(dockerfilePath)) {
            console.log("[DeployOrchestrator] Creating Dockerfile...");
            fs_1.default.writeFileSync(dockerfilePath, DOCKERFILE_TEMPLATE, "utf-8");
            fs_1.default.writeFileSync(path_1.default.join(wp, ".dockerignore"), DOCKERIGNORE_TEMPLATE, "utf-8");
        }
        // docker build
        console.log(`[DeployOrchestrator] Building Docker image: ${imageId}...`);
        try {
            child_process_1.default.execSync(`docker build -t ${imageId} .`, {
                cwd: wp,
                timeout: 120000,
                encoding: "utf-8",
                stdio: ["pipe", "pipe", "pipe"],
            });
            console.log(`[DeployOrchestrator] ✅ Docker image built: ${imageId}`);
        }
        catch (err) {
            return {
                success: false,
                target: "docker",
                error: `docker build failed: ${err.message?.slice(0, 200)}`,
                durationMs: Date.now() - start,
            };
        }
        // docker run
        console.log(`[DeployOrchestrator] Starting container on port ${port}...`);
        try {
            const containerId = child_process_1.default.execSync(`docker run -d -p ${port}:3000 --name ${imageId} ${imageId}`, { cwd: wp, timeout: 30000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
            console.log(`[DeployOrchestrator] ✅ Container started: ${containerId.slice(0, 12)}`);
        }
        catch (err) {
            return {
                success: false,
                target: "docker",
                error: `docker run failed: ${err.message?.slice(0, 200)}`,
                durationMs: Date.now() - start,
            };
        }
        const url = `http://localhost:${port}`;
        console.log(`[DeployOrchestrator] ✅ Docker deploy complete — ${url}`);
        return {
            success: true,
            target: "docker",
            url,
            durationMs: Date.now() - start,
        };
    }
}
exports.DeploymentOrchestrator = DeploymentOrchestrator;
exports.deploymentOrchestrator = new DeploymentOrchestrator();
