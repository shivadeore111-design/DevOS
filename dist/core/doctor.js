"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanCorruptedSkills = cleanCorruptedSkills;
exports.runDoctor = runDoctor;
// core/doctor.ts — System health checks for DevOS subsystems.
//
// Sprint 23: ComputerUse Memory check via MemoryStrategy.
// Sprint 24: Hardware Detection + First-boot Setup checks.
//
// NOTE: This is the sandbox stub. The full implementation (with LLM provider,
// Docker, database, and tool-registry checks) lives at C:\Users\shiva\DevOS\core\doctor.ts
// and will be merged on the host machine.
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const memoryStrategy_1 = require("./memoryStrategy");
const hardwareDetector_1 = require("./hardwareDetector");
const setupWizard_1 = require("./setupWizard");
const evolutionAnalyzer_1 = require("./evolutionAnalyzer");
const index_1 = require("../providers/index");
// ── Corrupted skill name patterns ─────────────────────────────
// Skills with these name patterns are junk auto-generated names
const CORRUPTED_SKILL_NAMES = [
    'digital_ledger_app', 'open_batman_com', 'open_esquire_com',
    'clear_converastion', 'skills_skills', 'which_skill_you',
    'check_any_those', 'fetch_https_httpbin', 'read_users_shiva',
    'run_node_console', 'identify_skill_skills', 'open_instagram_com',
    'open_google_chrome', 'what', 'how_register_trademark',
    'what_hsn_code', 'what_just_happened', 'give_full_system',
    'access_uploaded_file', 'provide_data_yesterday',
];
// ── Individual checks ─────────────────────────────────────────
/**
 * Sprint 23 — ComputerUse Memory check.
 */
async function checkComputerUseMemory() {
    try {
        const stats = memoryStrategy_1.memoryStrategy.stats();
        const status = stats.total === 0 ? 'warn' : 'ok';
        return {
            name: 'ComputerUse Memory',
            status,
            message: stats.total === 0
                ? 'Memory store is empty — no computer-use sessions recorded yet'
                : `Memory store healthy — ${stats.total} goal(s), avg success rate ${(stats.avgSuccessRate * 100).toFixed(1)}%`,
            detail: {
                totalGoals: stats.total,
                avgSuccessRate: stats.avgSuccessRate,
                topGoals: stats.topGoals,
            },
        };
    }
    catch (err) {
        return {
            name: 'ComputerUse Memory',
            status: 'error',
            message: `Memory store unavailable: ${err?.message ?? 'unknown error'}`,
        };
    }
}
// ── Ollama check ──────────────────────────────────────────────
async function checkOllama() {
    try {
        const r = await fetch('http://localhost:11434/api/tags', {
            signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined,
        });
        if (!r.ok)
            return { name: 'Ollama', status: 'warn', message: `Ollama HTTP ${r.status}` };
        const data = await r.json();
        const all = data.models || [];
        const chatMod = all.filter((m) => !m.name.includes('embed') && !m.name.includes('nomic') && !m.name.includes('mxbai'));
        if (chatMod.length === 0) {
            return { name: 'Ollama', status: 'warn', message: 'Running but no chat models installed', detail: 'Run: ollama pull gemma2:2b' };
        }
        return {
            name: 'Ollama', status: 'ok',
            message: `Running — ${chatMod.length} chat model(s): ${chatMod.map((m) => m.name).join(', ')}`,
        };
    }
    catch {
        return { name: 'Ollama', status: 'warn', message: 'NOT RUNNING — cloud APIs will be used instead', detail: 'Start Ollama for local inference' };
    }
}
// ── API keys check ────────────────────────────────────────────
function checkApiKeys() {
    try {
        const config = (0, index_1.loadConfig)();
        const apis = config.providers?.apis || [];
        const active = apis.filter(a => a.enabled && a.key && a.key.length > 10);
        if (active.length === 0) {
            return { name: 'API Keys', status: 'warn', message: 'NONE configured — add keys in dashboard Settings', detail: 'Go to http://localhost:3000 > Settings > API Keys' };
        }
        const summary = active.map(a => `${a.name}(${a.provider})`).join(', ');
        return { name: 'API Keys', status: 'ok', message: `${active.length} active: ${summary}` };
    }
    catch (e) {
        return { name: 'API Keys', status: 'error', message: `Config load failed: ${e.message}` };
    }
}
// ── Port check ────────────────────────────────────────────────
async function checkPorts() {
    const ports = [4200, 3000, 3001, 11434];
    const labels = { 4200: 'Aiden API', 3000: 'Dashboard', 3001: 'MCP', 11434: 'Ollama' };
    const results = [];
    await Promise.all(ports.map(async (port) => {
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 1500);
            await fetch(`http://localhost:${port}`, { signal: ctrl.signal });
            clearTimeout(timer);
            results.push(`${labels[port]}:${port}(up)`);
        }
        catch (e) {
            if (e.name === 'AbortError') {
                results.push(`${labels[port]}:${port}(up)`); // connected, just no response
            }
            else {
                results.push(`${labels[port]}:${port}(down)`);
            }
        }
    }));
    const down = results.filter(r => r.includes('(down)'));
    return {
        name: 'Ports',
        status: down.length === 0 ? 'ok' : 'warn',
        message: results.join(' | '),
    };
}
// ── Skills check ──────────────────────────────────────────────
function checkSkills() {
    const skillDirs = [
        path_1.default.join(process.cwd(), 'workspace', 'skills', 'learned'),
        path_1.default.join(process.cwd(), 'workspace', 'skills', 'approved'),
        path_1.default.join(process.cwd(), 'skills'),
    ];
    let total = 0;
    let corrupted = 0;
    const corruptedNames = [];
    for (const dir of skillDirs) {
        if (!fs_1.default.existsSync(dir))
            continue;
        try {
            const entries = fs_1.default.readdirSync(dir, { withFileTypes: true });
            for (const e of entries) {
                if (!e.isDirectory())
                    continue;
                total++;
                if (CORRUPTED_SKILL_NAMES.includes(e.name) || e.name.length < 5 || !e.name.includes('_')) {
                    corrupted++;
                    corruptedNames.push(e.name);
                }
            }
        }
        catch { }
    }
    if (corrupted > 0) {
        return {
            name: 'Skills', status: 'warn',
            message: `${total} skills, ${corrupted} corrupted — run: devos doctor --clean-skills`,
            detail: `Corrupted: ${corruptedNames.slice(0, 8).join(', ')}${corruptedNames.length > 8 ? '...' : ''}`,
        };
    }
    return { name: 'Skills', status: 'ok', message: `${total} skills loaded, none corrupted` };
}
// ── Dashboard check ───────────────────────────────────────────
function checkDashboard() {
    const pkgPath = path_1.default.join(process.cwd(), 'dashboard-next', 'package.json');
    const distPath = path_1.default.join(process.cwd(), 'dashboard-next', '.next');
    if (!fs_1.default.existsSync(pkgPath)) {
        return { name: 'Dashboard', status: 'error', message: 'MISSING — dashboard-next/ not found' };
    }
    if (!fs_1.default.existsSync(distPath)) {
        return { name: 'Dashboard', status: 'warn', message: 'Found but not built — run: cd dashboard-next && npm run build' };
    }
    return { name: 'Dashboard', status: 'ok', message: 'dashboard-next/ found and built' };
}
// ── Scheduler check ───────────────────────────────────────────
function checkScheduler() {
    try {
        const schedPath = path_1.default.join(process.cwd(), 'workspace', 'scheduled-tasks.json');
        if (!fs_1.default.existsSync(schedPath)) {
            return { name: 'Scheduler', status: 'ok', message: '0 tasks scheduled' };
        }
        const tasks = JSON.parse(fs_1.default.readFileSync(schedPath, 'utf-8'));
        const active = tasks.filter(t => t.enabled !== false).length;
        return { name: 'Scheduler', status: 'ok', message: `${tasks.length} tasks (${active} active)` };
    }
    catch (e) {
        return { name: 'Scheduler', status: 'warn', message: `Could not read tasks: ${e.message}` };
    }
}
// ── Clean corrupted skills ─────────────────────────────────────
function cleanCorruptedSkills() {
    const skillDirs = [
        path_1.default.join(process.cwd(), 'workspace', 'skills', 'learned'),
        path_1.default.join(process.cwd(), 'workspace', 'skills', 'approved'),
    ];
    const deleted = [];
    let kept = 0;
    for (const dir of skillDirs) {
        if (!fs_1.default.existsSync(dir))
            continue;
        try {
            const entries = fs_1.default.readdirSync(dir, { withFileTypes: true });
            for (const e of entries) {
                if (!e.isDirectory())
                    continue;
                const fullPath = path_1.default.join(dir, e.name);
                const isCorrupted = (CORRUPTED_SKILL_NAMES.includes(e.name) ||
                    e.name.length < 5 ||
                    (!e.name.includes('_') && e.name !== 'stock_research' && e.name !== 'python_execution'));
                if (isCorrupted) {
                    try {
                        fs_1.default.rmSync(fullPath, { recursive: true, force: true });
                        deleted.push(e.name);
                    }
                    catch { }
                }
                else {
                    kept++;
                }
            }
        }
        catch { }
    }
    return { deleted, kept };
}
// ── Doctor runner ─────────────────────────────────────────────
async function runDoctor() {
    const checks = [];
    // LLM providers
    checks.push(await checkOllama());
    checks.push(checkApiKeys());
    // Network ports
    checks.push(await checkPorts());
    // Sprint 23 — ComputerUse Memory
    checks.push(await checkComputerUseMemory());
    // Sprint 24 — Hardware Detection
    const hw = (0, hardwareDetector_1.detectHardware)();
    checks.push({
        name: 'Hardware Detection',
        status: hw.gpu !== 'Unknown GPU' ? 'ok' : 'warn',
        message: hw.gpu !== 'Unknown GPU'
            ? `GPU detected: ${hw.gpu}`
            : 'GPU not detected - model recommendations may be suboptimal',
        detail: `${hw.gpu} - ${hw.vramGB}GB VRAM - ${hw.ramGB}GB RAM - ${hw.platform}`,
    });
    // Sprint 24 — First-boot Setup
    const setupDone = (0, setupWizard_1.isSetupComplete)();
    checks.push({
        name: 'First-boot Setup',
        status: setupDone ? 'ok' : 'warn',
        message: setupDone ? 'Setup complete' : 'Run: devos setup',
        detail: setupDone ? 'Setup complete' : 'Run: devos setup',
    });
    // Sprint 27 — Self-Evolution Analyzer
    checks.push({
        name: 'Evolution Analyzer',
        status: 'ok',
        message: evolutionAnalyzer_1.evolutionAnalyzer.getSummary(),
        detail: evolutionAnalyzer_1.evolutionAnalyzer.getSummary(),
    });
    // Skills, dashboard, scheduler
    checks.push(checkSkills());
    checks.push(checkDashboard());
    checks.push(checkScheduler());
    return {
        timestamp: new Date().toISOString(),
        checks,
        healthy: checks.every(c => c.status !== 'error'),
    };
}
