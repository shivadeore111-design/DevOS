// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// web/browserFetcher.ts — Playwright-based headless browser fetcher with
//                          stealth and fingerprint spoofing

import { stealthPlugin }      from "./stealthPlugin"
import { fingerprintSpoofer } from "./fingerprintSpoofer"

const DEFAULT_TIMEOUT    = 20_000
const MAX_CONTENT_CHARS  = 8_000
const MAX_CONCURRENT     = 3

export interface PageResult {
  success:    boolean
  url:        string
  title?:     string
  text?:      string
  html?:      string
  error?:     string
  statusCode?: number
}

export class BrowserFetcher {

  /**
   * Fetch a single URL using a headless Chromium browser.
   * Applies stealth + random fingerprint. Returns page title and text content.
   */
  async fetch(
    url: string,
    options: { waitFor?: string; timeout?: number } = {},
  ): Promise<PageResult> {
    const timeout = options.timeout ?? DEFAULT_TIMEOUT

    let playwright: any
    try {
      playwright = require("playwright")
    } catch {
      return {
        success: false,
        url,
        error: "Playwright is not installed. Run: npm install playwright && npx playwright install chromium",
      }
    }

    const fp      = fingerprintSpoofer.getRandomFingerprint()
    let   browser: any = null

    try {
      browser = await playwright.chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
          "--disable-infobars",
          "--window-size=1920,1080",
        ],
      })

      const context = await browser.newContext({
        userAgent:         fp.userAgent,
        viewport:          fp.viewport,
        locale:            fp.locale,
        timezoneId:        fp.timezone,
        colorScheme:       fp.colorScheme,
        deviceScaleFactor: fp.deviceScaleFactor,
        ignoreHTTPSErrors: true,
      })

      const page = await context.newPage()
      await stealthPlugin.applyToPage(page)

      const response = await page.goto(url, {
        waitUntil: (options.waitFor as any) ?? "domcontentloaded",
        timeout,
      })

      const statusCode = response?.status() ?? 0
      const title      = await page.title()
      const text       = (await page.evaluate(() => (document as any).body?.innerText ?? "") as string)
                           .slice(0, MAX_CONTENT_CHARS)
      const html       = await page.content()

      await browser.close()

      return { success: true, url, title, text, html, statusCode }

    } catch (err: any) {
      if (browser) {
        try { await browser.close() } catch { /* ignore */ }
      }
      return { success: false, url, error: err.message }
    }
  }

  /**
   * Fetch multiple URLs in parallel with a concurrency cap of MAX_CONCURRENT.
   */
  async fetchMultiple(urls: string[]): Promise<PageResult[]> {
    const results: PageResult[] = []
    const queue                 = [...urls]

    const worker = async (): Promise<void> => {
      while (queue.length > 0) {
        const url = queue.shift()
        if (!url) return
        results.push(await this.fetch(url))
      }
    }

    const workers = Array.from({ length: Math.min(MAX_CONCURRENT, urls.length) }, worker)
    await Promise.all(workers)
    return results
  }
}

export const browserFetcher = new BrowserFetcher()
