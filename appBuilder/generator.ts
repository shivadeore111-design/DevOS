// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import fs from "fs";
import path from "path";

export async function generateStructure(plan: any) {
  const rootDir = path.join(process.cwd(), "generatedApps", plan.projectName);

  const srcDir = path.join(rootDir, "src");
  const routesDir = path.join(srcDir, "routes");

  fs.mkdirSync(routesDir, { recursive: true });

  createPackageJson(rootDir, plan.projectName);
  createTsConfig(rootDir);
  createServerFile(srcDir);
  createBaseRoute(routesDir);

  return {
    rootDir,
    routesDir
  };
}

function createPackageJson(rootDir: string, name: string) {
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

  fs.writeFileSync(
    path.join(rootDir, "package.json"),
    JSON.stringify(pkg, null, 2)
  );
}

function createTsConfig(rootDir: string) {
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

  fs.writeFileSync(
    path.join(rootDir, "tsconfig.json"),
    JSON.stringify(tsconfig, null, 2)
  );
}

function createServerFile(srcDir: string) {
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

  fs.writeFileSync(path.join(srcDir, "server.ts"), content.trim());
}

function createBaseRoute(routesDir: string) {
  const content = `
import { Router } from "express";

const router = Router();

router.get("/", (_, res) => {
  res.json({ message: "API is live" });
});

export default router;
`;

  fs.writeFileSync(path.join(routesDir, "index.ts"), content.trim());
}