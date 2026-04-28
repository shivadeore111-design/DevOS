// ============================================================
// DevOS — Plugin Loader (flat .js format)
// Loads workspace/plugins/*.js  (files NOT starting with _)
// Runs alongside the existing pluginSystem.ts (subdirectory format).
// ============================================================

import * as fs   from 'fs'
import * as path from 'path'
import { registerExternalTool } from './toolRegistry'

// ── Hook arrays ───────────────────────────────────────────────
export interface PreToolHook {
  (tool: string, input: any): Promise<{ skip?: boolean; input?: any }>
}
export interface PostToolHook {
  (tool: string, input: any, result: any): Promise<{ result?: any }>
}
export interface SessionHook {
  (sessionId: string, ctx: Record<string, any>): Promise<void>
}

export interface PluginHooks {
  preTool:        PreToolHook[]
  postTool:       PostToolHook[]
  onSessionStart: SessionHook[]
  onSessionEnd:   SessionHook[]
}

export const pluginHooks: PluginHooks = {
  preTool:        [],
  postTool:       [],
  onSessionStart: [],
  onSessionEnd:   [],
}

// ── Loaded-plugin registry ────────────────────────────────────
export interface LoadedPlugin {
  name:     string
  version:  string
  file:     string
  loadedAt: number
  dispose?: () => void | Promise<void>
}

export const loadedFlatPlugins: LoadedPlugin[] = []

// ── Plugin context (passed to init) ──────────────────────────
function makeContext(pluginName: string) {
  return {
    registerTool(def: {
      name:        string
      description: string
      input_schema?: Record<string, any>
      execute:     (input: any) => Promise<any>
    }) {
      registerExternalTool(def.name, def.execute, pluginName)
    },

    hooks: {
      preTool(fn: PreToolHook)        { pluginHooks.preTool.push(fn) },
      postTool(fn: PostToolHook)       { pluginHooks.postTool.push(fn) },
      onSessionStart(fn: SessionHook)  { pluginHooks.onSessionStart.push(fn) },
      onSessionEnd(fn: SessionHook)    { pluginHooks.onSessionEnd.push(fn) },
    },

    log(...args: any[]) {
      console.log(`[Plugin:${pluginName}]`, ...args)
    },
  }
}

// ── Loader ────────────────────────────────────────────────────
export async function loadPlugins(pluginDir: string): Promise<void> {
  if (!fs.existsSync(pluginDir)) {
    fs.mkdirSync(pluginDir, { recursive: true })
    return
  }

  const entries = fs.readdirSync(pluginDir).filter(f => {
    if (!f.endsWith('.js'))      return false  // .js only
    if (f.startsWith('_'))       return false  // skip _example.js etc.
    return true
  })

  for (const file of entries) {
    const fullPath = path.resolve(pluginDir, file)
    try {
      // Clear require cache so reload works
      delete require.cache[require.resolve(fullPath)]
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const def = require(fullPath)

      const name    = def.name    || path.basename(file, '.js')
      const version = def.version || '0.0.0'

      if (typeof def.init !== 'function') {
        console.warn(`[PluginLoader] ${file}: no init() — skipping`)
        continue
      }

      const ctx = makeContext(name)
      const dispose = await def.init(ctx)

      loadedFlatPlugins.push({
        name,
        version,
        file:     fullPath,
        loadedAt: Date.now(),
        dispose:  typeof dispose === 'function' ? dispose : def.dispose,
      })

      console.log(`[PluginLoader] Loaded: ${name} v${version} (${file})`)
    } catch (err: any) {
      console.error(`[PluginLoader] Failed to load ${file}:`, err.message)
    }
  }
}

// ── Reload — dispose old plugins then reload all flat plugins ─
export async function reloadPlugins(pluginDir: string): Promise<void> {
  // Dispose in reverse order
  for (let i = loadedFlatPlugins.length - 1; i >= 0; i--) {
    const p = loadedFlatPlugins[i]
    if (p.dispose) {
      try { await p.dispose() } catch { /* ignore dispose errors */ }
    }
  }
  loadedFlatPlugins.length = 0

  // Clear hooks contributed by flat plugins (note: subdirectory plugins aren't touched)
  pluginHooks.preTool.length        = 0
  pluginHooks.postTool.length       = 0
  pluginHooks.onSessionStart.length = 0
  pluginHooks.onSessionEnd.length   = 0

  await loadPlugins(pluginDir)
}

// ── Status ────────────────────────────────────────────────────
export function listFlatPlugins() {
  return loadedFlatPlugins.map(p => ({
    name:     p.name,
    version:  p.version,
    file:     path.basename(p.file),
    loadedAt: p.loadedAt,
  }))
}
