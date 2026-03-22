// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import { execa } from "execa";
import fs from "fs";
import path from "path";

export async function runGitPushSkill(projectRoot: string) {
  console.log("🧩 Running Git clean reset & push skill...");

  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable not set.");
  }

  const repoUrl =
    `https://shivadeore111-design:${token}@github.com/shivadeore111-design/strategy-lab-backend.git`;

  const gitFolder = path.join(projectRoot, ".git");

  // Remove .git completely to avoid inherited history
  if (fs.existsSync(gitFolder)) {
    console.log("🧹 Removing existing git history...");
    fs.rmSync(gitFolder, { recursive: true, force: true });
  }

  // Initialize fresh repo
  await execa("git init", { shell: true, cwd: projectRoot });

  // Set correct identity
  await execa('git config user.name "Shiva Deore"', {
    shell: true,
    cwd: projectRoot
  });

  await execa('git config user.email "shiva.deore111@gmail.com"', {
    shell: true,
    cwd: projectRoot
  });

  await execa("git add .", { shell: true, cwd: projectRoot });

  await execa('git commit -m "Fresh commit from DevOS"', {
    shell: true,
    cwd: projectRoot
  });

  await execa(`git remote add origin ${repoUrl}`, {
    shell: true,
    cwd: projectRoot
  });

  await execa("git branch -M main", {
    shell: true,
    cwd: projectRoot
  });

  // 🔥 Force push to overwrite old author history
  await execa("git push -u origin main --force", {
    shell: true,
    cwd: projectRoot
  });

  console.log("🚀 Fresh history pushed with correct author.");
}