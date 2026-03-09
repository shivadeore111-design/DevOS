// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// api/routes/knowledge.ts — Knowledge REST endpoints

// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require("express") as any;

import * as fs             from "fs";
import * as path           from "path";
import * as os             from "os";
import { ingestionEngine } from "../../knowledge/ingestionEngine";
import { knowledgeStore }  from "../../knowledge/knowledgeStore";
import { knowledgeQuery }  from "../../knowledge/knowledgeQuery";

const router = express.Router();

// GET /api/knowledge
router.get("/api/knowledge", (_req: any, res: any) => {
  res.json(knowledgeStore.list());
});

// POST /api/knowledge/ingest
router.post("/api/knowledge/ingest", async (req: any, res: any) => {
  const { filePath, url, text, title } = req.body ?? {};
  try {
    if (filePath) {
      const id = await ingestionEngine.ingest(filePath as string);
      res.json({ id, source: "file", filePath }); return;
    }
    if (url) {
      const id = await ingestionEngine.ingestUrl(url as string);
      res.json({ id, source: "url", url }); return;
    }
    if (text) {
      const tmpFile = path.join(os.tmpdir(), `devos-ingest-${Date.now()}.txt`);
      const header  = title ? `# ${title}\n\n` : "";
      fs.writeFileSync(tmpFile, header + text, "utf-8");
      try {
        const id = await ingestionEngine.ingest(tmpFile, title ? [title as string] : []);
        res.json({ id, source: "text", title: title ?? "untitled" });
      } finally {
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      }
      return;
    }
    res.status(400).json({ error: "Provide filePath, url, or text + title" });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// POST /api/knowledge/query
router.post("/api/knowledge/query", async (req: any, res: any) => {
  const { question } = req.body ?? {};
  if (!question) { res.status(400).json({ error: "Missing required field: question" }); return; }
  try {
    const result = await knowledgeQuery.query(question as string);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// GET /api/knowledge/:id
router.get("/api/knowledge/:id", (req: any, res: any) => {
  const entry = knowledgeStore.get(req.params.id);
  if (!entry) { res.status(404).json({ error: `Knowledge entry not found: ${req.params.id}` }); return; }
  res.json(entry);
});

// DELETE /api/knowledge/:id
router.delete("/api/knowledge/:id", (req: any, res: any) => {
  if (!knowledgeStore.get(req.params.id)) {
    res.status(404).json({ error: `Knowledge entry not found: ${req.params.id}` }); return;
  }
  knowledgeStore.delete(req.params.id);
  res.json({ deleted: req.params.id });
});

export default router;
