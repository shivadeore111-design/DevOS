// ============================================================
// core/playwrightBridge.ts — Centralised Playwright session
// ============================================================
// Single persistent browser context shared across all tool calls
// within a server session.  All browser tools route through here
// instead of duplicating context/page management in toolRegistry.
//
// Environment variables:
//   AIDEN_BROWSER_HEADLESS=true   run headless (default: false / headed)
//   AIDEN_BROWSER_TIMEOUT=15000   default navigation timeout in ms
// ============================================================

import path   from 'path'
import fs     from 'fs'
import { getUserDataDir } from './paths'

// ── Lazy-import Playwright so the server boots even if playwright
//    is not installed (tools will return a clear error message).
let _chromium: any = null
async function getChromium(): Promise<any> {
  if (!_chromium) {
    const pw  = await import('playwright')
    _chromium = pw.chromium
  }
  return _chromium
}

// ── Singleton state ──────────────────────────────────────────
let _browserContext: any = null
let _activePage:     any = null
let _idleTimer:      any = null

const IDLE_MS         = 5 * 60 * 1000                                  // 5 min
const NAV_TIMEOUT     = parseInt(process.env.AIDEN_BROWSER_TIMEOUT ?? '15000', 10)
const HEADLESS        = process.env.AIDEN_BROWSER_HEADLESS === 'true'

function getBrowserProfileDir(): string {
  const base = getUserDataDir()
  const dir  = path.join(base, 'browser-profile')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function resetIdleTimer(): void {
  if (_idleTimer) clearTimeout(_idleTimer)
  _idleTimer = setTimeout(async () => {
    if (_browserContext) {
      console.log('[Browser] Closing idle browser after 5 min inactivity')
      try { await _browserContext.close() } catch {}
      _browserContext = null
      _activePage     = null
    }
  }, IDLE_MS)
}

async function ensureContext(): Promise<any> {
  if (!_browserContext) {
    const chromium  = await getChromium()
    const profile   = getBrowserProfileDir()
    console.log(`[Browser] Launching — profile: ${profile}  headless: ${HEADLESS}`)
    _browserContext = await chromium.launchPersistentContext(profile, {
      headless: HEADLESS,
      viewport: { width: 1280, height: 720 },
    })
  }
  resetIdleTimer()
  return _browserContext
}

async function ensurePage(): Promise<any> {
  const ctx    = await ensureContext()
  const pages  = ctx.pages() as any[]
  if (!_activePage || _activePage.isClosed()) {
    const blank  = pages.find((p: any) => p.url() === 'about:blank')
    _activePage  = blank ?? await ctx.newPage()
  }
  return _activePage
}

// ── Exported helpers ─────────────────────────────────────────

// ── Playwright availability check ────────────────────────────────────────────
let _pwAvailable: boolean | null = null
async function checkPwAvailable(): Promise<boolean> {
  if (_pwAvailable !== null) return _pwAvailable
  try {
    await import('playwright')
    _pwAvailable = true
    console.log('[Browser] playwright available')
  } catch {
    _pwAvailable = false
    console.warn('[Browser] playwright not installed — browser tools unavailable. Run: npm install playwright')
  }
  return _pwAvailable
}

/** Navigate to a URL, reusing the active page (opens blank tab if needed). */
export async function pwNavigate(url: string): Promise<{ ok: boolean; url: string; error?: string }> {
  const available = await checkPwAvailable()
  if (!available) {
    return { ok: false, url, error: 'playwright not installed. Run: npm install playwright && npx playwright install chromium' }
  }
  try {
    const ctx    = await ensureContext()
    const pages  = ctx.pages() as any[]
    const blank  = pages.find((p: any) => p.url() === 'about:blank')
    _activePage  = blank ?? await ctx.newPage()
    await _activePage.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT })
    return { ok: true, url: _activePage.url() }
  } catch (e: any) { return { ok: false, url, error: e.message } }
}

/** Take a full-page screenshot, saved to workspace/screenshots/. Returns the file path. */
export async function pwScreenshot(): Promise<{ ok: boolean; path?: string; error?: string }> {
  try {
    const page   = await ensurePage()
    const dir    = path.join(process.cwd(), 'workspace', 'screenshots')
    fs.mkdirSync(dir, { recursive: true })
    const file   = path.join(dir, `screenshot_${Date.now()}.png`)
    await page.screenshot({ path: file, fullPage: false })
    return { ok: true, path: file }
  } catch (e: any) { return { ok: false, error: e.message } }
}

/** Click an element by CSS selector or text.  Pass 'first_result' for search-result shortcuts. */
export async function pwClick(target: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const page   = await ensurePage()
    const tryClick = async (sel: string): Promise<boolean> => {
      try {
        await page.waitForSelector(sel, { state: 'visible', timeout: 5000 })
        await page.locator(sel).first().click({ timeout: 5000 })
        return true
      } catch { return false }
    }
    const clicked = (await tryClick(target)) || (await tryClick(`text=${target}`))
    if (!clicked) return { ok: false, error: `Element not found or not visible: "${target}"` }
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {})
    return { ok: true }
  } catch (e: any) { return { ok: false, error: e.message } }
}

/** Click the first organic search result on Google / YouTube / DuckDuckGo / Bing. */
export async function pwClickFirstResult(): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const page       = await ensurePage()
    const currentUrl = page.url() as string

    type SiteConfig = { selectors: string[]; navPattern?: RegExp }
    const SITES: { pattern: RegExp; cfg: SiteConfig }[] = [
      {
        pattern: /youtube\.com\/results/,
        cfg: { selectors: ['a#video-title', 'ytd-video-renderer a[href*="/watch"]', 'ytd-rich-item-renderer a#thumbnail'], navPattern: /youtube\.com\/watch/ },
      },
      {
        pattern: /google\.com\/search/,
        cfg: { selectors: ['div.g h3 a', 'div#search a[href]:not([href*="google.com/search"])', 'h3.LC20lb'] },
      },
      {
        pattern: /duckduckgo\.com/,
        cfg: { selectors: ['article[data-testid="result"] h2 a', 'a.result__a', 'ol.react-results--main li a[data-testid="result-title-a"]'] },
      },
      {
        pattern: /bing\.com\/search/,
        cfg: { selectors: ['li.b_algo h2 a', '#b_results .b_algo a'] },
      },
    ]

    const match = SITES.find(s => s.pattern.test(currentUrl))
    if (!match) return { ok: false, error: `first_result not supported for ${currentUrl}` }

    let locator: any = null
    for (const sel of match.cfg.selectors) {
      try {
        await page.waitForSelector(sel, { state: 'visible', timeout: 8000 })
        locator = page.locator(sel).first()
        break
      } catch { /* try next */ }
    }
    if (!locator) return { ok: false, error: `No result selector appeared on ${currentUrl}` }

    if (match.cfg.navPattern) {
      await Promise.all([
        page.waitForURL(match.cfg.navPattern, { timeout: 12000 }),
        locator.click({ timeout: 5000 }),
      ])
    } else {
      await locator.click({ timeout: 5000 })
      await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {})
    }
    return { ok: true, url: page.url() }
  } catch (e: any) { return { ok: false, error: e.message } }
}

/** Type text into the specified selector (defaults to first input). */
export async function pwType(selector: string, text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const page = await ensurePage()
    await page.waitForSelector(selector, { state: 'visible', timeout: 5000 }).catch(() => {})
    await page.fill(selector, text)
    return { ok: true }
  } catch (e: any) { return { ok: false, error: e.message } }
}

/** Scroll the page or a specific element. */
export async function pwScroll(
  direction: 'up' | 'down' | 'top' | 'bottom',
  amount: number,
  selector?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const page = await ensurePage()

    if (selector) {
      await page.waitForSelector(selector, { state: 'visible', timeout: 5000 }).catch(() => {})
      if (direction === 'top') {
        await page.evaluate((sel: string) => {
          // eslint-disable-next-line no-undef
          const el = (globalThis as any).document.querySelector(sel); if (el) el.scrollTop = 0
        }, selector)
      } else if (direction === 'bottom') {
        await page.evaluate((sel: string) => {
          // eslint-disable-next-line no-undef
          const el = (globalThis as any).document.querySelector(sel)
          if (el) el.scrollTop = el.scrollHeight
        }, selector)
      } else {
        const delta = direction === 'up' ? -amount : amount
        await page.evaluate(({ sel, dy }: { sel: string; dy: number }) => {
          // eslint-disable-next-line no-undef
          const el = (globalThis as any).document.querySelector(sel)
          if (el) el.scrollBy(0, dy)
        }, { sel: selector, dy: delta })
      }
    } else {
      if (direction === 'top') {
        await page.evaluate(() => (globalThis as any).window.scrollTo(0, 0))
      } else if (direction === 'bottom') {
        await page.evaluate(() => (globalThis as any).window.scrollTo(0, (globalThis as any).document.body.scrollHeight))
      } else {
        const delta = direction === 'up' ? -amount : amount
        await page.evaluate((dy: number) => (globalThis as any).window.scrollBy(0, dy), delta)
      }
    }
    return { ok: true }
  } catch (e: any) { return { ok: false, error: e.message } }
}

/** Extract visible text from the current page body (first 3 000 chars). */
export async function pwSnapshot(): Promise<{ ok: boolean; text?: string; error?: string }> {
  try {
    const page = await ensurePage()
    // eslint-disable-next-line no-undef
    const text = await page.evaluate(() => (globalThis as any).document.body.innerText) as string
    return { ok: true, text: text.slice(0, 3000) }
  } catch (e: any) { return { ok: false, error: e.message } }
}

/** Return the URL currently loaded in the active browser page. */
export async function pwGetUrl(): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    if (!_activePage || _activePage.isClosed()) {
      const ctx   = await ensureContext()
      const pages = ctx.pages() as any[]
      if (pages.length === 0) return { ok: false, error: 'No browser page open. Use open_browser first.' }
      _activePage = pages[pages.length - 1]
    }
    return { ok: true, url: _activePage.url() }
  } catch (e: any) { return { ok: false, error: e.message } }
}

/** Close the browser context and release all resources (call on server shutdown). */
export async function pwClose(): Promise<void> {
  if (_idleTimer) { clearTimeout(_idleTimer); _idleTimer = null }
  if (_browserContext) {
    try { await _browserContext.close() } catch {}
    _browserContext = null
    _activePage     = null
    console.log('[Browser] Closed on shutdown')
  }
}

/** Expose active page for legacy callers that still need it. */
export function getActiveBrowserPage(): any { return _activePage }
