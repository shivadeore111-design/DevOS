// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/pluginSystem.ts — Plugin system foundation.
// Allows community extensions without modifying core code.
// Scans workspace/plugins/*/plugin.json, loads entry files,
// and calls onLoad(ctx) with a sandboxed PluginContext.

import fs   from 'fs'
import path from 'path'
import { registerExternalTool } from './toolRegistry'
import { registerExternalHook }  from './hooks'

const PLUGINS_DIR = path.join(process.cwd(), 'workspace', 'plugins')

// ── Public interfaces ──────────────────────────────────────────

export interface ToolDefinition {
  name:        string
  description: string
  execute:     (input: Record<string, any>) => Promise<{ success: boolean; output: string }>
}

export interface PluginContext {
  registerTool(def: ToolDefinition): void
  registerHook(event: string, handler: (payload?: Record<string, any>) => Promise<void> | void): void
  log(msg: string): void
}

export interface AidenPlugin {
  onLoad(ctx: PluginContext):  Promise<void> | void
  onUnload?():                 Promise<void> | void
}

export interface PluginManifest {
  name:        string
  version:     string
  description: string
  entry:       string     // relative path to entry JS file within plugin directory
  author?:     string
}

// ── Internal record ────────────────────────────────────────────

interface PluginRecord {
  manifest: PluginManifest
  dir:      string
  active:   boolean
  plugin?:  AidenPlugin
}

// ── PluginManager ──────────────────────────────────────────────

class PluginManager {
  private loaded: PluginRecord[] = []

  // ── Load all plugins from workspace/plugins/ ───────────────

  async loadAll(): Promise<void> {
    if (!fs.existsSync(PLUGINS_DIR)) {
      console.log('[Plugins] No plugins directory found — skipping')
      return
    }

    const dirs = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => path.join(PLUGINS_DIR, d.name))

    for (const dir of dirs) {
      try {
        await this.loadPlugin(dir)
      } catch (e: any) {
        console.error(`[Plugins] Failed to load plugin at ${path.basename(dir)}:`, e.message)
      }
    }

    console.log(`[Plugins] ${this.loaded.length} plugin(s) active`)
  }

  // ── Load a single plugin directory ────────────────────────

  async loadPlugin(dir: string): Promise<void> {
    const manifestPath = path.join(dir, 'plugin.json')
    if (!fs.existsSync(manifestPath)) {
      console.warn(`[Plugins] No plugin.json in ${path.basename(dir)} — skipping`)
      return
    }

    let manifest: PluginManifest
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as PluginManifest
    } catch (e: any) {
      throw new Error(`Invalid plugin.json: ${e.message}`)
    }

    if (!manifest.name || !manifest.version || !manifest.entry) {
      throw new Error('plugin.json missing required fields: name, version, entry')
    }

    // ── Security: entry must not escape plugin directory ───────
    const entryPath    = path.resolve(dir, manifest.entry)
    const resolvedBase = path.resolve(dir)
    if (!entryPath.startsWith(resolvedBase + path.sep) && entryPath !== resolvedBase) {
      throw new Error(`Security: entry path escapes plugin directory: ${manifest.entry}`)
    }
    if (!fs.existsSync(entryPath)) {
      throw new Error(`Entry file not found: ${manifest.entry}`)
    }

    // ── Load the plugin module ─────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(entryPath) as AidenPlugin | { default: AidenPlugin }
    const plugin: AidenPlugin = (mod as any).default ?? (mod as AidenPlugin)

    if (typeof plugin?.onLoad !== 'function') {
      throw new Error(`Plugin "${manifest.name}" must export an object with an onLoad() function`)
    }

    // ── Build sandboxed context ────────────────────────────────
    const ctx: PluginContext = {
      registerTool: (def: ToolDefinition) => {
        registerExternalTool(def.name, def.execute, manifest.name)
      },
      registerHook: (event: string, handler) => {
        registerExternalHook(event, handler, manifest.name)
      },
      log: (msg: string) => {
        console.log(`[Plugin:${manifest.name}] ${msg}`)
      },
    }

    await plugin.onLoad(ctx)

    this.loaded.push({ manifest, dir, active: true, plugin })
    console.log(`[Plugins] Loaded "${manifest.name}" v${manifest.version}${manifest.author ? ` by ${manifest.author}` : ''}`)
  }

  // ── List loaded plugins ────────────────────────────────────

  list(): Array<{
    name:        string
    version:     string
    description: string
    author?:     string
    active:      boolean
  }> {
    return this.loaded.map(r => ({
      name:        r.manifest.name,
      version:     r.manifest.version,
      description: r.manifest.description,
      author:      r.manifest.author,
      active:      r.active,
    }))
  }

  // ── Unload all plugins ─────────────────────────────────────

  async unloadAll(): Promise<void> {
    for (const record of this.loaded) {
      try {
        if (record.plugin?.onUnload) {
          await record.plugin.onUnload()
        }
        record.active = false
      } catch (e: any) {
        console.error(`[Plugins] onUnload error for "${record.manifest.name}":`, e.message)
      }
    }
    console.log(`[Plugins] Unloaded ${this.loaded.length} plugin(s)`)
    this.loaded = []
  }
}

// ── Singleton ──────────────────────────────────────────────────

export const pluginManager = new PluginManager()
