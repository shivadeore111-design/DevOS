"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.github = exports.GithubIntegration = void 0;
// integrations/github/index.ts — Pure Node.js GitHub REST API client.
const https_1 = __importDefault(require("https"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const INTEGRATIONS_FILE = path_1.default.join(process.cwd(), "config", "integrations.json");
const API_HOST = "api.github.com";
const TIMEOUT_MS = 15000;
function loadToken() {
    // Env overrides config file
    if (process.env.GITHUB_TOKEN)
        return process.env.GITHUB_TOKEN;
    try {
        const cfg = JSON.parse(fs_1.default.readFileSync(INTEGRATIONS_FILE, "utf-8"));
        return cfg?.github?.token ?? "";
    }
    catch {
        return "";
    }
}
function loadDefaultRepo() {
    try {
        const cfg = JSON.parse(fs_1.default.readFileSync(INTEGRATIONS_FILE, "utf-8"));
        return cfg?.github?.defaultRepo ?? "";
    }
    catch {
        return "";
    }
}
function httpsRequest(method, urlPath, token, body) {
    return new Promise((resolve, reject) => {
        const headers = {
            "User-Agent": "DevOS/1.0",
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json",
        };
        if (token)
            headers["Authorization"] = `token ${token}`;
        if (body)
            headers["Content-Length"] = Buffer.byteLength(body).toString();
        const options = {
            hostname: API_HOST,
            port: 443,
            path: urlPath,
            method,
            headers,
            timeout: TIMEOUT_MS,
        };
        const req = https_1.default.request(options, res => {
            let data = "";
            res.setEncoding("utf-8");
            res.on("data", chunk => { data += chunk; });
            res.on("end", () => {
                if (res.statusCode && res.statusCode >= 400) {
                    reject(new Error(`GitHub API ${res.statusCode}: ${data.slice(0, 200)}`));
                    return;
                }
                try {
                    resolve(JSON.parse(data));
                }
                catch {
                    resolve(data);
                }
            });
            res.on("error", reject);
        });
        req.on("timeout", () => { req.destroy(); reject(new Error("GitHub request timed out")); });
        req.on("error", reject);
        if (body)
            req.write(body);
        req.end();
    });
}
class GithubIntegration {
    get token() { return loadToken(); }
    get defaultRepo() { return loadDefaultRepo(); }
    /** List issues for a repo. State: "open" | "closed" | "all" (default "open"). */
    async listIssues(repo, state = "open") {
        const raw = await httpsRequest("GET", `/repos/${repo}/issues?state=${state}&per_page=30`, this.token);
        return (Array.isArray(raw) ? raw : []).map(i => ({
            id: i.number,
            title: i.title ?? "",
            body: i.body ?? "",
            state: i.state ?? "",
            labels: (i.labels ?? []).map((l) => l.name ?? ""),
            createdAt: i.created_at ?? "",
        }));
    }
    /** Create a new issue. */
    async createIssue(repo, title, body) {
        const raw = await httpsRequest("POST", `/repos/${repo}/issues`, this.token, JSON.stringify({ title, body }));
        return {
            id: raw.number ?? 0,
            title: raw.title ?? title,
            body: raw.body ?? body,
            state: raw.state ?? "open",
            labels: [],
            createdAt: raw.created_at ?? new Date().toISOString(),
        };
    }
    /** List pull requests. */
    async listPRs(repo) {
        const raw = await httpsRequest("GET", `/repos/${repo}/pulls?per_page=30`, this.token);
        return Array.isArray(raw) ? raw : [];
    }
    /** Get repository metadata. */
    async getRepoInfo(repo) {
        return httpsRequest("GET", `/repos/${repo}`, this.token);
    }
}
exports.GithubIntegration = GithubIntegration;
exports.github = new GithubIntegration();
