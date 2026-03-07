// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// ============================================================
// skills/coding/dependencyManager.ts
// Installs, upgrades, and resolves conflicts in npm projects.
// Uses TerminalOperator internally.
// ============================================================

import fs   from "fs";
import path from "path";
import { TerminalOperator } from "../utils/terminalOperator";
import { Skill }            from "../registry";

// ── Return types ──────────────────────────────────────────────

export interface PackageInfo {
  name:    string;
  current: string;
  latest:  string;
  status:  "up-to-date" | "outdated" | "major-update" | "unknown";
}

export interface UpgradeReport {
  projectDir:    string;
  upgraded:      PackageInfo[];
  skipped:       PackageInfo[];
  errors:        string[];
  commandsRun:   string[];
  generatedAt:   string;
}

export interface ConflictResolution {
  conflicts:     string[];
  resolved:      string[];
  unresolved:    string[];
  commandsRun:   string[];
}

// ── Skill ─────────────────────────────────────────────────────

export class DependencyManager implements Skill {
  readonly name        = "dependency_manager";
  readonly description = "Installs, upgrades, and resolves npm dependency conflicts using TerminalOperator";

  async execute(args: { action: string; packages?: string[]; projectDir: string }): Promise<any> {
    switch (args.action) {
      case "install": return this.install(args.packages ?? [], args.projectDir);
      case "upgrade": return this.upgrade(args.projectDir);
      case "resolve": return this.resolveConflicts(args.projectDir);
      default: throw new Error(`Unknown action: ${args.action}`);
    }
  }

  /**
   * Install one or more npm packages.
   */
  async install(packages: string[], projectDir: string): Promise<void> {
    if (packages.length === 0) throw new Error("[DependencyManager] No packages specified");

    const terminal = new TerminalOperator(projectDir, 120_000);
    this.assertNpmProject(projectDir);

    const devPackages  = packages.filter(p => p.startsWith("@types/") || p.endsWith("-types") || ["typescript", "ts-node", "jest", "eslint", "prettier", "vitest"].some(d => p.startsWith(d)));
    const prodPackages = packages.filter(p => !devPackages.includes(p));

    if (prodPackages.length > 0) {
      const cmd = `npm install ${prodPackages.join(" ")}`;
      console.log(`[DependencyManager] Installing: ${prodPackages.join(", ")}`);
      const result = await terminal.run(cmd, projectDir);
      if (result.exitCode !== 0) throw new Error(`npm install failed: ${result.stderr}`);
    }

    if (devPackages.length > 0) {
      const cmd = `npm install --save-dev ${devPackages.join(" ")}`;
      console.log(`[DependencyManager] Installing dev: ${devPackages.join(", ")}`);
      const result = await terminal.run(cmd, projectDir);
      if (result.exitCode !== 0) throw new Error(`npm install --save-dev failed: ${result.stderr}`);
    }

    console.log(`[DependencyManager] ✅ Installed ${packages.length} package(s)`);
  }

  /**
   * Check for outdated packages and upgrade them.
   */
  async upgrade(projectDir: string): Promise<UpgradeReport> {
    this.assertNpmProject(projectDir);
    const terminal     = new TerminalOperator(projectDir, 180_000);
    const commandsRun: string[] = [];
    const errors:      string[] = [];

    // Get list of outdated packages
    const outdatedResult = await terminal.run("npm outdated --json", projectDir);
    commandsRun.push("npm outdated --json");

    let outdated: Record<string, { current: string; latest: string; wanted: string }> = {};
    try {
      outdated = JSON.parse(outdatedResult.stdout || "{}");
    } catch {
      outdated = {};
    }

    const upgraded: PackageInfo[] = [];
    const skipped:  PackageInfo[] = [];

    for (const [pkg, info] of Object.entries(outdated)) {
      const current = info.current;
      const latest  = info.latest;
      const wanted  = info.wanted;

      const isMajor = parseInt(latest.split(".")[0]) > parseInt(current.split(".")[0]);

      if (isMajor) {
        // Skip major upgrades by default — they may be breaking
        skipped.push({ name: pkg, current, latest, status: "major-update" });
        console.log(`[DependencyManager] Skipping major upgrade: ${pkg} (${current} → ${latest})`);
        continue;
      }

      // Update to wanted (patch/minor)
      const cmd = `npm install ${pkg}@${wanted}`;
      const result = await terminal.run(cmd, projectDir);
      commandsRun.push(cmd);

      if (result.exitCode === 0) {
        upgraded.push({ name: pkg, current, latest: wanted, status: "outdated" });
        console.log(`[DependencyManager] ✅ ${pkg}: ${current} → ${wanted}`);
      } else {
        errors.push(`Failed to upgrade ${pkg}: ${result.stderr}`);
        skipped.push({ name: pkg, current, latest, status: "unknown" });
      }
    }

    return {
      projectDir,
      upgraded,
      skipped,
      errors,
      commandsRun,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Resolve dependency conflicts using npm's built-in fix tools.
   */
  async resolveConflicts(projectDir: string): Promise<ConflictResolution> {
    this.assertNpmProject(projectDir);
    const terminal    = new TerminalOperator(projectDir, 180_000);
    const commandsRun: string[] = [];
    const resolved:    string[] = [];
    const unresolved:  string[] = [];

    console.log(`[DependencyManager] Resolving conflicts in ${projectDir}`);

    // Step 1: Try npm install --legacy-peer-deps
    const step1 = await terminal.run("npm install --legacy-peer-deps", projectDir);
    commandsRun.push("npm install --legacy-peer-deps");

    if (step1.exitCode === 0) {
      resolved.push("Peer dependency conflicts resolved with --legacy-peer-deps");
    } else {
      // Step 2: Delete node_modules + package-lock and reinstall
      const step2a = await terminal.run("rm -rf node_modules package-lock.json", projectDir);
      const step2b = await terminal.run("npm install --force", projectDir);
      commandsRun.push("rm -rf node_modules package-lock.json", "npm install --force");

      if (step2b.exitCode === 0) {
        resolved.push("Conflicts resolved by clean reinstall with --force");
      } else {
        unresolved.push("Could not auto-resolve. Manual intervention required.");
        unresolved.push(step2b.stderr.split("\n").slice(0, 5).join(" | "));
      }
    }

    // Step 3: Run audit fix for security issues
    const audit = await terminal.run("npm audit fix --force", projectDir);
    commandsRun.push("npm audit fix --force");
    if (audit.exitCode === 0) {
      resolved.push("Security vulnerabilities fixed via npm audit fix");
    }

    return {
      conflicts:   [],
      resolved,
      unresolved,
      commandsRun,
    };
  }

  private assertNpmProject(dir: string): void {
    if (!fs.existsSync(path.join(dir, "package.json"))) {
      throw new Error(`Not an npm project (no package.json): ${dir}`);
    }
  }
}

export const dependencyManager = new DependencyManager();
