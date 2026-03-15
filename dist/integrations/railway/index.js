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
exports.railway = exports.RailwayIntegration = void 0;
// integrations/railway/index.ts — Railway GraphQL API integration
const https = __importStar(require("https"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function loadToken() {
    try {
        const configPath = path.join(process.cwd(), 'config', 'integrations.json');
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        return config.railway?.token ?? process.env.RAILWAY_TOKEN ?? '';
    }
    catch {
        return process.env.RAILWAY_TOKEN ?? '';
    }
}
async function railwayGraphQL(query, variables) {
    const token = loadToken();
    const body = JSON.stringify({ query, variables });
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'backboard.railway.app',
            path: '/graphql/v2',
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
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
        req.write(body);
        req.end();
    });
}
class RailwayIntegration {
    async listProjects() {
        const res = await railwayGraphQL(`{ projects { edges { node { id name } } } }`);
        return res.data?.projects?.edges?.map((e) => e.node) ?? [];
    }
    async deployService(projectId, serviceId) {
        console.log(`[Railway] 🚂 Deploying service ${serviceId} in project ${projectId}...`);
        return railwayGraphQL(`
      mutation Deploy($serviceId: String!) {
        serviceInstanceDeploy(serviceId: $serviceId) { id status }
      }
    `, { serviceId });
    }
    async getDeploymentStatus(deploymentId) {
        const res = await railwayGraphQL(`
      query Status($id: String!) {
        deployment(id: $id) { status }
      }
    `, { id: deploymentId });
        return res.data?.deployment?.status ?? 'unknown';
    }
}
exports.RailwayIntegration = RailwayIntegration;
exports.railway = new RailwayIntegration();
