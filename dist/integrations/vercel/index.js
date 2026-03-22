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
exports.vercel = exports.VercelIntegration = void 0;
// integrations/vercel/index.ts — Vercel REST API integration
const https = __importStar(require("https"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function loadConfig() {
    try {
        const configPath = path.join(process.cwd(), 'config', 'integrations.json');
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        return config.vercel ?? { token: process.env.VERCEL_TOKEN ?? '' };
    }
    catch {
        return { token: process.env.VERCEL_TOKEN ?? '' };
    }
}
async function vercelRequest(method, endpoint, body) {
    const config = loadConfig();
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : undefined;
        const req = https.request({
            hostname: 'api.vercel.com',
            path: endpoint,
            method,
            headers: {
                Authorization: `Bearer ${config.token}`,
                'Content-Type': 'application/json',
                ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
            },
        }, res => {
            let raw = '';
            res.on('data', (c) => { raw += c; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(raw));
                }
                catch {
                    resolve(raw);
                }
            });
        });
        req.on('error', reject);
        if (data)
            req.write(data);
        req.end();
    });
}
class VercelIntegration {
    async listProjects() {
        const res = await vercelRequest('GET', '/v9/projects');
        return res.projects ?? [];
    }
    async deploy(projectPath, projectName) {
        console.log(`[Vercel] 🚀 Deploying ${projectName}...`);
        return vercelRequest('POST', '/v13/deployments', {
            name: projectName,
            gitSource: { type: 'github', repoId: projectName },
        });
    }
    async getDeployment(deploymentId) {
        return vercelRequest('GET', `/v13/deployments/${deploymentId}`);
    }
    async listDeployments(projectName) {
        const res = await vercelRequest('GET', `/v6/deployments?app=${encodeURIComponent(projectName)}&limit=5`);
        return res.deployments ?? [];
    }
}
exports.VercelIntegration = VercelIntegration;
exports.vercel = new VercelIntegration();
