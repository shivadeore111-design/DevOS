"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.browserVault = void 0;
// security/browserVault.ts — Playwright-in-Docker with noVNC LiveView.
// Stub for sandbox environment; full implementation committed in Sprint 20.
const dockerode_1 = __importDefault(require("dockerode"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// ── Constants ──────────────────────────────────────────────────
const PLAYWRIGHT_IMAGE = 'mcr.microsoft.com/playwright:v1.40.0-jammy';
const CONTAINER_VNC_WS_PORT = 6080;
const HOST_PORT_BASE = 6100;
const ENTRYPOINT_CMD = [
    'sh', '-c',
    [
        'Xvfb :99 -screen 0 1280x900x24 &',
        'export DISPLAY=:99',
        'sleep 1',
        'x11vnc -display :99 -nopw -forever -rfbport 5900 -quiet &',
        `websockify --web /usr/share/novnc 0.0.0.0:${CONTAINER_VNC_WS_PORT} localhost:5900 &`,
        'tail -f /dev/null',
    ].join(' && '),
];
// ── Persistence ────────────────────────────────────────────────
const WORKSPACE = path_1.default.join(process.cwd(), 'workspace');
const BVAULTS_FILE = path_1.default.join(WORKSPACE, 'browser-vaults.json');
function loadPersistedBVaults() {
    try {
        if (!fs_1.default.existsSync(BVAULTS_FILE))
            return [];
        return JSON.parse(fs_1.default.readFileSync(BVAULTS_FILE, 'utf-8'));
    }
    catch {
        return [];
    }
}
function savePersistedBVaults(vaults) {
    fs_1.default.mkdirSync(WORKSPACE, { recursive: true });
    fs_1.default.writeFileSync(BVAULTS_FILE, JSON.stringify(vaults, null, 2));
}
// ── BrowserVaultManager ───────────────────────────────────────
class BrowserVaultManager {
    constructor() {
        this.docker = new dockerode_1.default();
        this.vaults = new Map();
        this.nextPort = HOST_PORT_BASE;
        for (const v of loadPersistedBVaults()) {
            this.vaults.set(v.taskId, v);
            if (v.hostPort >= this.nextPort)
                this.nextPort = v.hostPort + 1;
        }
    }
    allocatePort() { return this.nextPort++; }
    persist() {
        savePersistedBVaults(Array.from(this.vaults.values()));
    }
    async createBrowserVault(taskId) {
        const existing = this.vaults.get(taskId);
        if (existing)
            return existing;
        const containerName = `devos-browser-${taskId}`;
        const hostPort = this.allocatePort();
        let container;
        try {
            container = await this.docker.createContainer({
                name: containerName,
                Image: PLAYWRIGHT_IMAGE,
                Cmd: ENTRYPOINT_CMD,
                Env: ['DISPLAY=:99'],
                ExposedPorts: { [`${CONTAINER_VNC_WS_PORT}/tcp`]: {} },
                HostConfig: {
                    PortBindings: {
                        [`${CONTAINER_VNC_WS_PORT}/tcp`]: [{ HostPort: String(hostPort) }],
                    },
                    Memory: 1024 * 1024 * 1024,
                    NanoCpus: 1000000000,
                    AutoRemove: true,
                    ShmSize: 256 * 1024 * 1024,
                    CapAdd: ['SYS_ADMIN'],
                },
            });
            await container.start();
        }
        catch (err) {
            throw new Error(`[BrowserVault] Failed to create container: ${err.message}`);
        }
        const vault = {
            taskId, containerId: container.id, containerName, hostPort, createdAt: Date.now(),
        };
        this.vaults.set(taskId, vault);
        this.persist();
        return vault;
    }
    getLiveViewUrl(taskId) {
        const vault = this.vaults.get(taskId);
        if (!vault)
            return null;
        return `ws://localhost:${vault.hostPort}/websockify`;
    }
    isLiveViewAvailable(taskId) {
        return this.vaults.has(taskId);
    }
    async destroyBrowserVault(taskId) {
        const vault = this.vaults.get(taskId);
        if (vault) {
            try {
                await this.docker.getContainer(vault.containerId).stop({ t: 5 });
            }
            catch { }
            this.vaults.delete(taskId);
            this.persist();
        }
    }
    listBrowserVaults() {
        return Array.from(this.vaults.values());
    }
    async destroyAll() {
        const ids = Array.from(this.vaults.keys());
        await Promise.all(ids.map(id => this.destroyBrowserVault(id)));
    }
}
exports.browserVault = new BrowserVaultManager();
