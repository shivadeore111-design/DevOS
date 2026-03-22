// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// skills/webcraft/index.js — WebCraft skill: clone any website as React + Tailwind
// Steps:
//   1. browserFetcher.fetch(url) → raw HTML
//   2. LLM extract design system → JSON
//   3. blueprintStore.matchTemplate(complexity) → base template
//   4. LLM generate React App.tsx from design + template
//   5. file_write each component
//   6. npm run build → verify exit 0

"use strict";

const path = require("path");
const fs   = require("fs");
const { execSync } = require("child_process");

/**
 * Entry point called by skillLoader.run("webcraft", { url, projectName })
 * @param {Object} params
 * @param {string} params.url         - Website URL to clone
 * @param {string} [params.projectName="my-clone"] - Project folder name
 */
async function run(params = {}) {
  const { url, projectName = "my-clone" } = params;

  if (!url) {
    throw new Error("[WebCraft] url parameter is required");
  }

  console.log(`[WebCraft] Starting clone of ${url} → project: ${projectName}`);

  // ── Step 1: Fetch the page ──────────────────────────────────
  const { browserFetcher } = require("../../web/browserFetcher");

  console.log("[WebCraft] Step 1/6 — Fetching page...");
  const pageResult = await browserFetcher.fetch(url, { waitFor: "networkidle" });

  if (!pageResult.success || !pageResult.html) {
    throw new Error(`[WebCraft] Failed to fetch ${url}: ${pageResult.error ?? "no HTML returned"}`);
  }

  console.log(`[WebCraft] Fetched: "${pageResult.title}" (${pageResult.html.length} chars)`);

  // ── Step 2: Extract design system ──────────────────────────
  const { callOllama } = require("../../llm/ollama");

  console.log("[WebCraft] Step 2/6 — Extracting design system...");

  const designPrompt =
    `Analyse this HTML and extract the design system. Return ONLY valid JSON:\n` +
    `{\n` +
    `  "colors": { "primary": "#hex", "secondary": "#hex", "background": "#hex", "text": "#hex", "accent": "#hex" },\n` +
    `  "typography": { "fontFamily": "...", "headingSize": "...", "bodySize": "..." },\n` +
    `  "layout": "single-column|two-column|grid|hero-sections",\n` +
    `  "sections": ["hero","features","pricing","testimonials","footer"],\n` +
    `  "style": "minimal|bold|corporate|playful|dark|glassmorphism",\n` +
    `  "complexity": "simple|medium|complex"\n` +
    `}\n\n` +
    `HTML (first 8000 chars):\n${pageResult.html.slice(0, 8000)}`;

  const designRaw    = await callOllama(designPrompt);
  const designSystem = _parseJson(designRaw) ?? {
    colors:     { primary: "#6366f1", secondary: "#8b5cf6", background: "#ffffff", text: "#111827", accent: "#f59e0b" },
    typography: { fontFamily: "Inter, sans-serif", headingSize: "2.5rem", bodySize: "1rem" },
    layout:     "hero-sections",
    sections:   ["hero", "features", "cta", "footer"],
    style:      "minimal",
    complexity: "medium",
  };

  console.log(`[WebCraft] Design: style=${designSystem.style}, layout=${designSystem.layout}, sections=${designSystem.sections?.join(",")}`);

  // ── Step 3: Match base template ─────────────────────────────
  const { blueprintStore } = require("../../blueprints/blueprintStore");

  console.log("[WebCraft] Step 3/6 — Matching base template...");
  const complexityDesc = `react frontend ${designSystem.style} ${designSystem.layout} landing page`;
  const template       = await blueprintStore.matchTemplate(complexityDesc);
  console.log(`[WebCraft] Template: ${template.name}`);

  // ── Step 4: Generate React App.tsx ──────────────────────────
  console.log("[WebCraft] Step 4/6 — Generating React + Tailwind App.tsx...");

  const sections = (designSystem.sections ?? ["hero", "features", "footer"])
    .map(s => `<${_capitalize(s)}Section />`)
    .join("\n        ");

  const appPrompt =
    `You are a React + Tailwind expert. Generate a complete, runnable App.tsx that clones this website's design.\n\n` +
    `Website: ${url}\n` +
    `Title: ${pageResult.title ?? "Cloned Site"}\n\n` +
    `Design system:\n${JSON.stringify(designSystem, null, 2)}\n\n` +
    `Requirements:\n` +
    `- Use React functional components + TypeScript\n` +
    `- Use Tailwind CSS utility classes only (no custom CSS files)\n` +
    `- Include ALL these sections as separate components: ${designSystem.sections?.join(", ")}\n` +
    `- Apply the exact color palette from the design system using Tailwind arbitrary values like [#hex]\n` +
    `- Match the typography, spacing, and layout style\n` +
    `- Export a default App component that renders all sections\n` +
    `- Include a realistic footer with copyright\n` +
    `- Make it fully responsive (mobile-first)\n` +
    `- Return ONLY the TypeScript code, no markdown fences\n\n` +
    `Generate the complete App.tsx:`;

  const appTsx = await callOllama(appPrompt);

  // ── Step 5: Write project files ─────────────────────────────
  console.log("[WebCraft] Step 5/6 — Writing project files...");

  const dest    = path.join(process.cwd(), "workspace", projectName);
  const srcDir  = path.join(dest, "src");
  const pubDir  = path.join(dest, "public");

  fs.mkdirSync(srcDir,  { recursive: true });
  fs.mkdirSync(pubDir,  { recursive: true });

  // App.tsx
  const cleanTsx = _stripCodeFences(appTsx);
  fs.writeFileSync(path.join(srcDir, "App.tsx"), cleanTsx, "utf-8");
  console.log(`[WebCraft]   ✅ src/App.tsx (${cleanTsx.length} chars)`);

  // main.tsx
  const mainTsx = `import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
`;
  fs.writeFileSync(path.join(srcDir, "main.tsx"), mainTsx, "utf-8");

  // index.css
  const indexCss = `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`;
  fs.writeFileSync(path.join(srcDir, "index.css"), indexCss, "utf-8");

  // index.html
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${_escapeHtml(pageResult.title ?? projectName)}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
  fs.writeFileSync(path.join(dest, "index.html"), indexHtml, "utf-8");

  // package.json
  const pkg = {
    name:    projectName,
    version: "0.1.0",
    private: true,
    scripts: {
      dev:     "vite",
      build:   "tsc && vite build",
      preview: "vite preview",
    },
    dependencies: {
      react:     "^18.2.0",
      "react-dom": "^18.2.0",
    },
    devDependencies: {
      "@types/react":     "^18.2.0",
      "@types/react-dom": "^18.2.0",
      "@vitejs/plugin-react": "^4.0.0",
      autoprefixer:     "^10.4.0",
      postcss:          "^8.4.0",
      tailwindcss:      "^3.4.0",
      typescript:       "^5.0.0",
      vite:             "^5.0.0",
    },
  };
  fs.writeFileSync(path.join(dest, "package.json"), JSON.stringify(pkg, null, 2), "utf-8");

  // tailwind.config.js
  const tailwindCfg = `/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
}
`;
  fs.writeFileSync(path.join(dest, "tailwind.config.js"), tailwindCfg, "utf-8");

  // postcss.config.js
  const postcssCfg = `export default { plugins: { tailwindcss: {}, autoprefixer: {} } }\n`;
  fs.writeFileSync(path.join(dest, "postcss.config.js"), postcssCfg, "utf-8");

  // tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: "ES2020", useDefineForClassFields: true,
      lib: ["ES2020", "DOM", "DOM.Iterable"],
      module: "ESNext", skipLibCheck: true,
      moduleResolution: "bundler", allowImportingTsExtensions: true,
      resolveJsonModule: true, isolatedModules: true, noEmit: true,
      jsx: "react-jsx", strict: true, noUnusedLocals: true,
      noUnusedParameters: true, noFallthroughCasesInSwitch: true,
    },
    include: ["src"],
  };
  fs.writeFileSync(path.join(dest, "tsconfig.json"), JSON.stringify(tsconfig, null, 2), "utf-8");

  // vite.config.ts
  const viteCfg = `import { defineConfig } from "vite"\nimport react from "@vitejs/plugin-react"\nexport default defineConfig({ plugins: [react()] })\n`;
  fs.writeFileSync(path.join(dest, "vite.config.ts"), viteCfg, "utf-8");

  console.log(`[WebCraft]   ✅ All project files written → ${dest}`);

  // ── Step 6: Install + verify build ──────────────────────────
  console.log("[WebCraft] Step 6/6 — Installing dependencies and verifying build...");

  try {
    console.log("[WebCraft]   npm install...");
    execSync("npm install", { cwd: dest, stdio: "inherit" });

    console.log("[WebCraft]   npm run build...");
    execSync("npm run build", { cwd: dest, stdio: "inherit" });

    console.log(`\n[WebCraft] ✅ Clone complete!`);
    console.log(`   Project: ${dest}`);
    console.log(`   Run:     cd "${dest}" && npm run dev`);
  } catch (buildErr) {
    console.warn(`[WebCraft] ⚠️  Build verification failed (project still created): ${buildErr.message}`);
    console.log(`[WebCraft]   Manually run: cd "${dest}" && npm install && npm run build`);
  }

  return { success: true, projectPath: dest };
}

// ── Helpers ───────────────────────────────────────────────────

function _parseJson(text) {
  try { return JSON.parse(text.trim()) } catch {}
  const match = text.match(/\{[\s\S]*\}/)
  if (match) { try { return JSON.parse(match[0]) } catch {} }
  return null
}

function _stripCodeFences(text) {
  return text
    .replace(/^```(?:tsx?|jsx?|typescript)?\n?/m, "")
    .replace(/\n?```\s*$/m, "")
    .trim()
}

function _capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function _escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

module.exports = { run }
