// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// api/middleware/permissions.ts — Role-based access control for API keys

import * as fs     from "fs";
import * as path   from "path";
import * as crypto from "crypto";

interface RoleConfig {
  [role: string]: string[];
}

interface ApiKeyRecord {
  keyHash:   string;
  role:      "admin" | "automation" | "read-only";
  label:     string;
  createdAt: string;
}

const CONFIG_PATH = path.join(process.cwd(), "config", "api.json");
const KEYS_PATH   = path.join(process.cwd(), "config", "api-keys.json");

function loadRoles(): RoleConfig {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  return config.roles || {};
}

function loadKeys(): ApiKeyRecord[] {
  if (!fs.existsSync(KEYS_PATH)) return [];
  return JSON.parse(fs.readFileSync(KEYS_PATH, "utf-8"));
}

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export function getRoleForKey(key: string): string | null {
  const keys   = loadKeys();
  const hash   = hashKey(key);
  const record = keys.find(k => k.keyHash === hash);
  return record ? record.role : null;
}

export function isAllowed(role: string, method: string, reqPath: string): boolean {
  const roles       = loadRoles();
  const permissions = roles[role] || [];
  if (permissions.includes("*")) return true;

  // Normalize dynamic segments (UUIDs, numeric IDs)
  const normalizedPath = reqPath.replace(/\/[a-f0-9-]{8,}|\/\d+/g, "/:id");
  const requestKey     = `${method} ${normalizedPath}`;

  return permissions.some(p => {
    if (p.endsWith("*")) return requestKey.startsWith(p.slice(0, -1));
    return p === requestKey || normalizedPath.startsWith(p.split(" ")[1] || "");
  });
}

export function generateApiKey(
  role:  "admin" | "automation" | "read-only",
  label: string
): string {
  const key  = `sk_devos_${crypto.randomBytes(24).toString("hex")}`;
  const keys = loadKeys();
  keys.push({ keyHash: hashKey(key), role, label, createdAt: new Date().toISOString() });
  fs.writeFileSync(KEYS_PATH, JSON.stringify(keys, null, 2));
  console.log(`[Permissions] ✅ Key generated for role: ${role} (${label})`);
  return key;
}

export function permissionCheck(req: any, res: any, next: any): void {
  const authHeader = (req.headers["authorization"] ?? "") as string;
  const key        = authHeader.replace("Bearer ", "").trim();

  // Dev mode: no key present → skip permission check
  if (!key) { next(); return; }

  const role = getRoleForKey(key);
  if (!role) { res.status(401).json({ error: "Invalid API key" }); return; }

  const allowed = isAllowed(role, req.method, req.path);
  if (!allowed) {
    res.status(403).json({ error: `Role '${role}' cannot access ${req.method} ${req.path}` });
    return;
  }

  req.role = role;
  next();
}
