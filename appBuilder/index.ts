// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import { planProject } from "./planner";
import { generateStructure } from "./generator";
import { runProject } from "./runner";

async function main() {
  const idea = process.argv.slice(2).join(" ");

  if (!idea) {
    console.log("Please provide an app idea.");
    process.exit(1);
  }

  try {
    console.log("\n🧠 Planning project...");
    const plan = await planProject(idea);

    console.log("\n📁 Generating structure...");
    const structure = await generateStructure(plan);

    console.log("\n🚀 Installing dependencies and starting server...");
    await runProject(structure.rootDir);

    console.log("\n✅ Kitchen Engine build complete.");
  } catch (err) {
    console.error("\n❌ Build failed:", err);
  }
}

main();