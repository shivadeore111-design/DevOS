// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// web/stealthPlugin.ts — Hides Playwright automation signals from detection

export class StealthPlugin {

  /**
   * Injects anti-detection scripts into every page before any other script runs.
   * Removes common Playwright/automation fingerprints.
   */
  async applyToPage(page: any): Promise<void> {
    await page.addInitScript(() => {
      // 1. Remove navigator.webdriver
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
        configurable: true,
      });

      // 2. Spoof navigator.plugins — 3 fake plugins
      const fakePlugins = [
        { name: "Chrome PDF Plugin",      filename: "internal-pdf-viewer",    description: "Portable Document Format" },
        { name: "Chrome PDF Viewer",      filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai", description: "" },
        { name: "Native Client",          filename: "internal-nacl-plugin",   description: "" },
      ];
      Object.defineProperty(navigator, "plugins", {
        get: () => {
          const arr: any[] = fakePlugins.map(p => {
            const plugin: any = { name: p.name, filename: p.filename, description: p.description, length: 0 };
            return plugin;
          });
          (arr as any).namedItem  = (name: string) => arr.find(p => p.name === name) ?? null;
          (arr as any).refresh    = () => {};
          (arr as any).item       = (i: number) => arr[i] ?? null;
          (arr as any).length     = arr.length;
          return arr;
        },
        configurable: true,
      });

      // 3. Spoof navigator.languages
      Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en"],
        configurable: true,
      });

      // 4. Patch window.chrome to exist with a fake runtime
      if (!(window as any).chrome) {
        (window as any).chrome = {
          runtime: {
            id:              undefined,
            connect:         () => {},
            sendMessage:     () => {},
            onMessage:       { addListener: () => {}, removeListener: () => {} },
            getManifest:     () => ({}),
            getURL:          (path: string) => path,
          },
          loadTimes:       () => ({}),
          csi:             () => ({}),
          app:             { isInstalled: false },
        };
      }

      // 5. Override permissions.query to never return 'denied'
      const originalQuery = window.navigator.permissions?.query?.bind(navigator.permissions);
      if (originalQuery) {
        (navigator.permissions as any).query = (parameters: any) => {
          return originalQuery(parameters).then((result: any) => {
            if (result.state === "denied") {
              Object.defineProperty(result, "state", { get: () => "prompt" });
            }
            return result;
          });
        };
      }

      // 6. Spoof navigator.hardwareConcurrency to random value 4–16
      const concurrencyValues = [4, 6, 8, 10, 12, 16];
      const fakeConcurrency   = concurrencyValues[Math.floor(Math.random() * concurrencyValues.length)];
      Object.defineProperty(navigator, "hardwareConcurrency", {
        get: () => fakeConcurrency,
        configurable: true,
      });

      // 7. Spoof screen.colorDepth to 24
      Object.defineProperty(screen, "colorDepth", {
        get: () => 24,
        configurable: true,
      });
    });
  }
}

export const stealthPlugin = new StealthPlugin();
