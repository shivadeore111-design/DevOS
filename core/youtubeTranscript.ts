// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/youtubeTranscript.ts — Extract transcripts from YouTube
// videos using the timedtext API (no API key required).
// Falls back to yt-dlp if the page fetch is blocked, then to a
// helpful error message asking the user to paste the transcript.

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// ── Types ──────────────────────────────────────────────────────

export interface TranscriptEntry {
  text:     string
  start:    number   // seconds
  duration: number
}

export interface TranscriptResult {
  title:      string
  transcript: TranscriptEntry[]
  fullText:   string
}

// ── Video ID extraction ────────────────────────────────────────

export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

// ── HTML entity decoder ────────────────────────────────────────

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&#39;/g,  "'")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/<[^>]*>/g, '')  // strip any inline tags
}

// ── Method 1: YouTube timedtext API (no key needed) ───────────

async function fetchViaTimedtextApi(videoId: string): Promise<TranscriptResult | null> {
  const pageUrl = `https://www.youtube.com/watch?v=${videoId}`

  const controller = new AbortController()
  const timer      = setTimeout(() => controller.abort(), 15000)

  let pageHtml: string
  try {
    const resp = await fetch(pageUrl, {
      signal:  controller.signal,
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
    pageHtml = await resp.text()
  } finally {
    clearTimeout(timer)
  }

  // Extract caption tracks JSON from page source
  const captionMatch = pageHtml.match(/"captionTracks":\[(\{.*?\})\]/)
  if (!captionMatch) {
    console.log('[YouTube] No captions found in page source')
    return null
  }

  let captionData: any[]
  try {
    captionData = JSON.parse(`[${captionMatch[1]}]`)
  } catch {
    console.log('[YouTube] Failed to parse captionTracks JSON')
    return null
  }

  // Prefer English, fall back to first available track
  const track =
    captionData.find((t: any) => t.languageCode === 'en') ||
    captionData.find((t: any) => t.languageCode?.startsWith('en')) ||
    captionData[0]

  if (!track?.baseUrl) return null

  // Fetch the XML transcript
  const xmlResp = await fetch(track.baseUrl)
  const xml     = await xmlResp.text()

  // Parse <text start="…" dur="…">…</text> entries
  const entries: TranscriptEntry[] = []
  const regex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g
  let m: RegExpExecArray | null

  while ((m = regex.exec(xml)) !== null) {
    const text = decodeHtmlEntities(m[3]).trim()
    if (text) {
      entries.push({
        start:    parseFloat(m[1]),
        duration: parseFloat(m[2]),
        text,
      })
    }
  }

  if (entries.length === 0) return null

  // Extract page title
  const titleMatch = pageHtml.match(/<title>(.*?)<\/title>/)
  const title      = titleMatch?.[1]?.replace(/ - YouTube$/, '').trim() || 'YouTube Video'
  const fullText   = entries.map(e => e.text).join(' ')

  return { title, transcript: entries, fullText }
}

// ── Method 2: yt-dlp fallback ──────────────────────────────────

async function fetchViaYtDlp(videoId: string): Promise<TranscriptResult | null> {
  const url = `https://www.youtube.com/watch?v=${videoId}`

  // Check if yt-dlp is available
  try {
    await execAsync('yt-dlp --version', { timeout: 5000 })
  } catch {
    console.log('[YouTube] yt-dlp not installed — skipping fallback')
    return null
  }

  console.log('[YouTube] Trying yt-dlp fallback...')

  // --write-auto-sub + --skip-download + --sub-format vtt
  const cmd = `yt-dlp --write-auto-sub --skip-download --sub-lang en --sub-format vtt -o "/tmp/yt_%(id)s" "${url}"`

  try {
    await execAsync(cmd, { timeout: 60000 })
  } catch (e: any) {
    console.log('[YouTube] yt-dlp failed:', e.message?.slice(0, 80))
    return null
  }

  // Read the generated VTT file
  const { readFileSync, existsSync } = await import('fs')
  const vttPath = `/tmp/yt_${videoId}.en.vtt`
  if (!existsSync(vttPath)) {
    console.log('[YouTube] yt-dlp did not produce a VTT file')
    return null
  }

  const vtt = readFileSync(vttPath, 'utf8')

  // Parse VTT — strip cue headers and HTML tags, collect text lines
  const lines  = vtt.split('\n')
  const texts: string[] = []
  const timeRe = /^\d{2}:\d{2}:\d{2}\.\d{3} --> /

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed === 'WEBVTT' || timeRe.test(trimmed)) continue
    if (/^NOTE|^STYLE|^REGION/.test(trimmed)) continue
    const clean = trimmed.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    if (clean) texts.push(clean)
  }

  if (texts.length === 0) return null

  // Deduplicate consecutive identical lines (VTT often repeats)
  const deduped = texts.filter((t, i) => i === 0 || t !== texts[i - 1])
  const fullText = deduped.join(' ')

  return {
    title:      `YouTube Video (${videoId})`,
    transcript: deduped.map((text, i) => ({ text, start: i, duration: 1 })),
    fullText,
  }
}

// ── Public entry point ─────────────────────────────────────────

export async function extractYouTubeTranscript(
  url: string,
): Promise<TranscriptResult | null> {
  const videoId = extractVideoId(url)
  if (!videoId) {
    console.log('[YouTube] Could not extract video ID from URL:', url)
    return null
  }

  console.log(`[YouTube] Extracting transcript for video: ${videoId}`)

  // Try primary method (timedtext API via page fetch)
  try {
    const result = await fetchViaTimedtextApi(videoId)
    if (result) {
      console.log(`[YouTube] Got transcript via timedtext API: ${result.transcript.length} segments`)
      return result
    }
  } catch (err: any) {
    console.log('[YouTube] timedtext API failed:', err.message?.slice(0, 120))
  }

  // Try yt-dlp fallback
  try {
    const result = await fetchViaYtDlp(videoId)
    if (result) {
      console.log(`[YouTube] Got transcript via yt-dlp: ${result.transcript.length} segments`)
      return result
    }
  } catch (err: any) {
    console.log('[YouTube] yt-dlp fallback failed:', err.message?.slice(0, 80))
  }

  console.log('[YouTube] All extraction methods failed for:', videoId)
  return null
}
