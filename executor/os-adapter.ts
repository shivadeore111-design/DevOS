// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import os from "os";

export interface RuntimeShell {
  shell: string;
  flag: string;
}

// ─────────────────────────────────────────────
// PLATFORM
// ─────────────────────────────────────────────

export type Platform = "windows" | "unix";

export function detectPlatform(): Platform {
  return os.platform() === "win32" ? "windows" : "unix";
}

export const CURRENT_PLATFORM: Platform = detectPlatform();

export function getRuntimeShell(): RuntimeShell {
  const isWindows = os.platform() === "win32";
  return {
    shell: isWindows ? "cmd.exe" : "/bin/bash",
    flag: isWindows ? "/c" : "-c",
  };
}

// ─────────────────────────────────────────────
// ADAPT RESULT TYPE
// ─────────────────────────────────────────────

export interface AdaptResult {
  original: string;
  translated: string;
  wasTranslated: boolean;
  blocked: boolean;
  blockReason?: string;
}

// ─────────────────────────────────────────────
// OS ADAPTER
// ─────────────────────────────────────────────

export class OsAdapter {
  private platform: Platform;

  constructor(platform: Platform = CURRENT_PLATFORM) {
    this.platform = platform;
  }

  adapt(command: string): AdaptResult {
    const trimmed = command.trim();

    if (this.platform === "windows") {

      if (trimmed.startsWith("sudo ")) {
        return {
          original: trimmed,
          translated: trimmed,
          wasTranslated: false,
          blocked: true,
          blockReason: "sudo not allowed on Windows"
        };
      }

      if (trimmed.startsWith("touch ")) {
        return {
          original: trimmed,
          translated: trimmed.replace(/^touch\s+/, "type nul > "),
          wasTranslated: true,
          blocked: false
        };
      }

      if (trimmed.startsWith("ls")) {
        return {
          original: trimmed,
          translated: trimmed.replace(/^ls/, "dir"),
          wasTranslated: true,
          blocked: false
        };
      }
    }

    return {
      original: trimmed,
      translated: trimmed,
      wasTranslated: false,
      blocked: false
    };
  }

  getPlatform(): Platform {
    return this.platform;
  }

  getPlatformLabel(): string {
    return this.platform === "windows"
      ? "Windows (PowerShell/CMD)"
      : "Unix/Linux/macOS";
  }

  getLLMContext(): string {
    if (this.platform === "windows") {
      return `
PLATFORM: Windows
- Do NOT use Unix commands like touch, ls, grep, chmod.
- Use Windows equivalents.
- Use relative paths only.
`;
    }

    return `
PLATFORM: Unix
- Standard bash commands allowed.
`;
  }
}
