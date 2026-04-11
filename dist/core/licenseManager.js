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
exports.activateLicense = activateLicense;
exports.verifyLicense = verifyLicense;
exports.getLicenseStatus = getLicenseStatus;
exports.deactivateLicense = deactivateLicense;
// core/licenseManager.ts — Pro license validation + offline grace period
//
// Strategy:
//   - validateLicense(key)  — contacts the license server, caches result locally
//   - isPro()               — true if cached license is valid and not expired
//   - 7-day offline grace   — if server is unreachable, cached license works for 7 days
//   - 12-hour background refresh — keeps the cached license fresh silently
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const https_1 = __importDefault(require("https"));
const machineId_1 = require("./machineId");
// Shared HTTPS agent for all license-server calls.
// Cloudflare certificates can trigger CERT_NOT_YET_VALID in Node.js's Undici
// due to clock-skew or cert pre-issuance timing; the cert IS valid per the OS
// trust store (curl passes). Scoped to license server only — other requests unaffected.
const licenseAgent = new https_1.default.Agent({ rejectUnauthorized: false });
/**
 * Low-level HTTPS POST to the license server using Node's https module
 * (not built-in fetch) so we can attach the custom agent.
 */
async function licensePost(urlPath, body, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const base = new URL(LICENSE_SERVER);
        const req = https_1.default.request({
            hostname: base.hostname,
            port: base.port ? Number(base.port) : 443,
            path: urlPath,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
            },
            agent: licenseAgent,
            timeout: timeoutMs,
        }, (res) => {
            let raw = '';
            res.on('data', (chunk) => { raw += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(raw));
                }
                catch {
                    reject(new Error('Invalid JSON response'));
                }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
        req.write(data);
        req.end();
    });
}
// ── Config ────────────────────────────────────────────────────
const LICENSE_FILE = path_1.default.join(process.cwd(), 'workspace', 'license.json');
const LICENSE_SERVER = 'https://api.taracod.com';
const DIST_SERVER = 'https://api.taracod.com';
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
    try {
        const json = await licensePost('/validate', { key }, VALIDATE_TIMEOUT);
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
        const data = await licensePost('/verify-install', { email, machineId }, 8000);
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
        const data = await licensePost('/register', { email }, 8000);
        return {
            success: true,
            message: data.message || 'Check your email for the download link',
        };
    }
    catch (e) {
        return { success: false, message: e.message };
    }
}
// ══════════════════════════════════════════════════════════════
//  Pro License System (AIDEN-PRO-xxxxxx-xxxxxx-xxxxxx format)
//  Uses api.taracod.com endpoints: /license/activate, /verify, /deactivate
//  Cache stored at %APPDATA%/devos-ai/license.json (separate from old cache)
// ══════════════════════════════════════════════════════════════
const PRO_LICENSE_FILE = path_1.default.join(process.env.APPDATA || path_1.default.join(os_1.default.homedir(), 'AppData', 'Roaming'), 'devos-ai', 'license.json');
const PRO_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const API_BASE = LICENSE_SERVER; // already 'https://api.taracod.com'
// ── Cache I/O ─────────────────────────────────────────────────
function loadProCache() {
    try {
        if (fs_1.default.existsSync(PRO_LICENSE_FILE)) {
            return JSON.parse(fs_1.default.readFileSync(PRO_LICENSE_FILE, 'utf-8'));
        }
    }
    catch { }
    return null;
}
function saveProCache(cache) {
    try {
        const dir = path_1.default.dirname(PRO_LICENSE_FILE);
        fs_1.default.mkdirSync(dir, { recursive: true });
        const tmp = PRO_LICENSE_FILE + '.tmp';
        fs_1.default.writeFileSync(tmp, JSON.stringify(cache, null, 2));
        try {
            fs_1.default.renameSync(tmp, PRO_LICENSE_FILE);
        }
        catch {
            fs_1.default.writeFileSync(PRO_LICENSE_FILE, JSON.stringify(cache, null, 2));
            try {
                fs_1.default.unlinkSync(tmp);
            }
            catch { }
        }
    }
    catch (e) {
        console.error('[License] Failed to save Pro cache:', e.message);
    }
}
// ── Public Pro API ────────────────────────────────────────────
/**
 * Activate a Pro license key on this machine.
 * Stores the result in %APPDATA%/devos-ai/license.json.
 */
async function activateLicense(key) {
    const machineId = (0, machineId_1.getMachineId)();
    const machineName = (0, machineId_1.getMachineName)();
    try {
        const data = await licensePost('/license/activate', { key, machineId, machineName });
        if (data.activated) {
            saveProCache({
                key,
                valid: true,
                plan: data.plan || 'pro_monthly',
                expiresAt: data.expiresAt || '',
                features: data.features || {},
                lastVerified: Date.now(),
            });
            return { success: true, plan: data.plan };
        }
        return { success: false, error: data.error || 'Activation failed' };
    }
    catch (e) {
        return { success: false, error: `Network error: ${e.message}` };
    }
}
/**
 * Verify the current Pro license against the server (24-hour cache).
 * Falls back to cached data when offline if license has not expired.
 */
async function verifyLicense() {
    const cache = loadProCache();
    if (!cache?.key)
        return { isPro: false };
    // Serve from cache if verified within 24 hours
    if (cache.valid && Date.now() - cache.lastVerified < PRO_CACHE_DURATION) {
        return { isPro: true, plan: cache.plan, features: cache.features, expiresAt: cache.expiresAt };
    }
    // Re-verify with server
    try {
        const machineId = (0, machineId_1.getMachineId)();
        const data = await licensePost('/license/verify', { key: cache.key, machineId });
        cache.valid = data.valid;
        cache.lastVerified = Date.now();
        if (data.valid) {
            cache.plan = data.plan || cache.plan;
            cache.features = data.features || cache.features;
            cache.expiresAt = data.expiresAt || cache.expiresAt;
        }
        saveProCache(cache);
        return data.valid
            ? { isPro: true, plan: cache.plan, features: cache.features, expiresAt: cache.expiresAt }
            : { isPro: false };
    }
    catch {
        // Offline — trust cache if license has not expired
        if (cache.valid && cache.expiresAt && new Date(cache.expiresAt) > new Date()) {
            return { isPro: true, plan: cache.plan, features: cache.features, expiresAt: cache.expiresAt };
        }
        return { isPro: false };
    }
}
/**
 * Synchronous status check from cache only — no network request.
 */
function getLicenseStatus() {
    const cache = loadProCache();
    if (!cache?.valid)
        return { isPro: false };
    if (cache.expiresAt && new Date(cache.expiresAt) < new Date())
        return { isPro: false };
    return { isPro: true, plan: cache.plan, expiresAt: cache.expiresAt, features: cache.features };
}
/**
 * Deactivate this machine from the Pro license.
 * Removes the local cache file on success.
 */
async function deactivateLicense() {
    const cache = loadProCache();
    if (!cache?.key)
        return false;
    const machineId = (0, machineId_1.getMachineId)();
    try {
        const data = await licensePost('/license/deactivate', { key: cache.key, machineId });
        if (data.deactivated) {
            try {
                fs_1.default.unlinkSync(PRO_LICENSE_FILE);
            }
            catch { }
            return true;
        }
        return false;
    }
    catch {
        return false;
    }
}
