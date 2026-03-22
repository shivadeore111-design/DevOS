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
exports.copyToSandbox = copyToSandbox;
exports.syncOutputs = syncOutputs;
exports.writeJsonToSandbox = writeJsonToSandbox;
// sandbox/sandboxFileSync.ts — Copy files into/out of Docker containers via tar-stream
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Copy a local file or directory into a running container.
 * Uses tar-stream to create an in-memory tar archive and streams it
 * to the container via the Docker putArchive API.
 */
async function copyToSandbox(containerId, localPath, remotePath) {
    const Dockerode = require('dockerode');
    const tarStream = require('tar-stream');
    const docker = new Dockerode();
    const container = docker.getContainer(containerId);
    const pack = tarStream.pack();
    function addEntry(filePath, archiveName) {
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            for (const child of fs.readdirSync(filePath)) {
                addEntry(path.join(filePath, child), path.posix.join(archiveName, child));
            }
        }
        else {
            pack.entry({ name: archiveName, size: stat.size }, fs.readFileSync(filePath));
        }
    }
    const entryName = path.basename(localPath);
    addEntry(localPath, entryName);
    pack.finalize();
    await container.putArchive(pack, { path: remotePath });
    console.log(`[SandboxFileSync] Copied ${localPath} → container:${remotePath}/${entryName}`);
}
/**
 * Copy a file or directory from a container back to the local filesystem.
 * Uses getArchive (tar) and extracts with tar-stream.
 */
async function syncOutputs(containerId, remotePath, localDir) {
    const Dockerode = require('dockerode');
    const tarStream = require('tar-stream');
    const docker = new Dockerode();
    const container = docker.getContainer(containerId);
    fs.mkdirSync(localDir, { recursive: true });
    const archiveStream = await container.getArchive({ path: remotePath });
    const extract = tarStream.extract();
    await new Promise((resolve, reject) => {
        extract.on('entry', (header, stream, next) => {
            const outPath = path.join(localDir, header.name);
            if (header.type === 'directory') {
                fs.mkdirSync(outPath, { recursive: true });
                stream.resume();
                next();
            }
            else {
                const dir = path.dirname(outPath);
                fs.mkdirSync(dir, { recursive: true });
                const out = fs.createWriteStream(outPath);
                stream.pipe(out);
                out.on('finish', next);
                out.on('error', reject);
            }
        });
        extract.on('finish', resolve);
        extract.on('error', reject);
        archiveStream.pipe(extract);
    });
    console.log(`[SandboxFileSync] Synced container:${remotePath} → ${localDir}`);
}
/**
 * Write a JSON payload as a file inside the container.
 */
async function writeJsonToSandbox(containerId, remotePath, filename, payload) {
    const Dockerode = require('dockerode');
    const tarStream = require('tar-stream');
    const docker = new Dockerode();
    const container = docker.getContainer(containerId);
    const json = JSON.stringify(payload, null, 2);
    const buf = Buffer.from(json, 'utf-8');
    const pack = tarStream.pack();
    pack.entry({ name: filename, size: buf.length }, buf);
    pack.finalize();
    await container.putArchive(pack, { path: remotePath });
    console.log(`[SandboxFileSync] Wrote ${filename} to container:${remotePath}`);
}
