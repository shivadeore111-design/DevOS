"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateStructure = generateStructure;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
async function generateStructure(plan) {
    const rootDir = path_1.default.join(process.cwd(), "generatedApps", plan.projectName);
    const srcDir = path_1.default.join(rootDir, "src");
    const routesDir = path_1.default.join(srcDir, "routes");
    fs_1.default.mkdirSync(routesDir, { recursive: true });
    createPackageJson(rootDir, plan.projectName);
    createTsConfig(rootDir);
    createServerFile(srcDir);
    createBaseRoute(routesDir);
    return {
        rootDir,
        routesDir
    };
}
function createPackageJson(rootDir, name) {
    const pkg = {
        name,
        version: "1.0.0",
        main: "dist/server.js",
        scripts: {
            dev: "ts-node src/server.ts",
            build: "tsc",
            start: "node dist/server.js"
        },
        dependencies: {
            express: "^4.18.2",
            cors: "^2.8.5"
        },
        devDependencies: {
            typescript: "^5.3.3",
            "ts-node": "^10.9.1",
            "@types/express": "^4.17.21",
            "@types/node": "^20.10.5"
        }
    };
    fs_1.default.writeFileSync(path_1.default.join(rootDir, "package.json"), JSON.stringify(pkg, null, 2));
}
function createTsConfig(rootDir) {
    const tsconfig = {
        compilerOptions: {
            target: "ES2020",
            module: "CommonJS",
            rootDir: "src",
            outDir: "dist",
            esModuleInterop: true,
            strict: true
        }
    };
    fs_1.default.writeFileSync(path_1.default.join(rootDir, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));
}
function createServerFile(srcDir) {
    const content = `
import express from "express";
import cors from "cors";
import routes from "./routes";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api", routes);

app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log("Server running on http://localhost:" + PORT);
});
`;
    fs_1.default.writeFileSync(path_1.default.join(srcDir, "server.ts"), content.trim());
}
function createBaseRoute(routesDir) {
    const content = `
import { Router } from "express";

const router = Router();

router.get("/", (_, res) => {
  res.json({ message: "API is live" });
});

export default router;
`;
    fs_1.default.writeFileSync(path_1.default.join(routesDir, "index.ts"), content.trim());
}
