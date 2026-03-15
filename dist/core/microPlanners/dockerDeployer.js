"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.dockerDeployerPlanner = exports.DockerDeployerPlanner = void 0;
const DEFAULT_PORT = 3000;
class DockerDeployerPlanner {
    canHandle(g) {
        return g.type === "deploy" ||
            g.stack.includes("docker") ||
            g.domain === "devops";
    }
    buildPlan(g) {
        const raw = g.raw;
        const appName = "app";
        const port = DEFAULT_PORT;
        // Detect base runtime
        const usePython = g.stack.includes("python");
        const useNode = !usePython;
        const dockerfile = useNode
            ? `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE ${port}
CMD ["node", "server.js"]
`
            : `FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE ${port}
CMD ["python", "app.py"]
`;
        const dockerignore = `node_modules
.git
*.log
dist
.env
`;
        return {
            summary: `Containerise and deploy ${g.features.join(", ") || "application"} with Docker`,
            complexity: "medium",
            actions: [
                {
                    type: "file_write",
                    description: `Create ${useNode ? "Node.js" : "Python"} Dockerfile`,
                    path: "Dockerfile",
                    content: dockerfile,
                    risk: "low",
                },
                {
                    type: "file_write",
                    description: "Create .dockerignore to keep image small",
                    path: ".dockerignore",
                    content: dockerignore,
                    risk: "low",
                },
                {
                    type: "shell_exec",
                    description: `Build Docker image tagged as ${appName}`,
                    command: `docker build -t ${appName} .`,
                    risk: "medium",
                },
                {
                    type: "shell_exec",
                    description: `Run container in detached mode on port ${port}`,
                    command: `docker run -d -p ${port}:${port} --name ${appName} ${appName}`,
                    risk: "medium",
                },
                {
                    type: "shell_exec",
                    description: "Verify container is running",
                    command: "docker ps",
                    risk: "low",
                },
            ],
            _source: "micro-planner:dockerDeployer",
        };
    }
}
exports.DockerDeployerPlanner = DockerDeployerPlanner;
exports.dockerDeployerPlanner = new DockerDeployerPlanner();
