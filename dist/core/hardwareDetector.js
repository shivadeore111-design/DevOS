"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectHardware = detectHardware;
exports.redetectHardware = redetectHardware;
// core/hardwareDetector.ts — Cross-platform GPU/RAM detection.
// Caches result to config/hardware.json for 24 hours.
const os_1 = __importDefault(require("os"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const CONFIG_PATH = path_1.default.join(process.cwd(), 'config', 'hardware.json');
function safeExec(cmd) {
    try {
        return (0, child_process_1.execSync)(cmd, { timeout: 5000 }).toString().trim();
    }
    catch {
        return '';
    }
}
function detectHardware() {
    // Return cached if exists and less than 24 hours old
    if (fs_1.default.existsSync(CONFIG_PATH)) {
        try {
            const cached = JSON.parse(fs_1.default.readFileSync(CONFIG_PATH, 'utf-8'));
            const age = Date.now() - new Date(cached.detectedAt).getTime();
            if (age < 24 * 60 * 60 * 1000)
                return cached;
        }
        catch { }
    }
    const platformRaw = os_1.default.platform();
    const platform = platformRaw === 'win32' ? 'windows' : platformRaw === 'darwin' ? 'macos' : 'linux';
    const appleSilicon = platform === 'macos' && os_1.default.arch() === 'arm64';
    let gpu = 'Unknown GPU';
    let vramGB = 4;
    let cudaAvailable = false;
    // NVIDIA — works on Windows, Linux, macOS eGPU
    const nvidiaSmiName = safeExec('nvidia-smi --query-gpu=name --format=csv,noheader');
    const nvidiaSmiMem = safeExec('nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits');
    if (nvidiaSmiName && nvidiaSmiMem) {
        gpu = nvidiaSmiName.split('\n')[0].trim();
        vramGB = Math.round(parseInt(nvidiaSmiMem) / 1024);
        cudaAvailable = true;
    }
    // Apple Silicon — use hw.gpu.unified_mem for actual GPU memory
    if (appleSilicon && gpu === 'Unknown GPU') {
        const unifiedMem = safeExec('sysctl -n hw.gpu.unified_mem'); // actual GPU VRAM
        const chipType = safeExec('sysctl -n machdep.cpu.brand_string');
        if (unifiedMem)
            vramGB = Math.round(parseInt(unifiedMem) / (1024 ** 3));
        else
            vramGB = Math.round(os_1.default.totalmem() / (1024 ** 3) / 2); // fallback: half of RAM
        gpu = chipType || 'Apple Silicon GPU';
    }
    // Windows fallback — integrated/AMD via WMI
    if (platform === 'windows' && gpu === 'Unknown GPU') {
        const wmicOut = safeExec('wmic path Win32_VideoController get Name,AdapterRAM /format:csv');
        const lines = wmicOut.split('\n').filter(l => l.includes(','));
        if (lines[1]) {
            const parts = lines[1].split(',');
            const bytes = parseInt(parts[1] || '0');
            if (bytes > 0)
                vramGB = Math.round(bytes / (1024 ** 3));
            gpu = parts[2]?.trim() || 'Windows GPU';
        }
    }
    // Linux AMD
    if (platform === 'linux' && gpu === 'Unknown GPU') {
        try {
            const mem = fs_1.default.readFileSync('/sys/class/drm/card0/device/mem_info_vram_total', 'utf-8').trim();
            vramGB = Math.round(parseInt(mem) / (1024 ** 3));
            gpu = 'AMD GPU';
        }
        catch { }
    }
    const profile = {
        gpu, vramGB: Math.max(vramGB, 2),
        ramGB: Math.round(os_1.default.totalmem() / (1024 ** 3)),
        platform, cudaAvailable, appleSilicon,
        detectedAt: new Date().toISOString()
    };
    fs_1.default.mkdirSync(path_1.default.dirname(CONFIG_PATH), { recursive: true });
    fs_1.default.writeFileSync(CONFIG_PATH, JSON.stringify(profile, null, 2));
    return profile;
}
// Force re-detect (ignores cache)
function redetectHardware() {
    if (fs_1.default.existsSync(CONFIG_PATH))
        fs_1.default.unlinkSync(CONFIG_PATH);
    return detectHardware();
}
