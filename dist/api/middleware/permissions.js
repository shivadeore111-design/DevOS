"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRoleForKey = getRoleForKey;
exports.isAllowed = isAllowed;
exports.generateApiKey = generateApiKey;
exports.permissionCheck = permissionCheck;
// api/middleware/permissions.ts — Role-based access control for API keys
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const CONFIG_PATH = path.join(process.cwd(), "config", "api.json");
const KEYS_PATH = path.join(process.cwd(), "config", "api-keys.json");
function loadRoles() {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    return config.roles || {};
}
function loadKeys() {
    if (!fs.existsSync(KEYS_PATH))
        return [];
    return JSON.parse(fs.readFileSync(KEYS_PATH, "utf-8"));
}
function hashKey(key) {
    return crypto.createHash("sha256").update(key).digest("hex");
}
function getRoleForKey(key) {
    const keys = loadKeys();
    const hash = hashKey(key);
    const record = keys.find(k => k.keyHash === hash);
    return record ? record.role : null;
}
function isAllowed(role, method, reqPath) {
    const roles = loadRoles();
    const permissions = roles[role] || [];
    if (permissions.includes("*"))
        return true;
    // Normalize dynamic segments (UUIDs, numeric IDs)
    const normalizedPath = reqPath.replace(/\/[a-f0-9-]{8,}|\/\d+/g, "/:id");
    const requestKey = `${method} ${normalizedPath}`;
    return permissions.some(p => {
        if (p.endsWith("*"))
            return requestKey.startsWith(p.slice(0, -1));
        return p === requestKey || normalizedPath.startsWith(p.split(" ")[1] || "");
    });
}
function generateApiKey(role, label) {
    const key = `sk_devos_${crypto.randomBytes(24).toString("hex")}`;
    const keys = loadKeys();
    keys.push({ keyHash: hashKey(key), role, label, createdAt: new Date().toISOString() });
    fs.writeFileSync(KEYS_PATH, JSON.stringify(keys, null, 2));
    console.log(`[Permissions] ✅ Key generated for role: ${role} (${label})`);
    return key;
}
function permissionCheck(req, res, next) {
    const authHeader = (req.headers["authorization"] ?? "");
    const key = authHeader.replace("Bearer ", "").trim();
    // Dev mode: no key present → skip permission check
    if (!key) {
        next();
        return;
    }
    const role = getRoleForKey(key);
    if (!role) {
        res.status(401).json({ error: "Invalid API key" });
        return;
    }
    const allowed = isAllowed(role, req.method, req.path);
    if (!allowed) {
        res.status(403).json({ error: `Role '${role}' cannot access ${req.method} ${req.path}` });
        return;
    }
    req.role = role;
    next();
}
