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
// api/routes/knowledge.ts — Knowledge REST endpoints
// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require("express");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const ingestionEngine_1 = require("../../knowledge/ingestionEngine");
const knowledgeStore_1 = require("../../knowledge/knowledgeStore");
const knowledgeQuery_1 = require("../../knowledge/knowledgeQuery");
const router = express.Router();
// GET /api/knowledge
router.get("/api/knowledge", (_req, res) => {
    res.json(knowledgeStore_1.knowledgeStore.list());
});
// POST /api/knowledge/ingest
router.post("/api/knowledge/ingest", async (req, res) => {
    const { filePath, url, text, title } = req.body ?? {};
    try {
        if (filePath) {
            const id = await ingestionEngine_1.ingestionEngine.ingest(filePath);
            res.json({ id, source: "file", filePath });
            return;
        }
        if (url) {
            const id = await ingestionEngine_1.ingestionEngine.ingestUrl(url);
            res.json({ id, source: "url", url });
            return;
        }
        if (text) {
            const tmpFile = path.join(os.tmpdir(), `devos-ingest-${Date.now()}.txt`);
            const header = title ? `# ${title}\n\n` : "";
            fs.writeFileSync(tmpFile, header + text, "utf-8");
            try {
                const id = await ingestionEngine_1.ingestionEngine.ingest(tmpFile, title ? [title] : []);
                res.json({ id, source: "text", title: title ?? "untitled" });
            }
            finally {
                if (fs.existsSync(tmpFile))
                    fs.unlinkSync(tmpFile);
            }
            return;
        }
        res.status(400).json({ error: "Provide filePath, url, or text + title" });
    }
    catch (err) {
        res.status(500).json({ error: err?.message ?? String(err) });
    }
});
// POST /api/knowledge/query
router.post("/api/knowledge/query", async (req, res) => {
    const { question } = req.body ?? {};
    if (!question) {
        res.status(400).json({ error: "Missing required field: question" });
        return;
    }
    try {
        const result = await knowledgeQuery_1.knowledgeQuery.query(question);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err?.message ?? String(err) });
    }
});
// GET /api/knowledge/:id
router.get("/api/knowledge/:id", (req, res) => {
    const entry = knowledgeStore_1.knowledgeStore.get(req.params.id);
    if (!entry) {
        res.status(404).json({ error: `Knowledge entry not found: ${req.params.id}` });
        return;
    }
    res.json(entry);
});
// DELETE /api/knowledge/:id
router.delete("/api/knowledge/:id", (req, res) => {
    if (!knowledgeStore_1.knowledgeStore.get(req.params.id)) {
        res.status(404).json({ error: `Knowledge entry not found: ${req.params.id}` });
        return;
    }
    knowledgeStore_1.knowledgeStore.delete(req.params.id);
    res.json({ deleted: req.params.id });
});
exports.default = router;
