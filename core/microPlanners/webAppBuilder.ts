// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/microPlanners/webAppBuilder.ts — React / Vite web app scaffold

import { ParsedGoal } from "../goalParser"
import { osContext }  from "../osContext"

export class WebAppBuilderPlanner {

  canHandle(g: ParsedGoal): boolean {
    const hasFrontend = g.stack.includes("react") || g.stack.includes("vue") ||
                        g.stack.includes("typescript")
    return (g.type === "build" && (g.domain === "frontend" || g.domain === "fullstack")) ||
           (g.type === "build" && hasFrontend)
  }

  buildPlan(g: ParsedGoal): any {
    const useVue      = g.stack.includes("vue")
    const useTS       = g.stack.includes("typescript")
    const isWindows   = osContext.platform === "win32"

    const template = useVue
      ? (useTS ? "vue-ts" : "vue")
      : (useTS ? "react-ts" : "react")

    const appName  = "app"

    // ── App.jsx (or App.tsx) content ──────────────────────────
    const featureList = g.features.length
      ? g.features.map(f => `      <li>${f}</li>`).join("\n")
      : "      <li>Your feature here</li>"

    const appJsx = useVue
      ? `<template>
  <div class="app">
    <h1>🚀 DevOS App</h1>
    <p>Built with Vue by DevOS</p>
    <ul>
      ${g.features.map(f => `<li>${f}</li>`).join("\n      ")}
    </ul>
  </div>
</template>

<script setup>
// Component logic goes here
</script>

<style scoped>
.app { font-family: system-ui; max-width: 800px; margin: 0 auto; padding: 2rem; }
h1   { color: #646cff; }
</style>
`
      : `import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div style={{ fontFamily: 'system-ui', maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
      <h1>🚀 DevOS App</h1>
      <p>Built with React by DevOS</p>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
      <ul>
${featureList}
      </ul>
    </div>
  )
}

export default App
`

    const appFile = useVue
      ? `${appName}/src/App.vue`
      : `${appName}/src/App.${useTS ? "tsx" : "jsx"}`

    // ── npm create command ────────────────────────────────────
    // On Windows, npx handles the quoting correctly
    const createCmd = `npm create vite@latest ${appName} -- --template ${template}`
    const installCmd = isWindows
      ? `cd ${appName} && npm install`
      : `cd ${appName} && npm install`
    const devCmd = isWindows
      ? `cd ${appName} && npm run dev`
      : `cd ${appName} && npm run dev`

    return {
      summary:    `${useVue ? "Vue" : "React"} web app — ${g.features.join(", ") || "basic UI"}`,
      complexity: "low",
      actions: [
        {
          type:        "shell_exec",
          description: `Scaffold a ${useVue ? "Vue" : "React"} app with Vite`,
          command:     createCmd,
          risk:        "low",
        },
        {
          type:        "shell_exec",
          description: "Install project dependencies",
          command:     installCmd,
          risk:        "low",
        },
        {
          type:        "file_write",
          description: `Write main App component with project features`,
          path:        appFile,
          content:     appJsx,
          risk:        "low",
        },
        {
          type:        "shell_exec",
          description: "Start Vite dev server",
          command:     devCmd,
          risk:        "low",
        },
      ],
      _source: "micro-planner:webAppBuilder",
    }
  }
}

export const webAppBuilderPlanner = new WebAppBuilderPlanner()
