// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// core/memory.ts

import fs from "fs";
import path from "path";
import crypto from "crypto";

const memoryPath = path.join(
  process.cwd(),
  "workspace",
  "sandbox",
  "projectMemory.json"
);

export interface ErrorEntry {
  id: string;
  stage: string;
  errorSignature: string;
  errorMessage: string;
  firstSeen: string;
  lastSeen: string;
  occurrences: number;
  resolved: boolean;
}

export interface SuccessfulFix {
  errorSignature: string;
  fixApplied: string;
  resolvedAt: string;
}

export interface ProjectMemory {
  schemaVersion: number;
  projectName: string;
  lastDeploymentUrl: string;
  lastDeploymentTime: string;
  lastGitCommit: string;
  lastError: string;
  lastFailureStage: string;
  retryState: {
    retryCount: number;
    maxRetries: number;
  };
  errorHistory: ErrorEntry[];
  successfulFixes: SuccessfulFix[];
  deploymentHistory: any[];
}

const defaultMemory: ProjectMemory = {
  schemaVersion: 2,
  projectName: "",
  lastDeploymentUrl: "",
  lastDeploymentTime: "",
  lastGitCommit: "",
  lastError: "",
  lastFailureStage: "",
  retryState: {
    retryCount: 0,
    maxRetries: 3
  },
  errorHistory: [],
  successfulFixes: [],
  deploymentHistory: []
};

function ensureMemoryFile() {
  if (!fs.existsSync(memoryPath)) {
    fs.mkdirSync(path.dirname(memoryPath), { recursive: true });
    fs.writeFileSync(memoryPath, JSON.stringify(defaultMemory, null, 2));
  }
}

export function loadMemory(): ProjectMemory {
  ensureMemoryFile();
  const raw = fs.readFileSync(memoryPath, "utf-8");
  const parsed = JSON.parse(raw);

  // Auto-upgrade older schema
  if (!parsed.schemaVersion || parsed.schemaVersion < 2) {
    const upgraded = { ...defaultMemory, ...parsed, schemaVersion: 2 };
    saveMemory(upgraded);
    return upgraded;
  }

  return parsed;
}

export function saveMemory(memory: ProjectMemory) {
  fs.writeFileSync(memoryPath, JSON.stringify(memory, null, 2));
}

function generateErrorSignature(message: string) {
  return crypto.createHash("md5").update(message).digest("hex");
}

export function recordError(stage: string, message: string) {
  const memory = loadMemory();
  const signature = generateErrorSignature(message);
  const now = new Date().toISOString();

  let existing = memory.errorHistory.find(
    (e) => e.errorSignature === signature
  );

  if (existing) {
    existing.lastSeen = now;
    existing.occurrences += 1;
  } else {
    memory.errorHistory.push({
      id: crypto.randomUUID(),
      stage,
      errorSignature: signature,
      errorMessage: message,
      firstSeen: now,
      lastSeen: now,
      occurrences: 1,
      resolved: false
    });
  }

  memory.lastError = message;
  memory.lastFailureStage = stage;
  memory.retryState.retryCount += 1;

  saveMemory(memory);
}

export function recordSuccessfulFix(signature: string, fix: string) {
  const memory = loadMemory();
  const now = new Date().toISOString();

  memory.successfulFixes.push({
    errorSignature: signature,
    fixApplied: fix,
    resolvedAt: now
  });

  const error = memory.errorHistory.find(
    (e) => e.errorSignature === signature
  );

  if (error) {
    error.resolved = true;
  }

  memory.retryState.retryCount = 0;
  memory.lastError = "";
  memory.lastFailureStage = "";

  saveMemory(memory);
}