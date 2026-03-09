// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// web/rssReader.ts — Pure Node.js RSS/Atom feed reader (no external deps)

import * as https from "https"
import * as http  from "http"
import * as url   from "url"

const TIMEOUT_MS   = 10_000
const MAX_ITEMS    = 20
const FEED_PATHS   = ["/feed", "/rss", "/feed.xml", "/atom.xml", "/rss.xml", "/index.xml"]

export interface RSSItem {
  title:       string
  url:         string
  description: string
  publishedAt: Date | null
}

export class RSSReader {

  /**
   * Fetches and parses an RSS/Atom feed URL.
   * Returns up to MAX_ITEMS items.
   */
  async fetch(feedUrl: string): Promise<RSSItem[]> {
    try {
      const xml   = await this._httpGet(feedUrl)
      const items = this._parseXML(xml)
      return items.slice(0, MAX_ITEMS)
    } catch (err: any) {
      console.error(`[RSSReader] fetch failed for ${feedUrl}: ${err.message}`)
      return []
    }
  }

  /**
   * Attempts to discover a feed URL for a given site by probing common paths.
   * Returns the first working feed URL, or null if none found.
   */
  async discover(siteUrl: string): Promise<string | null> {
    const parsed = url.parse(siteUrl)
    const base   = `${parsed.protocol}//${parsed.hostname}`

    for (const feedPath of FEED_PATHS) {
      const candidate = `${base}${feedPath}`
      try {
        const xml = await this._httpGet(candidate)
        if (this._looksLikeFeed(xml)) {
          console.log(`[RSSReader] Discovered feed at ${candidate}`)
          return candidate
        }
      } catch {
        // probe failed — try next
      }
    }

    console.log(`[RSSReader] No feed found for ${siteUrl}`)
    return null
  }

  // ── XML Parsing ───────────────────────────────────────────

  private _parseXML(xml: string): RSSItem[] {
    const items: RSSItem[] = []

    // Match <item> or <entry> blocks (RSS 2.0 and Atom)
    const itemRe = /<(?:item|entry)[\s>]([\s\S]*?)<\/(?:item|entry)>/gi
    let block: RegExpExecArray | null

    while ((block = itemRe.exec(xml)) !== null) {
      const content = block[1]
      const item    = this._parseItem(content)
      if (item) items.push(item)
    }

    return items
  }

  private _parseItem(content: string): RSSItem | null {
    const title       = this._extractTag(content, "title")
    const link        = this._extractLink(content)
    const description = this._extractDescription(content)
    const pubDate     = this._extractTag(content, "pubDate")
                     ?? this._extractTag(content, "published")
                     ?? this._extractTag(content, "updated")

    if (!title && !link) return null

    return {
      title:       this._decodeEntities(title ?? ""),
      url:         link ?? "",
      description: this._decodeEntities(description ?? ""),
      publishedAt: pubDate ? this._parseDate(pubDate) : null,
    }
  }

  private _extractTag(content: string, tag: string): string | null {
    // Handle CDATA: <tag><![CDATA[...]]></tag>
    const cdataRe = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, "i")
    const cdataM  = cdataRe.exec(content)
    if (cdataM) return cdataM[1].trim()

    // Plain tag: <tag>...</tag>
    const plainRe = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i")
    const plainM  = plainRe.exec(content)
    if (plainM) return plainM[1].trim()

    return null
  }

  private _extractLink(content: string): string | null {
    // <link>url</link>
    const inner = this._extractTag(content, "link")
    if (inner && inner.startsWith("http")) return inner

    // Atom <link href="url"/>
    const attrRe = /<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i
    const attrM  = attrRe.exec(content)
    if (attrM) return attrM[1].trim()

    return null
  }

  private _extractDescription(content: string): string | null {
    return this._extractTag(content, "description")
        ?? this._extractTag(content, "summary")
        ?? this._extractTag(content, "content")
  }

  private _decodeEntities(text: string): string {
    return text
      .replace(/&amp;/g,  "&")
      .replace(/&lt;/g,   "<")
      .replace(/&gt;/g,   ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g,  "'")
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/<[^>]+>/g, "")   // strip any remaining HTML tags
      .trim()
  }

  private _parseDate(dateStr: string): Date | null {
    try {
      const d = new Date(dateStr.trim())
      return isNaN(d.getTime()) ? null : d
    } catch {
      return null
    }
  }

  private _looksLikeFeed(xml: string): boolean {
    return /<rss|<feed|<channel|<item|<entry/i.test(xml.slice(0, 2000))
  }

  // ── HTTP Fetch ─────────────────────────────────────────────

  private _httpGet(rawUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsed  = url.parse(rawUrl)
      const isHttps = parsed.protocol === "https:"
      const lib     = isHttps ? https : http

      const options: http.RequestOptions = {
        hostname: parsed.hostname ?? "",
        port:     parsed.port ?? (isHttps ? 443 : 80),
        path:     parsed.path ?? "/",
        method:   "GET",
        headers: {
          "User-Agent": "DevOS/1.0 RSS Reader",
          "Accept":     "application/rss+xml, application/atom+xml, text/xml, */*",
        },
        timeout: TIMEOUT_MS,
      }

      const req = lib.request(options, res => {
        const code = res.statusCode ?? 0

        if ((code === 301 || code === 302 || code === 307) && res.headers.location) {
          res.resume()
          const nextUrl = res.headers.location.startsWith("http")
            ? res.headers.location
            : `${parsed.protocol}//${parsed.hostname}${res.headers.location}`
          this._httpGet(nextUrl).then(resolve).catch(reject)
          return
        }

        if (code < 200 || code >= 400) {
          res.resume()
          reject(new Error(`HTTP ${code}`))
          return
        }

        let data = ""
        res.setEncoding("utf-8")
        res.on("data",  chunk => { data += chunk })
        res.on("end",   () => resolve(data))
        res.on("error", reject)
      })

      req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")) })
      req.on("error",   reject)
      req.end()
    })
  }
}

export const rssReader = new RSSReader()
