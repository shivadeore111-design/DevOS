// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// knowledge/ingestionEngine.ts — Orchestrates the full ingest pipeline:
//   parse → extract → store → graph edges.

import fs   from "fs"
import path from "path"

import { documentParser }     from "./documentParser"
import { knowledgeExtractor } from "./knowledgeExtractor"
import { knowledgeStore }     from "./knowledgeStore"
import { knowledgeGraph }     from "./knowledgeGraph"
import { memoryLayers }       from "../memory/memoryLayers"
import { fetchPage }          from "../web/pageFetcher"

const SUPPORTED_EXTENSIONS = new Set([
  ".txt", ".md", ".json", ".ts", ".js", ".html", ".htm", ".csv",
])

export class IngestionEngine {

  /**
   * Full ingest pipeline for a single file.
   * Returns the new KnowledgeEntry id.
   */
  async ingest(filePath: string, tags: string[] = []): Promise<string> {
    const absPath = path.resolve(filePath)

    // 1. Parse
    const doc = await documentParser.parse(absPath)

    // 2. Extract metadata via LLM (best-effort; falls back to defaults)
    let extraction = { title: doc.title, summary: "", keyFacts: [] as string[], tags: [] as string[], relatedTopics: [] as string[] }
    try {
      extraction = await knowledgeExtractor.extract(doc)
    } catch (err: any) {
      console.warn(`[IngestionEngine] Extractor failed (continuing): ${err.message}`)
    }

    // 3. Store
    const allTags = [...new Set([...tags, ...extraction.tags])]
    const entryId = knowledgeStore.add({
      title:   extraction.title || doc.title,
      content: doc.content,
      chunks:  doc.chunks,
      source:  absPath,
      tags:    allTags,
    })
    memoryLayers.write(
      `ingested: ${extraction.title || doc.title} — ${(extraction.summary || doc.content).slice(0, 300)}`,
      ['ingestion', ...allTags.slice(0, 5)],
    )

    // 4. Add graph edges for related topics
    //    Link to any existing entries whose title appears in relatedTopics
    for (const topic of extraction.relatedTopics) {
      const related = knowledgeStore.search(topic, 1)
      if (related.length > 0 && related[0].id !== entryId) {
        knowledgeGraph.addEdge(entryId, related[0].id, "related_to", 0.6)
      }
    }

    // 5. Log
    console.log(
      `[IngestionEngine] ✅ Ingested: ${extraction.title || doc.title} (${doc.chunks.length} chunks)`
    )

    return entryId
  }

  /**
   * Ingest all supported files in a directory (non-recursive by default).
   * Returns array of knowledge entry ids.
   */
  async ingestDirectory(dirPath: string, tags: string[] = []): Promise<string[]> {
    const absDir = path.resolve(dirPath)

    if (!fs.existsSync(absDir)) {
      console.warn(`[IngestionEngine] Directory not found: ${absDir}`)
      return []
    }

    const entries = fs.readdirSync(absDir)
    const ids: string[] = []

    for (const entry of entries) {
      const full = path.join(absDir, entry)
      const ext  = path.extname(entry).toLowerCase()

      let stat: fs.Stats
      try { stat = fs.statSync(full) } catch { continue }

      if (stat.isFile() && SUPPORTED_EXTENSIONS.has(ext)) {
        try {
          const id = await this.ingest(full, tags)
          ids.push(id)
        } catch (err: any) {
          console.warn(`[IngestionEngine] Skipping ${entry}: ${err.message}`)
        }
      }
    }

    console.log(`[IngestionEngine] Ingested ${ids.length} files from ${dirPath}`)
    return ids
  }

  /**
   * Fetch a URL via pageFetcher, write to a temp file, ingest, then clean up.
   */
  async ingestUrl(url: string, tags: string[] = []): Promise<string> {
    console.log(`[IngestionEngine] Fetching URL: ${url}`)

    const result = await fetchPage(url)
    if (!result.success || !result.text) {
      throw new Error(`Failed to fetch URL: ${result.error ?? "no content"}`)
    }

    // Write to temp file so documentParser can handle it
    const tmpDir  = path.join(process.cwd(), "workspace", "tmp")
    fs.mkdirSync(tmpDir, { recursive: true })

    const safeName = url
      .replace(/^https?:\/\//, "")
      .replace(/[^a-zA-Z0-9]/g, "_")
      .slice(0, 60)
    const tmpFile = path.join(tmpDir, `${safeName}.txt`)

    fs.writeFileSync(tmpFile, result.text, "utf-8")

    try {
      const id = await this.ingest(tmpFile, [...tags, "web", "url"])
      return id
    } finally {
      try { fs.unlinkSync(tmpFile) } catch { /* ignore */ }
    }
  }
}

export const ingestionEngine = new IngestionEngine()
