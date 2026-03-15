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
exports.runInstaller = runInstaller;
// cli/installer.ts — DevOS setup wizard
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const http = __importStar(require("http"));
const child_process_1 = require("child_process");
async function runInstaller() {
    console.log('\n╔══════════════════════════════════╗');
    console.log('║         DevOS Installer          ║');
    console.log('╚══════════════════════════════════╝\n');
    const steps = [
        { label: 'Checking Node version', fn: checkNode },
        { label: 'Creating workspace', fn: createWorkspace },
        { label: 'Installing dependencies', fn: installDeps },
        { label: 'Creating default config', fn: createConfig },
        { label: 'Checking Ollama', fn: checkOllama },
    ];
    for (const step of steps) {
        process.stdout.write(`  ⏳ ${step.label}...`);
        try {
            await step.fn();
            process.stdout.write(`\r  ✅ ${step.label}               \n`);
        }
        catch (e) {
            process.stdout.write(`\r  ⚠️  ${step.label}: ${e.message}\n`);
        }
    }
    console.log('\n╔══════════════════════════════════╗');
    console.log('║       DevOS Ready! 🚀            ║');
    console.log('╚══════════════════════════════════╝');
    console.log('\n  Start DevOS:');
    console.log('    npx ts-node index.ts serve');
    console.log('\n  Open Mission Control:');
    console.log('    npx ts-node index.ts ui');
    console.log('\n  Run your first goal:');
    console.log('    npx ts-node index.ts goal "Build a REST API" "Express with auth"\n');
}
function checkNode() {
    const version = process.version;
    const major = parseInt(version.slice(1).split('.')[0], 10);
    if (major < 18)
        throw new Error(`Node 18+ required, found ${version}`);
}
function createWorkspace() {
    const dirs = [
        'workspace', 'workspace/tasks', 'workspace/reports',
        'artifacts', 'logs', 'config/pilots', 'config/blueprints',
        'knowledge', 'memory', 'skills/generated', 'research',
    ];
    for (const d of dirs) {
        if (!fs.existsSync(d))
            fs.mkdirSync(d, { recursive: true });
    }
}
function installDeps() {
    if (!fs.existsSync('node_modules')) {
        (0, child_process_1.execSync)('npm install', { stdio: 'pipe' });
    }
}
function createConfig() {
    const apiConfig = path.join('config', 'api.json');
    if (!fs.existsSync(apiConfig)) {
        fs.writeFileSync(apiConfig, JSON.stringify({
            host: '127.0.0.1',
            port: 4200,
            apiKey: '',
            corsOrigins: ['*'],
            rateLimit: { windowMs: 60000, maxRequests: 100 },
            enableSwagger: true,
            roles: {
                admin: ['*'],
                automation: ['POST /api/goals', 'GET /api/goals'],
                'read-only': ['GET /api/system/health'],
            },
        }, null, 2));
    }
    // Also ensure integrations.json exists
    const intConfig = path.join('config', 'integrations.json');
    if (!fs.existsSync(intConfig)) {
        fs.writeFileSync(intConfig, JSON.stringify({
            github: { token: '', defaultRepo: '' },
            slack: { webhookUrl: '', defaultChannel: '#devos-alerts' },
            vercel: { token: '', teamId: '' },
            railway: { token: '' },
            notifications: { onGoalComplete: false, onGoalFailed: true, onEmergencyStop: true },
        }, null, 2));
    }
}
function checkOllama() {
    return new Promise((resolve, reject) => {
        const req = http.request({ hostname: 'localhost', port: 11434, path: '/api/tags', method: 'GET' }, res => {
            if (res.statusCode === 200)
                resolve();
            else
                reject(new Error('Ollama not running — start with: ollama serve'));
        });
        req.on('error', () => reject(new Error('Ollama not found — install from ollama.ai')));
        req.setTimeout(3000, () => { req.destroy(); reject(new Error('Ollama timeout')); });
        req.end();
    });
}
