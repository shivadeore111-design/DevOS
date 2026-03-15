"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectScaffolder = exports.ProjectScaffolder = void 0;
// ============================================================
// skills/planning/projectScaffolder.ts
// Creates full project directory structures with boilerplate files.
// Supports: express-api, nextjs, fastapi, react, cli-tool
// ============================================================
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const terminalOperator_1 = require("../utils/terminalOperator");
// ── Skill ─────────────────────────────────────────────────────
class ProjectScaffolder {
    constructor() {
        this.name = "project_scaffolder";
        this.description = "Creates full project directory structures with boilerplate for express-api, nextjs, fastapi, react, cli-tool";
    }
    async execute(args) {
        return this.scaffold(args.projectType, args.name, args.outputDir);
    }
    async scaffold(projectType, name, outputDir) {
        const projectDir = path_1.default.resolve(outputDir, name);
        const terminal = new terminalOperator_1.TerminalOperator(projectDir, 120000);
        const filesCreated = [];
        const commandsRun = [];
        console.log(`[ProjectScaffolder] Scaffolding ${projectType} → ${projectDir}`);
        try {
            fs_1.default.mkdirSync(projectDir, { recursive: true });
            switch (projectType) {
                case "express-api":
                    await this.scaffoldExpressAPI(name, projectDir, terminal, filesCreated, commandsRun);
                    break;
                case "nextjs":
                    await this.scaffoldNextJS(name, projectDir, terminal, filesCreated, commandsRun);
                    break;
                case "fastapi":
                    await this.scaffoldFastAPI(name, projectDir, terminal, filesCreated, commandsRun);
                    break;
                case "react":
                    await this.scaffoldReact(name, projectDir, terminal, filesCreated, commandsRun);
                    break;
                case "cli-tool":
                    await this.scaffoldCLI(name, projectDir, terminal, filesCreated, commandsRun);
                    break;
                default:
                    throw new Error(`Unknown project type: ${projectType}`);
            }
            return { projectDir, filesCreated, commandsRun, success: true };
        }
        catch (err) {
            return { projectDir, filesCreated, commandsRun, success: false, error: err.message };
        }
    }
    // ── Express API ───────────────────────────────────────────
    async scaffoldExpressAPI(name, dir, terminal, files, cmds) {
        const write = (rel, content) => this.writeFile(dir, rel, content, files);
        write("package.json", JSON.stringify({
            name,
            version: "1.0.0",
            description: `${name} REST API`,
            main: "dist/index.js",
            scripts: { dev: "ts-node src/index.ts", build: "tsc", start: "node dist/index.js", test: "jest" },
            dependencies: { express: "^4.18.2", cors: "^2.8.5", helmet: "^7.0.0", dotenv: "^16.0.3" },
            devDependencies: { typescript: "^5.0.0", "ts-node": "^10.9.1", "@types/express": "^4.17.17", "@types/node": "^20.0.0" },
        }, null, 2));
        write("tsconfig.json", JSON.stringify({
            compilerOptions: { target: "ES2020", module: "commonjs", outDir: "dist", rootDir: "src", strict: true, esModuleInterop: true },
        }, null, 2));
        write(".env.example", "PORT=3000\nNODE_ENV=development\n");
        write(".gitignore", "node_modules/\ndist/\n.env\n");
        write("src/index.ts", [
            `import express from 'express';`,
            `import cors    from 'cors';`,
            `import helmet  from 'helmet';`,
            `import 'dotenv/config';`,
            ``,
            `const app  = express();`,
            `const PORT = process.env.PORT ?? 3000;`,
            ``,
            `app.use(cors());`,
            `app.use(helmet());`,
            `app.use(express.json());`,
            ``,
            `app.get('/health', (_req, res) => res.json({ status: 'ok', service: '${name}' }));`,
            ``,
            `app.listen(PORT, () => console.log(\`[${name}] Listening on port \${PORT}\`));`,
        ].join("\n"));
        write("src/routes/index.ts", `import { Router } from 'express';\nexport const router = Router();\n`);
        write("src/middleware/auth.ts", `import { Request, Response, NextFunction } from 'express';\nexport function auth(req: Request, res: Response, next: NextFunction) { next(); }\n`);
        write("README.md", `# ${name}\n\nExpress REST API.\n\n## Start\n\n\`\`\`bash\nnpm install && npm run dev\n\`\`\`\n`);
        const result = await terminal.run("npm install", dir);
        cmds.push("npm install");
        if (result.exitCode !== 0)
            console.warn("[ProjectScaffolder] npm install warning:", result.stderr);
    }
    // ── Next.js ───────────────────────────────────────────────
    async scaffoldNextJS(name, dir, terminal, files, cmds) {
        const write = (rel, content) => this.writeFile(dir, rel, content, files);
        write("package.json", JSON.stringify({
            name,
            version: "1.0.0",
            scripts: { dev: "next dev", build: "next build", start: "next start", lint: "next lint" },
            dependencies: { next: "^14.0.0", react: "^18.0.0", "react-dom": "^18.0.0" },
            devDependencies: { typescript: "^5.0.0", "@types/react": "^18.0.0", "@types/node": "^20.0.0" },
        }, null, 2));
        write("tsconfig.json", JSON.stringify({
            compilerOptions: { target: "ES2017", lib: ["dom", "ES2017"], allowJs: true, skipLibCheck: true, strict: true, noEmit: true, esModuleInterop: true, module: "esnext", moduleResolution: "bundler", resolveJsonModule: true, isolatedModules: true, jsx: "preserve", incremental: true, paths: { "@/*": ["./src/*"] } },
            include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
        }, null, 2));
        write("next.config.js", `/** @type {import('next').NextConfig} */\nmodule.exports = {};\n`);
        write(".gitignore", ".next/\nnode_modules/\n.env*.local\n");
        write("src/app/layout.tsx", `export default function RootLayout({ children }: { children: React.ReactNode }) {\n  return <html lang="en"><body>{children}</body></html>;\n}\n`);
        write("src/app/page.tsx", `export default function Home() {\n  return <main><h1>${name}</h1></main>;\n}\n`);
        write("src/app/globals.css", "* { box-sizing: border-box; margin: 0; padding: 0; }\n");
        cmds.push("(skipped npm install for Next.js — run manually)");
    }
    // ── FastAPI ───────────────────────────────────────────────
    async scaffoldFastAPI(name, dir, _terminal, files, cmds) {
        const write = (rel, content) => this.writeFile(dir, rel, content, files);
        const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "_");
        write("requirements.txt", "fastapi>=0.104.0\nuvicorn[standard]>=0.24.0\npydantic>=2.0.0\npython-dotenv>=1.0.0\n");
        write(".env.example", "APP_ENV=development\nSECRET_KEY=changeme\n");
        write(".gitignore", "__pycache__/\n*.pyc\n.env\nvenv/\n.venv/\n");
        write(`${slug}/main.py`, [
            `from fastapi import FastAPI`,
            `from fastapi.middleware.cors import CORSMiddleware`,
            ``,
            `app = FastAPI(title="${name}", version="1.0.0")`,
            ``,
            `app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])`,
            ``,
            `@app.get("/health")`,
            `async def health():`,
            `    return {"status": "ok", "service": "${name}"}`,
        ].join("\n"));
        write(`${slug}/routers/__init__.py`, "");
        write(`${slug}/models/__init__.py`, "");
        write(`${slug}/schemas/__init__.py`, "");
        write("README.md", `# ${name}\n\nFastAPI app.\n\n## Start\n\n\`\`\`bash\npip install -r requirements.txt\nuvicorn ${slug}.main:app --reload\n\`\`\`\n`);
        cmds.push("(Python deps: pip install -r requirements.txt)");
    }
    // ── React SPA ─────────────────────────────────────────────
    async scaffoldReact(name, dir, _terminal, files, cmds) {
        const write = (rel, content) => this.writeFile(dir, rel, content, files);
        write("package.json", JSON.stringify({
            name,
            version: "1.0.0",
            type: "module",
            scripts: { dev: "vite", build: "tsc && vite build", preview: "vite preview" },
            dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
            devDependencies: { "@types/react": "^18.2.0", "@types/react-dom": "^18.2.0", "@vitejs/plugin-react": "^4.0.0", typescript: "^5.0.0", vite: "^5.0.0" },
        }, null, 2));
        write("vite.config.ts", `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins: [react()] });\n`);
        write("tsconfig.json", JSON.stringify({ compilerOptions: { target: "ES2020", useDefineForClassFields: true, lib: ["ES2020", "DOM"], module: "ESNext", skipLibCheck: true, moduleResolution: "bundler", allowImportingTsExtensions: true, isolatedModules: true, noEmit: true, jsx: "react-jsx", strict: true }, include: ["src"] }, null, 2));
        write("index.html", `<!DOCTYPE html>\n<html lang="en"><head><meta charset="UTF-8"/><title>${name}</title></head>\n<body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n`);
        write("src/main.tsx", `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\nReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);\n`);
        write("src/App.tsx", `export default function App() { return <div><h1>${name}</h1></div>; }\n`);
        write(".gitignore", "node_modules/\ndist/\n");
        cmds.push("(run: npm install && npm run dev)");
    }
    // ── CLI Tool ──────────────────────────────────────────────
    async scaffoldCLI(name, dir, terminal, files, cmds) {
        const write = (rel, content) => this.writeFile(dir, rel, content, files);
        const bin = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
        write("package.json", JSON.stringify({
            name,
            version: "1.0.0",
            bin: { [bin]: "./dist/cli.js" },
            scripts: { dev: "ts-node src/cli.ts", build: "tsc", start: `node dist/cli.js` },
            dependencies: { commander: "^11.0.0", chalk: "^5.3.0", dotenv: "^16.0.0" },
            devDependencies: { typescript: "^5.0.0", "ts-node": "^10.9.1", "@types/node": "^20.0.0" },
        }, null, 2));
        write("tsconfig.json", JSON.stringify({
            compilerOptions: { target: "ES2020", module: "commonjs", outDir: "dist", rootDir: "src", strict: true, esModuleInterop: true },
        }, null, 2));
        write("src/cli.ts", [
            `#!/usr/bin/env node`,
            `import { Command } from 'commander';`,
            ``,
            `const program = new Command();`,
            ``,
            `program`,
            `  .name('${bin}')`,
            `  .description('${name} CLI')`,
            `  .version('1.0.0');`,
            ``,
            `program`,
            `  .command('run <input>')`,
            `  .description('Run the main command')`,
            `  .action((input: string) => {`,
            `    console.log(\`Running: \${input}\`);`,
            `  });`,
            ``,
            `program.parse();`,
        ].join("\n"));
        write("src/index.ts", `export * from './cli';\n`);
        write(".gitignore", "node_modules/\ndist/\n");
        write("README.md", `# ${name}\n\n\`\`\`bash\nnpm install && npm run build && node dist/cli.js run hello\n\`\`\`\n`);
        const result = await terminal.run("npm install", dir);
        cmds.push("npm install");
        if (result.exitCode !== 0)
            console.warn("[ProjectScaffolder] npm install warning:", result.stderr);
    }
    // ── Helpers ───────────────────────────────────────────────
    writeFile(baseDir, relative, content, tracker) {
        const fullPath = path_1.default.join(baseDir, relative);
        fs_1.default.mkdirSync(path_1.default.dirname(fullPath), { recursive: true });
        fs_1.default.writeFileSync(fullPath, content, "utf-8");
        tracker.push(relative);
    }
}
exports.ProjectScaffolder = ProjectScaffolder;
exports.projectScaffolder = new ProjectScaffolder();
