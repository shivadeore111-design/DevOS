// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/fileIngestion.ts — Local PDF / EPUB / TXT / MD text extractor
//
// All processing is done on the user's machine. No data leaves the device.
//
// Dependencies (bundled with DevOS):
//   pdf-parse  — pure-JS PDF text extraction
//   epub2      — EPUB chapter extraction

import fs   from 'fs'
import path from 'path'

// ── Types ──────────────────────────────────────────────────

export interface ExtractionResult {
  text:      string
  wordCount: number
  pageCount: number     // PDF only; 0 for EPUB/TXT
  format:    'pdf' | 'epub' | 'txt' | 'md'
  fileSizeMB: number
}

// ── PDF extraction ─────────────────────────────────────────
// Uses pdf-parse (pure JS, no native canvas dependency)

export async function extractPDF(filePath: string): Promise<ExtractionResult> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfParse = require('pdf-parse') as (buf: Buffer, opts?: object) => Promise<{ text: string; numpages: number }>

  const buf        = fs.readFileSync(filePath)
  const fileSizeMB = parseFloat((buf.length / 1024 / 1024).toFixed(2))

  let result: { text: string; numpages: number }
  try {
    result = await pdfParse(buf, { max: 0 })  // max: 0 = all pages
  } catch (e: any) {
    throw new Error(`PDF parse failed: ${e.message}`)
  }

  const text      = cleanText(result.text)
  const wordCount = countWords(text)
  const pageCount = result.numpages ?? 0

  return { text, wordCount, pageCount, format: 'pdf', fileSizeMB }
}

// ── EPUB extraction ────────────────────────────────────────
// Reads all spine chapters and concatenates their text content

export async function extractEPUB(filePath: string): Promise<ExtractionResult> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const EPub = require('epub2').EPub as new (p: string) => any

  const fileSizeMB = parseFloat((fs.statSync(filePath).size / 1024 / 1024).toFixed(2))

  const epub = new EPub(filePath)

  await new Promise<void>((resolve, reject) => {
    epub.on('end',   resolve)
    epub.on('error', reject)
    epub.parse()
  })

  const chapterIds: string[] = epub.spine.contents.map((c: any) => c.id)

  const textParts: string[] = []

  for (const id of chapterIds) {
    try {
      const chapter = await new Promise<string>((resolve, reject) => {
        epub.getChapter(id, (err: any, data: string) => {
          if (err) reject(err)
          else resolve(data || '')
        })
      })
      // Strip HTML tags from chapter HTML
      const stripped = chapter.replace(/<[^>]+>/g, ' ')
      textParts.push(stripped)
    } catch {
      // skip unreadable chapters
    }
  }

  const text      = cleanText(textParts.join('\n'))
  const wordCount = countWords(text)

  return { text, wordCount, pageCount: 0, format: 'epub', fileSizeMB }
}

// ── Plain-text / Markdown extraction ──────────────────────

export function extractText(filePath: string, format: 'txt' | 'md' = 'txt'): ExtractionResult {
  const raw        = fs.readFileSync(filePath, 'utf-8')
  const fileSizeMB = parseFloat((Buffer.byteLength(raw, 'utf-8') / 1024 / 1024).toFixed(2))
  const text       = cleanText(raw)
  const wordCount  = countWords(text)

  return { text, wordCount, pageCount: 0, format, fileSizeMB }
}

// ── Router — pick extractor by extension ──────────────────

export async function extractFile(filePath: string): Promise<ExtractionResult> {
  const ext = path.extname(filePath).toLowerCase()

  switch (ext) {
    case '.pdf':
      return extractPDF(filePath)
    case '.epub':
      return extractEPUB(filePath)
    case '.md':
    case '.markdown':
      return extractText(filePath, 'md')
    case '.txt':
    default:
      return extractText(filePath, 'txt')
  }
}

// ── Helpers ────────────────────────────────────────────────

function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g,   '\n')
    .replace(/\n{3,}/g, '\n\n')  // collapse >2 blank lines
    .replace(/[ \t]+/g, ' ')     // collapse horizontal whitespace
    .trim()
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length
}
