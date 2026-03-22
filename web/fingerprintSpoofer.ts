// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// web/fingerprintSpoofer.ts — Generates and applies randomised browser fingerprints

export interface BrowserFingerprint {
  userAgent:         string
  viewport:          { width: number; height: number }
  locale:            string
  timezone:          string
  colorScheme:       "light" | "dark"
  deviceScaleFactor: number
}

const USER_AGENTS: string[] = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
]

const VIEWPORTS: Array<{ width: number; height: number }> = [
  { width: 1920, height: 1080 },
  { width: 1440, height:  900 },
  { width: 1366, height:  768 },
  { width: 1280, height:  800 },
  { width: 1536, height:  864 },
]

const LOCALES: string[] = ["en-US", "en-GB", "en-CA"]

const TIMEZONES: string[] = [
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/London",
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export class FingerprintSpoofer {

  /** Returns a randomised but realistic browser fingerprint. */
  getRandomFingerprint(): BrowserFingerprint {
    return {
      userAgent:         pick(USER_AGENTS),
      viewport:          pick(VIEWPORTS),
      locale:            pick(LOCALES),
      timezone:          pick(TIMEZONES),
      colorScheme:       Math.random() > 0.3 ? "light" : "dark",
      deviceScaleFactor: pick([1, 1, 1, 2]), // mostly 1, occasionally 2 (HiDPI)
    }
  }

  /**
   * Applies a fingerprint to a Playwright BrowserContext.
   * Must be called before any page is created on the context.
   */
  async applyToContext(context: any, fingerprint: BrowserFingerprint): Promise<void> {
    await context.setExtraHTTPHeaders({
      "Accept-Language": fingerprint.locale,
    })

    // viewport, userAgent, locale, timezoneId, colorScheme, deviceScaleFactor
    // are normally set at context-creation time (newContext options), but some
    // versions of Playwright expose setGeolocation / setLocale after the fact.
    // We do best-effort here for properties that can be set post-creation.
    try {
      await context.setViewportSize(fingerprint.viewport)
    } catch {
      // some context types don't support this
    }
  }
}

export const fingerprintSpoofer = new FingerprintSpoofer()
