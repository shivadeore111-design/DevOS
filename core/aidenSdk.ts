// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/aidenSdk.ts — Generates the Aiden SDK surface injected into
// the run-sandbox. Each registered tool becomes a typed function on
// the `aiden` namespace object. The LLM writes code against this
// surface instead of raw tool names.
//
// Namespace mapping:
//   aiden.web.*     → web_search, deep_research, fetch_url, fetch_page, social_research
//   aiden.file.*    → file_read, file_write, file_list
//   aiden.shell.*   → shell_exec, run_python, run_node, run_powershell
//   aiden.browser.* → open_browser, browser_click, browser_type, browser_extract, browser_screenshot
//   aiden.screen.*  → screenshot, mouse_move, mouse_click, keyboard_type, keyboard_press, screen_read
//   aiden.memory.*  → recall (memory_show), remember (via conversationMemory)
//   aiden.lessons.* → check (lessons)
//   aiden.system.*  → notify, system_info, clipboard_read, clipboard_write
//   aiden.git.*     → git_status, git_commit, git_push
//   aiden.data.*    → get_market_data, get_company_info, get_stocks, get_briefing, get_calendar
//   aiden.*         → top-level: run_agent, respond

import { executeTool, TOOLS } from './toolRegistry'
import { listMcpServers, listMcpTools, callMcpTool } from './mcpClient'

// ── SDK namespace map ─────────────────────────────────────────────────────────

export interface SdkMethod {
  namespace:   string
  method:      string
  toolName:    string
  description: string
  signature:   string    // human-readable TypeScript sig
}

const TOOL_SDK_MAP: Array<{
  toolName:    string
  namespace:   string
  method:      string
  description: string
  signature:   string
}> = [
  // web
  { toolName: 'web_search',       namespace: 'web',     method: 'search',       description: 'Search the web',                 signature: '(query: string) => Promise<any[]>'                       },
  { toolName: 'deep_research',    namespace: 'web',     method: 'research',     description: 'In-depth research on a topic',   signature: '(topic: string) => Promise<string>'                      },
  { toolName: 'fetch_url',        namespace: 'web',     method: 'fetch',        description: 'Fetch URL content',              signature: '(url: string) => Promise<string>'                        },
  { toolName: 'fetch_page',       namespace: 'web',     method: 'page',         description: 'Full page content extraction',   signature: '(url: string) => Promise<string>'                        },
  { toolName: 'social_research',  namespace: 'web',     method: 'social',       description: 'Social media research',         signature: '(query: string) => Promise<any>'                         },
  { toolName: 'ingest_youtube',   namespace: 'web',     method: 'youtube',      description: 'Get YouTube transcript',         signature: '(url: string) => Promise<string>'                        },

  // file
  { toolName: 'file_read',        namespace: 'file',    method: 'read',         description: 'Read a file',                    signature: '(path: string) => Promise<string>'                       },
  { toolName: 'file_write',       namespace: 'file',    method: 'write',        description: 'Write a file',                   signature: '(path: string, content: string) => Promise<void>'        },
  { toolName: 'file_list',        namespace: 'file',    method: 'list',         description: 'List directory contents',        signature: '(dir: string) => Promise<string[]>'                      },

  // shell
  { toolName: 'shell_exec',       namespace: 'shell',   method: 'exec',         description: 'Run a shell command',            signature: '(command: string) => Promise<{stdout:string,stderr:string,exitCode:number}>' },
  { toolName: 'run_python',       namespace: 'shell',   method: 'python',       description: 'Execute Python code',            signature: '(script: string) => Promise<string>'                     },
  { toolName: 'run_node',         namespace: 'shell',   method: 'node',         description: 'Execute Node.js code',           signature: '(script: string) => Promise<string>'                     },
  { toolName: 'run_powershell',   namespace: 'shell',   method: 'powershell',   description: 'Execute PowerShell',             signature: '(script: string) => Promise<string>'                     },
  { toolName: 'cmd',              namespace: 'shell',   method: 'cmd',          description: 'Run cmd.exe command',            signature: '(command: string, options?: any) => Promise<{stdout:string,stderr:string,exitCode:number}>' },
  { toolName: 'ps',               namespace: 'shell',   method: 'ps',           description: 'Run PowerShell directly',        signature: '(command: string, options?: any) => Promise<{stdout:string,stderr:string,exitCode:number}>' },
  { toolName: 'wsl',              namespace: 'shell',   method: 'wsl',          description: 'Run bash command in WSL',        signature: '(command: string, options?: any) => Promise<{stdout:string,stderr:string,exitCode:number}>' },

  // browser
  { toolName: 'open_browser',     namespace: 'browser', method: 'open',         description: 'Open a URL in the browser',      signature: '(url: string) => Promise<void>'                          },
  { toolName: 'browser_click',    namespace: 'browser', method: 'click',        description: 'Click an element',               signature: '(selector: string) => Promise<void>'                     },
  { toolName: 'browser_type',     namespace: 'browser', method: 'type',         description: 'Type text into an element',      signature: '(selector: string, text: string) => Promise<void>'       },
  { toolName: 'browser_extract',  namespace: 'browser', method: 'extract',      description: 'Extract content from page',      signature: '(selector?: string) => Promise<string>'                  },
  { toolName: 'browser_screenshot', namespace: 'browser', method: 'screenshot', description: 'Take a browser screenshot',     signature: '() => Promise<string>'                                   },

  // screen
  { toolName: 'screenshot',       namespace: 'screen',  method: 'capture',      description: 'Capture desktop screenshot',     signature: '() => Promise<string>'                                   },
  { toolName: 'mouse_move',       namespace: 'screen',  method: 'mouseMov',     description: 'Move mouse to coordinates',      signature: '(x: number, y: number) => Promise<void>'                 },
  { toolName: 'mouse_click',      namespace: 'screen',  method: 'mouseClick',   description: 'Click at coordinates',           signature: '(x: number, y: number) => Promise<void>'                 },
  { toolName: 'keyboard_type',    namespace: 'screen',  method: 'type',         description: 'Type text via keyboard',         signature: '(text: string) => Promise<void>'                         },
  { toolName: 'keyboard_press',   namespace: 'screen',  method: 'press',        description: 'Press a key combination',        signature: '(key: string) => Promise<void>'                          },
  { toolName: 'screen_read',      namespace: 'screen',  method: 'read',         description: 'Read text from screen',          signature: '() => Promise<string>'                                   },
  { toolName: 'vision_loop',      namespace: 'screen',  method: 'vision',       description: 'Agentic vision control loop',    signature: '(goal: string, maxSteps?: number) => Promise<string>'    },

  // memory
  { toolName: 'memory_show',      namespace: 'memory',  method: 'recall',       description: 'Recall from memory',             signature: '(query: string) => Promise<string>'                      },

  // system
  { toolName: 'notify',           namespace: 'system',  method: 'notify',       description: 'Send a system notification',     signature: '(message: string, title?: string) => Promise<void>'      },
  { toolName: 'system_info',      namespace: 'system',  method: 'info',         description: 'Get system information',         signature: '() => Promise<any>'                                      },
  { toolName: 'clipboard_read',   namespace: 'system',  method: 'clipboardRead', description: 'Read clipboard content',        signature: '() => Promise<string>'                                   },
  { toolName: 'clipboard_write',  namespace: 'system',  method: 'clipboardWrite', description: 'Write to clipboard',           signature: '(text: string) => Promise<void>'                         },
  { toolName: 'wait',             namespace: 'system',  method: 'wait',         description: 'Wait for N milliseconds',        signature: '(ms: number) => Promise<void>'                           },

  // git
  { toolName: 'git_status',       namespace: 'git',     method: 'status',       description: 'Git status and recent commits',  signature: '(path?: string) => Promise<string>'                      },
  { toolName: 'git_commit',       namespace: 'git',     method: 'commit',       description: 'Stage all and commit',           signature: '(message: string) => Promise<string>'                    },
  { toolName: 'git_push',         namespace: 'git',     method: 'push',         description: 'Push to remote',                 signature: '(remote?: string, branch?: string) => Promise<string>'   },

  // data
  { toolName: 'get_market_data',  namespace: 'data',    method: 'market',       description: 'Real-time stock/market data',    signature: '(symbol: string) => Promise<any>'                        },
  { toolName: 'get_company_info', namespace: 'data',    method: 'company',      description: 'Company profile and financials', signature: '(symbol: string) => Promise<any>'                        },
  { toolName: 'get_stocks',       namespace: 'data',    method: 'stocks',       description: 'Market movers (gainers/losers)', signature: '(market: string, type: string) => Promise<any[]>'        },
  { toolName: 'get_briefing',     namespace: 'data',    method: 'briefing',     description: 'Daily news and market briefing', signature: '() => Promise<string>'                                   },
  { toolName: 'get_calendar',     namespace: 'data',    method: 'calendar',     description: 'Calendar events',               signature: '(daysAhead?: number) => Promise<any[]>'                   },
  { toolName: 'read_email',       namespace: 'data',    method: 'email',        description: 'Read recent emails',             signature: '(limit?: number) => Promise<any[]>'                      },

  // voice
  { toolName: 'voice_speak',      namespace: 'voice',   method: 'speak',        description: 'Speak text via TTS provider chain',   signature: '(text: string, opts?: {voice?:string,provider?:string,rate?:number,volume?:number}) => Promise<{provider:string,durationMs:number}>'  },
  { toolName: 'voice_transcribe', namespace: 'voice',   method: 'transcribe',   description: 'Transcribe audio file to text',        signature: '(audioFilePath: string, language?: string) => Promise<{text:string,provider:string,durationMs:number}>'                              },
  { toolName: 'voice_clone',      namespace: 'voice',   method: 'clone',        description: 'Clone a voice and speak text',         signature: '(text: string, referenceAudioPath: string) => Promise<{provider:string,durationMs:number}>'                                          },
  { toolName: 'voice_design',     namespace: 'voice',   method: 'design',       description: 'Design a voice from description',      signature: '(text: string, voiceDescription: string) => Promise<{provider:string,durationMs:number}>'                                            },
  { toolName: 'voice_record',     namespace: 'voice',   method: 'record',       description: 'Record audio from microphone',         signature: '(durationSeconds?: number, outputPath?: string) => Promise<string>'                                                                   },
  { toolName: 'voice_play',       namespace: 'voice',   method: 'play',         description: 'Play an audio file',                   signature: '(audioSource: string) => Promise<void>'                                                                                               },

  // todo
  { toolName: 'todo',             namespace: 'todo',    method: 'add',          description: 'Add a todo item',                signature: '(text: string, priority?: string) => Promise<string>'    },
  { toolName: 'todo',             namespace: 'todo',    method: 'complete',     description: 'Mark a todo item done',          signature: '(id: string) => Promise<string>'                         },
  { toolName: 'todo',             namespace: 'todo',    method: 'remove',       description: 'Remove a todo item',             signature: '(id: string) => Promise<string>'                         },
  { toolName: 'todo',             namespace: 'todo',    method: 'list',         description: 'List todo items',                signature: '(filter?: string) => Promise<string>'                    },
  { toolName: 'todo',             namespace: 'todo',    method: 'clear',        description: 'Clear all todos',                signature: '() => Promise<string>'                                   },

  // cron
  { toolName: 'cronjob',          namespace: 'cron',    method: 'create',       description: 'Create a scheduled job',         signature: '(description: string, schedule: string, action: string) => Promise<string>' },
  { toolName: 'cronjob',          namespace: 'cron',    method: 'list',         description: 'List all cron jobs',             signature: '() => Promise<string>'                                   },
  { toolName: 'cronjob',          namespace: 'cron',    method: 'pause',        description: 'Pause a cron job',               signature: '(id: string) => Promise<string>'                         },
  { toolName: 'cronjob',          namespace: 'cron',    method: 'resume',       description: 'Resume a paused cron job',       signature: '(id: string) => Promise<string>'                         },
  { toolName: 'cronjob',          namespace: 'cron',    method: 'delete',       description: 'Delete a cron job',              signature: '(id: string) => Promise<string>'                         },
  { toolName: 'cronjob',          namespace: 'cron',    method: 'trigger',      description: 'Immediately run a cron job',     signature: '(id: string) => Promise<string>'                         },

  // vision
  { toolName: 'vision_analyze',   namespace: 'vision',  method: 'analyze',      description: 'Analyze an image with AI',       signature: '(imageSource: string, prompt?: string) => Promise<string>' },

  // top-level
  { toolName: 'run_agent',        namespace: '',        method: 'runAgent',     description: 'Spawn a sub-agent',              signature: '(task: string) => Promise<string>'                       },
]

/** Returns all SDK method definitions. */
export function getSdkMethods(): SdkMethod[] {
  return TOOL_SDK_MAP.map(e => ({
    namespace:   e.namespace,
    method:      e.method,
    toolName:    e.toolName,
    description: e.description,
    signature:   e.signature,
  }))
}

/** Returns namespaces present in the SDK (sorted). */
export function getSdkNamespaces(): string[] {
  const ns = new Set(TOOL_SDK_MAP.filter(e => e.namespace).map(e => e.namespace))
  return Array.from(ns).sort()
}

// ── SDK surface builder ───────────────────────────────────────────────────────

/**
 * Builds the runtime SDK object that is injected into the run sandbox.
 * Returns a plain object tree matching `aiden.web.search(...)` etc.
 *
 * Each method:
 *   1. Validates the tool exists in TOOLS
 *   2. Calls executeTool with the appropriate input shape
 *   3. Returns the output value (parsed JSON if possible)
 */
export function buildSdkRuntime(
  onToolCall: (toolName: string, args: any) => void,
): Record<string, any> {
  /** Wraps a tool name into a callable that tracks usage. */
  function makeMethod(toolName: string, inputMapper: (...a: any[]) => Record<string, any>) {
    return async (...args: any[]) => {
      const input = inputMapper(...args)
      onToolCall(toolName, input)
      const result = await executeTool(toolName, input, 0, 30000)
      if (!result.success) throw new Error(`${toolName} failed: ${result.error ?? result.output}`)
      // Try to parse JSON output for structured data
      try { return JSON.parse(result.output) } catch { return result.output }
    }
  }

  const sdk: Record<string, any> = {
    web: {
      search:    makeMethod('web_search',      (q: string)       => ({ query: q })),
      research:  makeMethod('deep_research',   (t: string)       => ({ topic: t })),
      fetch:     makeMethod('fetch_url',       (u: string)       => ({ url: u })),
      page:      makeMethod('fetch_page',      (u: string)       => ({ url: u })),
      social:    makeMethod('social_research', (q: string)       => ({ query: q })),
      youtube:   makeMethod('ingest_youtube',  (u: string)       => ({ url: u })),
    },
    file: {
      read:      makeMethod('file_read',       (p: string)               => ({ path: p })),
      write:     makeMethod('file_write',      (p: string, c: string)    => ({ path: p, content: c })),
      list:      makeMethod('file_list',       (d: string)               => ({ path: d })),
    },
    shell: {
      exec:      makeMethod('shell_exec',      (cmd: string)             => ({ command: cmd })),
      python:    makeMethod('run_python',      (s: string)               => ({ script: s })),
      node:      makeMethod('run_node',        (s: string)               => ({ script: s })),
      powershell: makeMethod('run_powershell', (s: string)               => ({ script: s })),
      cmd:       makeMethod('cmd',             (cmd: string, opts?: any) => ({ command: cmd, ...opts })),
      ps:        makeMethod('ps',              (cmd: string, opts?: any) => ({ command: cmd, ...opts })),
      wsl:       makeMethod('wsl',             (cmd: string, opts?: any) => ({ command: cmd, ...opts })),
    },
    browser: {
      open:       makeMethod('open_browser',       (u: string)             => ({ url: u })),
      click:      makeMethod('browser_click',      (sel: string)           => ({ selector: sel })),
      type:       makeMethod('browser_type',       (sel: string, t: string)=> ({ selector: sel, text: t })),
      extract:    makeMethod('browser_extract',    (sel?: string)          => ({ selector: sel ?? '' })),
      screenshot: makeMethod('browser_screenshot', ()                      => ({})),
    },
    screen: {
      capture:    makeMethod('screenshot',      ()                          => ({})),
      mouseMov:   makeMethod('mouse_move',      (x: number, y: number)     => ({ x, y })),
      mouseClick: makeMethod('mouse_click',     (x: number, y: number)     => ({ x, y })),
      type:       makeMethod('keyboard_type',   (text: string)             => ({ text })),
      press:      makeMethod('keyboard_press',  (key: string)              => ({ key })),
      read:       makeMethod('screen_read',     ()                          => ({})),
      vision:     makeMethod('vision_loop',     (goal: string, maxSteps = 10) => ({ goal, max_steps: maxSteps })),
    },
    memory: {
      recall:    makeMethod('memory_show',      (q: string)               => ({ query: q })),
      remember:  makeMethod('memory_show',      (fact: string)            => ({ query: fact, mode: 'store' })),
    },
    lessons: {
      check:     makeMethod('lessons',          (q?: string)              => ({ query: q ?? '' })),
    },
    system: {
      notify:         makeMethod('notify',         (msg: string, title?: string) => ({ message: msg, title: title ?? 'Aiden' })),
      info:           makeMethod('system_info',    ()                              => ({})),
      clipboardRead:  makeMethod('clipboard_read', ()                              => ({})),
      clipboardWrite: makeMethod('clipboard_write',(text: string)                 => ({ text })),
      wait:           makeMethod('wait',           (ms: number)                   => ({ ms })),
    },
    git: {
      status: makeMethod('git_status',  (p?: string)                      => ({ path: p ?? process.cwd() })),
      commit: makeMethod('git_commit',  (msg: string)                     => ({ message: msg })),
      push:   makeMethod('git_push',    (remote = 'origin', branch = 'master') => ({ remote, branch })),
    },
    data: {
      market:   makeMethod('get_market_data',   (sym: string)               => ({ symbol: sym })),
      company:  makeMethod('get_company_info',  (sym: string)               => ({ symbol: sym })),
      stocks:   makeMethod('get_stocks',        (mkt: string, type: string) => ({ market: mkt, type })),
      briefing: makeMethod('get_briefing',      ()                           => ({})),
      calendar: makeMethod('get_calendar',      (daysAhead = 7)             => ({ days_ahead: daysAhead })),
      email:    makeMethod('read_email',        (limit = 10)                => ({ limit })),
    },
    // voice
    voice: {
      speak: async (text: string, opts: { voice?: string; provider?: string; rate?: number; volume?: number } = {}) => {
        onToolCall('voice_speak', { text, ...opts })
        const { synthesize } = await import('./voice/tts')
        return synthesize({ text, voice: opts.voice, provider: opts.provider as any, rate: opts.rate, volume: opts.volume })
      },
      transcribe: async (audioFilePath: string, language?: string) => {
        onToolCall('voice_transcribe', { audioFilePath, language })
        const { transcribe } = await import('./voice/stt')
        return transcribe({ audioFilePath, language })
      },
      clone: async (text: string, referenceAudioPath: string) => {
        onToolCall('voice_clone', { text, referenceAudioPath })
        const { synthesize } = await import('./voice/tts')
        return synthesize({ text, referenceAudioPath, provider: 'voxcpm' } as any)
      },
      design: async (text: string, voiceDescription: string) => {
        onToolCall('voice_design', { text, voiceDescription })
        const { synthesize } = await import('./voice/tts')
        return synthesize({ text, voiceDesignPrompt: voiceDescription, provider: 'voxcpm' } as any)
      },
      reset: async () => {
        // No-op in SDK context — state reset is a CLI concern
        return { provider: 'none', durationMs: 0, note: 'voice reset (use /voice reset in CLI)' }
      },
      providers: async () => {
        const { getTtsProviders } = await import('./voice/tts')
        return getTtsProviders()
      },
      record: async (durationSeconds?: number, outputPath?: string) => {
        onToolCall('voice_record', { durationSeconds, outputPath })
        const { recordAudio } = await import('./voice/audio')
        return recordAudio(durationSeconds, outputPath)
      },
      play: async (audioSource: string) => {
        onToolCall('voice_play', { audioSource })
        const { playAudio } = await import('./voice/audio')
        return playAudio(audioSource)
      },
    },

    // MCP namespace — direct access to connected MCP servers
    mcp: {
      /** List names of all connected MCP servers. */
      list:  () => listMcpServers(),
      /** List all MCP tools (across all servers). */
      tools: () => listMcpTools(),
      /** Call an MCP tool by 'server:toolName' and args object. */
      call:  (toolName: string, args: Record<string, any> = {}) => {
        onToolCall(`mcp:${toolName}`, args)
        return callMcpTool(toolName, args)
      },
    },

    // todo
    todo: {
      add:      makeMethod('todo', (text: string, priority?: string) => ({ op: 'add',      text, priority: priority ?? 'normal' })),
      complete: makeMethod('todo', (id: string)                      => ({ op: 'complete', id })),
      remove:   makeMethod('todo', (id: string)                      => ({ op: 'remove',   id })),
      list:     makeMethod('todo', (filter?: string)                 => ({ op: 'list',     filter: filter ?? 'all' })),
      clear:    makeMethod('todo', ()                                => ({ op: 'clear' })),
    },

    // cron
    cron: {
      create:  makeMethod('cronjob', (description: string, schedule: string, action: string) => ({ op: 'create', description, schedule, action })),
      list:    makeMethod('cronjob', ()                                                        => ({ op: 'list' })),
      pause:   makeMethod('cronjob', (id: string)                                              => ({ op: 'pause',   id })),
      resume:  makeMethod('cronjob', (id: string)                                              => ({ op: 'resume',  id })),
      delete:  makeMethod('cronjob', (id: string)                                              => ({ op: 'delete',  id })),
      trigger: makeMethod('cronjob', (id: string)                                              => ({ op: 'trigger', id })),
    },

    // vision
    vision: {
      analyze: makeMethod('vision_analyze', (imageSource: string, prompt?: string) => ({ image: imageSource, prompt })),
    },

    // Top-level clarify — ask the user a question mid-task
    clarify: async (question: string, options?: string[], allowFreeText = true) => {
      onToolCall('clarify', { question, options, allow_free_text: allowFreeText })
      const result = await executeTool('clarify', { question, options, allow_free_text: allowFreeText }, 0, 300_000)
      if (!result.success) throw new Error(`clarify failed: ${result.error ?? result.output}`)
      return result.output
    },

    // Top-level convenience
    runAgent:  makeMethod('run_agent', (task: string) => ({ task })),
  }

  return sdk
}

// ── Prose SDK surface (for /run help display) ─────────────────────────────────

/**
 * Generates a human-readable string describing the full SDK surface.
 * Used by /run help and the LLM system prompt hint.
 */
export function buildSdkSurface(): string {
  const grouped: Record<string, SdkMethod[]> = {}
  for (const m of TOOL_SDK_MAP) {
    const key = m.namespace || '_top'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(m as SdkMethod)
  }

  const lines: string[] = [
    '// Aiden SDK — auto-generated from tool registry',
    '// Use `aiden.<namespace>.<method>(...)` in /run scripts',
    '',
  ]

  const sortedNs = Object.keys(grouped).sort((a, b) => {
    if (a === '_top') return 1
    if (b === '_top') return -1
    return a.localeCompare(b)
  })

  for (const ns of sortedNs) {
    const label = ns === '_top' ? 'aiden (top-level)' : `aiden.${ns}`
    lines.push(`// ── ${label} ${'─'.repeat(Math.max(0, 50 - label.length - 6))}`)
    for (const m of grouped[ns]) {
      const call = ns === '_top'
        ? `aiden.${m.method}${m.signature.startsWith('(') ? m.signature.split('=>')[0].trim() : '(...)'}`
        : `aiden.${ns}.${m.method}${m.signature.startsWith('(') ? m.signature.split('=>')[0].trim() : '(...)'}`
      lines.push(`  ${call.padEnd(60)} // ${m.description}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}
