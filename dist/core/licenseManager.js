"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateLicense = validateLicense;
exports.getCurrentLicense = getCurrentLicense;
exports.isPro = isPro;
exports.clearLicense = clearLicense;
exports.startLicenseRefresh = startLicenseRefresh;
exports.verifyInstall = verifyInstall;
exports.registerEmail = registerEmail;
// core/licenseManager.ts — Pro license validation + offline grace period
//
// Strategy:
//   - validateLicense(key)  — contacts the license server, caches result locally
//   - isPro()               — true if cached license is valid and not expired
//   - 7-day offline grace   — if server is unreachable, cached license works for 7 days
//   - 12-hour background refresh — keeps the cached license fresh silently
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const machineId_1 = require("./machineId");
// ── Config ────────────────────────────────────────────────────
const LICENSE_FILE = path_1.default.join(process.cwd(), 'workspace', 'license.json');
const LICENSE_SERVER = 'https://devos-license-server.shiva-deore111.workers.dev';
const DIST_SERVER = 'https://devos-license-server.shiva-deore111.workers.dev';
const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const REFRESH_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours
const VALIDATE_TIMEOUT = 8 * 1000; // 8-second network timeout
// ── Defaults ──────────────────────────────────────────────────
const FREE_LICENSE = {
    key: '',
    valid: false,
    tier: 'free',
    email: '',
    expiry: 0,
    lastChecked: 0,
};
// ── File I/O ──────────────────────────────────────────────────
function loadCached() {
    try {
        if (!fs_1.default.existsSync(LICENSE_FILE))
            return null;
        return JSON.parse(fs_1.default.readFileSync(LICENSE_FILE, 'utf-8'));
    }
    catch {
        return null;
    }
}
function saveCached(data) {
    try {
        const dir = path_1.default.dirname(LICENSE_FILE);
        if (!fs_1.default.existsSync(dir))
            fs_1.default.mkdirSync(dir, { recursive: true });
        // NTFS-safe: write to .tmp then rename (fall back to direct write)
        const tmp = LICENSE_FILE + '.tmp';
        fs_1.default.writeFileSync(tmp, JSON.stringify(data, null, 2));
        try {
            fs_1.default.renameSync(tmp, LICENSE_FILE);
        }
        catch {
            fs_1.default.writeFileSync(LICENSE_FILE, JSON.stringify(data, null, 2));
            try {
                fs_1.default.unlinkSync(tmp);
            }
            catch { }
        }
    }
    catch (e) {
        console.error('[License] Failed to save cache:', e.message);
    }
}
// ── Network validation ────────────────────────────────────────
async function fetchValidation(key) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VALIDATE_TIMEOUT);
    try {
        const res = await fetch(`${LICENSE_SERVER}/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key }),
            signal: controller.signal,
        });
        const json = await res.json();
        clearTimeout(timer);
        if (json.valid) {
            return {
                key,
                valid: true,
                tier: json.tier || 'pro',
                email: json.email || '',
                expiry: json.expiry || 0,
                lastChecked: Date.now(),
            };
        }
        else {
            return {
                ...FREE_LICENSE,
                key,
                lastChecked: Date.now(),
                error: json.error || 'Invalid license',
            };
        }
    }
    catch (e) {
        clearTimeout(timer);
        throw new Error(e.message || 'Network error');
    }
}
// ── Public API ────────────────────────────────────────────────
/**
 * Validate a license key against the server.
 * Saves the result to workspace/license.json.
 * On network failure, throws — caller handles gracefully.
 */
async function validateLicense(key) {
    const cleanKey = key.trim().toUpperCase();
    if (!/^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(cleanKey)) {
        return { ...FREE_LICENSE, key: cleanKey, error: 'Invalid key format (expected XXXXX-XXXXX-XXXXX-XXXXX)' };
    }
    const result = await fetchValidation(cleanKey);
    saveCached(result);
    return result;
}
/**
 * Return the current license from cache.
 * Does NOT make a network request.
 */
function getCurrentLicense() {
    return loadCached() || { ...FREE_LICENSE };
}
/**
 * Returns true if the user has a valid, non-expired Pro license.
 * Respects 7-day offline grace period if server is unreachable.
 */
function isPro() {
    const cached = loadCached();
    if (!cached || !cached.valid || cached.tier !== 'pro')
        return false;
    // Check expiry (0 = lifetime)
    if (cached.expiry !== 0 && Date.now() > cached.expiry)
        return false;
    // Check if last server validation was within the grace period
    const age = Date.now() - (cached.lastChecked || 0);
    if (age > OFFLINE_GRACE_MS) {
        console.log('[License] Grace period exceeded — license needs re-validation');
        return false;
    }
    return true;
}
/**
 * Clear the cached license (user logs out of Pro).
 */
function clearLicense() {
    try {
        if (fs_1.default.existsSync(LICENSE_FILE)) {
            fs_1.default.unlinkSync(LICENSE_FILE);
        }
    }
    catch (e) {
        console.error('[License] Failed to clear cache:', e.message);
    }
}
/**
 * Start a background 12-hour license refresh.
 * Call once on server startup — silently keeps the cache fresh.
 */
function startLicenseRefresh() {
    const refresh = async () => {
        const cached = loadCached();
        if (!cached || !cached.key || !cached.valid)
            return; // nothing to refresh
        try {
            const updated = await fetchValidation(cached.key);
            saveCached(updated);
            if (!updated.valid) {
                console.log('[License] Background refresh: license no longer valid');
            }
        }
        catch {
            // Network failure — offline grace handles it, no log spam needed
        }
    };
    // Initial refresh 30 seconds after boot (avoids blocking startup)
    setTimeout(refresh, 30 * 1000);
    // Then every 12 hours
    setInterval(refresh, REFRESH_INTERVAL);
}
// ── Sprint 20: Distribution control + machine binding ─────────
/**
 * Verify that this email+machine combination is allowed to run.
 * Called on startup. On network failure, allows (offline users not blocked).
 */
async function verifyInstall(email) {
    try {
        const machineId = (0, machineId_1.getMachineId)();
        const r = await fetch(`${DIST_SERVER}/verify-install`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, machineId }),
            signal: AbortSignal.timeout(8000),
        });
        if (!r.ok)
            return { allowed: false, reason: 'Server unreachable' };
        const data = await r.json();
        return { allowed: data.allowed === true, reason: data.reason };
    }
    catch {
        // Network failure — don't block offline users
        return { allowed: true };
    }
}
/**
 * Register an email address for early access.
 * Returns a human-readable message to display to the user.
 */
async function registerEmail(email) {
    try {
        const r = await fetch(`${DIST_SERVER}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
            signal: AbortSignal.timeout(8000),
        });
        const data = await r.json();
        return {
            success: r.ok,
            message: data.message || 'Check your email for the download link',
        };
    }
    catch (e) {
        return { success: false, message: e.message };
    }
}
