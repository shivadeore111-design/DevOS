// ============================================================
// DevOS — Plugin Loader (unified flat .js format)
// Loads workspace/plugins/*.js  (files NOT starting with _)
//
// This is the single plugin system for Aiden v3.17+.
// core/pluginSystem.ts is deprecated — all new plugins use
// the flat format with init(ctx).
// ============================================================

import * as fs   from 'fs'
import * as path from 'path'
import { registerExternalTool } from './toolRegistry'
import { registerExternalHook } from './hooks'

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

// ── External services injectable into plugin context ─────────
/**
 * Services passed to loadPlugins / makeContext.
 *
 * Plugins receive { commandCatalog, ...other } in their load context.
 * Register slash commands via:
 *
 *   ctx.commandCatalog.register('/name', {
 *     desc:    'What it does',
 *     section: 'tools',       // catalog section (info | session | tools | memory | power | debug)
 *     origin:  'plugin',
 *     handler: async (args) => { ... },  // args = parts after the command name
 *   })
 *
 * Registered commands immediately appear in the CLI Tab-dropdown (next keystroke).
 * Unregister on dispose:
 *
 *   ctx.commandCatalog.unregister('/name')
 */
export interface CommandCatalogService {
  register(name: string, detail: {
    desc:     string
    section:  string
    origin?:  'core' | 'plugin'
    handler?: (args: string[]) => Promise<void>
    [key: string]: any
  }): void
  unregister(name: string): void
  list(): Array<[string, Record<string, any>]>
  get(name: string): Record<string, any> | undefined
  generation(): number
}

export interface PluginServices {
  commandCatalog?: CommandCatalogService
}

// ── Loaded-plugin registry ────────────────────────────────────
export interface LoadedPlugin {
  name:        string
  version:     string
  description: string
  author:      string
  file:        string
  loadedAt:    number
  active:      boolean
  dispose?:    () => void | Promise<void>
}

export const loadedFlatPlugins: LoadedPlugin[] = []

// ── Plugin context (passed to init / onLoad) ──────────────────
function makeContext(pluginName: string, services: PluginServices = {}) {
  return {
    registerTool(def: {
      name:         string
      description:  string
      input_schema?: Record<string, any>
      execute:      (input: any) => Promise<any>
    }) {
      registerExternalTool(def.name, def.execute, pluginName)
    },

    // Lifecycle hooks that fire around every tool call and session boundary
    hooks: {
      preTool(fn: PreToolHook)        { pluginHooks.preTool.push(fn) },
      postTool(fn: PostToolHook)       { pluginHooks.postTool.push(fn) },
      onSessionStart(fn: SessionHook)  { pluginHooks.onSessionStart.push(fn) },
      onSessionEnd(fn: SessionHook)    { pluginHooks.onSessionEnd.push(fn) },
    },

    // Core lifecycle events: 'pre_compact' | 'session_stop' | 'after_tool_call'
    registerHook(event: string, handler: (payload?: Record<string, any>) => Promise<void> | void) {
      registerExternalHook(event, handler, pluginName)
    },

    log(...args: any[]) {
      console.log(`[Plugin:${pluginName}]`, ...args)
    },

    // Slash-command registry — register/unregister commands that appear in the
    // Tab-dropdown. See PluginServices JSDoc above for full usage.
    commandCatalog: services.commandCatalog ?? null,
  }
}

// ── Loader ────────────────────────────────────────────────────
export async function loadPlugins(pluginDir: string, services: PluginServices = {}): Promise<void> {
  if (!fs.existsSync(pluginDir)) {
    fs.mkdirSync(pluginDir, { recursive: true })
    return
  }

  const entries = fs.readdirSync(pluginDir).filter(f => {
    if (!f.endsWith('.js')) return false  // .js only
    if (f.startsWith('_')) return false   // skip _example.js etc.
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

      // Support both flat format (init) and legacy subdirectory format (onLoad)
      const initFn = def.init ?? def.onLoad ?? (def.default?.init) ?? (def.default?.onLoad)
      if (typeof initFn !== 'function') {
        console.warn(`[PluginLoader] ${file}: no init() — skipping`)
        continue
      }

      const ctx     = makeContext(name, services)
      const dispose = await initFn.call(def.default ?? def, ctx)

      loadedFlatPlugins.push({
        name,
        version,
        description: def.description || def.default?.description || '',
        author:      def.author      || def.default?.author      || '',
        file:        fullPath,
        loadedAt:    Date.now(),
        active:      true,
        dispose:     typeof dispose === 'function' ? dispose
                   : (def.dispose   ?? def.default?.onUnload ?? def.default?.dispose),
      })

      console.log(`[PluginLoader] Loaded: ${name} v${version} (${file})`)
    } catch (err: any) {
      console.error(`[PluginLoader] Failed to load ${file}:`, err.message)
    }
  }
}

// ── Reload — dispose old plugins then reload all flat plugins ─
export async function reloadPlugins(pluginDir: string, services: PluginServices = {}): Promise<void> {
  // Dispose in reverse order
  for (let i = loadedFlatPlugins.length - 1; i >= 0; i--) {
    const p = loadedFlatPlugins[i]
    if (p.dispose) {
      try { await p.dispose() } catch { /* ignore dispose errors */ }
    }
    p.active = false
  }
  loadedFlatPlugins.length = 0

  // Clear all hooks contributed by plugins
  pluginHooks.preTool.length        = 0
  pluginHooks.postTool.length       = 0
  pluginHooks.onSessionStart.length = 0
  pluginHooks.onSessionEnd.length   = 0

  await loadPlugins(pluginDir, services)
}

// ── Status ────────────────────────────────────────────────────
export function listFlatPlugins() {
  return loadedFlatPlugins.map(p => ({
    name:        p.name,
    version:     p.version,
    description: p.description,
    author:      p.author,
    file:        path.basename(p.file),
    loadedAt:    p.loadedAt,
    active:      p.active,
  }))
}
