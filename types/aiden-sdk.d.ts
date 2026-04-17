// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
//
// types/aiden-sdk.d.ts — TypeScript declarations for the Aiden
// SDK surface injected into /run sandbox scripts.
//
// Auto-generated from core/aidenSdk.ts TOOL_SDK_MAP.
// This file is for IDE support when authoring scripts/ files.
//
// Usage in scripts (no import needed — `aiden` is a global):
//   const results = await aiden.web.search("AI agents 2026")
//   await aiden.file.write("/tmp/out.md", results.join("\n"))

// ── Common return types ────────────────────────────────────────────────────────

export interface ShellResult {
  stdout:   string
  stderr:   string
  exitCode: number
}

export interface SearchResult {
  title:   string
  url:     string
  snippet: string
}

// ── aiden.web ─────────────────────────────────────────────────────────────────

export interface AidenWeb {
  /** Search the web. Returns an array of search result objects. */
  search(query: string): Promise<SearchResult[]>

  /** In-depth multi-source research on a topic. Returns a markdown report. */
  research(topic: string): Promise<string>

  /** Fetch raw content from a URL. */
  fetch(url: string): Promise<string>

  /** Full page content extraction (rendered HTML → text). */
  page(url: string): Promise<string>

  /** Social media research for a query. */
  social(query: string): Promise<any>

  /** Get transcript from a YouTube URL. */
  youtube(url: string): Promise<string>
}

// ── aiden.file ────────────────────────────────────────────────────────────────

export interface AidenFile {
  /** Read a file from the filesystem. */
  read(path: string): Promise<string>

  /** Write content to a file (creates or overwrites). */
  write(path: string, content: string): Promise<void>

  /** List directory contents. Returns array of file/dir names. */
  list(dir: string): Promise<string[]>
}

// ── aiden.shell ───────────────────────────────────────────────────────────────

export interface AidenShell {
  /** Execute a shell command. Returns stdout, stderr, exitCode. */
  exec(command: string): Promise<ShellResult>

  /** Execute Python code (runs via python interpreter). */
  python(script: string): Promise<string>

  /** Execute Node.js code (runs via node). */
  node(script: string): Promise<string>

  /** Execute PowerShell script. */
  powershell(script: string): Promise<string>

  /** Run a Windows cmd.exe command. Returns stdout, stderr, exitCode. */
  cmd(command: string, options?: Record<string, any>): Promise<ShellResult>

  /** Run a PowerShell command directly (no temp file). Returns stdout, stderr, exitCode. */
  ps(command: string, options?: Record<string, any>): Promise<ShellResult>

  /** Run a bash command inside WSL. Auto-translates C:\\ paths to /mnt/c/. Returns stdout, stderr, exitCode. */
  wsl(command: string, options?: Record<string, any>): Promise<ShellResult>
}

// ── aiden.browser ─────────────────────────────────────────────────────────────

export interface AidenBrowser {
  /** Open a URL in the system browser. */
  open(url: string): Promise<void>

  /** Click a CSS selector in the active browser page. */
  click(selector: string): Promise<void>

  /** Type text into a CSS selector element. */
  type(selector: string, text: string): Promise<void>

  /** Extract text content from a CSS selector (or full page if omitted). */
  extract(selector?: string): Promise<string>

  /** Take a browser screenshot. Returns base64 image. */
  screenshot(): Promise<string>
}

// ── aiden.screen ─────────────────────────────────────────────────────────────

export interface AidenScreen {
  /** Capture a desktop screenshot. Returns base64 image. */
  capture(): Promise<string>

  /** Move mouse to screen coordinates. */
  mouseMov(x: number, y: number): Promise<void>

  /** Click at screen coordinates. */
  mouseClick(x: number, y: number): Promise<void>

  /** Type text via the keyboard. */
  type(text: string): Promise<void>

  /** Press a key or key combination (e.g. "ctrl+c"). */
  press(key: string): Promise<void>

  /** Read text visible on the screen via OCR. */
  read(): Promise<string>

  /** Agentic vision-control loop: pursue a goal by watching the screen. */
  vision(goal: string, maxSteps?: number): Promise<string>
}

// ── aiden.memory ─────────────────────────────────────────────────────────────

export interface AidenMemory {
  /** Recall memories matching a query string. */
  recall(query: string): Promise<string>

  /** Store a fact in memory. */
  remember(fact: string): Promise<string>
}

// ── aiden.system ─────────────────────────────────────────────────────────────

export interface AidenSystem {
  /** Send a desktop notification. */
  notify(message: string, title?: string): Promise<void>

  /** Get system information (OS, CPU, RAM, uptime…). */
  info(): Promise<any>

  /** Read the system clipboard. */
  clipboardRead(): Promise<string>

  /** Write text to the system clipboard. */
  clipboardWrite(text: string): Promise<void>

  /** Wait for N milliseconds. */
  wait(ms: number): Promise<void>
}

// ── aiden.git ────────────────────────────────────────────────────────────────

export interface AidenGit {
  /** Git status and recent commits for a repo path (defaults to cwd). */
  status(path?: string): Promise<string>

  /** Stage all changes and commit with a message. */
  commit(message: string): Promise<string>

  /** Push to a remote branch. */
  push(remote?: string, branch?: string): Promise<string>
}

// ── aiden.data ───────────────────────────────────────────────────────────────

export interface AidenData {
  /** Real-time stock / market data for a ticker symbol. */
  market(symbol: string): Promise<any>

  /** Company profile and financial data. */
  company(symbol: string): Promise<any>

  /** Market movers — gainers, losers, actives. */
  stocks(market: string, type: string): Promise<any[]>

  /** Daily news and market briefing (markdown). */
  briefing(): Promise<string>

  /** Calendar events for the next N days. */
  calendar(daysAhead?: number): Promise<any[]>

  /** Read recent emails. */
  email(limit?: number): Promise<any[]>
}

// ── aiden.voice ──────────────────────────────────────────────────────────────

export interface SttResult {
  text:        string
  provider:    string
  durationMs:  number
  confidence?: number
  error?:      string
}

export interface TtsResult {
  provider:   string
  durationMs: number
  error?:     string
}

export interface AidenVoice {
  /**
   * Transcribe an audio file to text.
   * Tries Groq Whisper → OpenAI Whisper → local Whisper.cpp in order.
   * Returns SttResult — check result.error on failure.
   */
  transcribe(audioFilePath: string, language?: string): Promise<SttResult>

  /**
   * Synthesize text to speech and play it.
   * Tries Edge TTS → ElevenLabs → Windows SAPI in order.
   * Returns TtsResult — check result.error on failure.
   */
  synthesize(text: string, voice?: string): Promise<TtsResult>

  /**
   * Record audio from the default microphone.
   * @param durationSeconds  Recording length in seconds (default 5).
   * @param outputPath       Save path for the .wav file (optional).
   * @returns                Path to the recorded audio file.
   */
  record(durationSeconds?: number, outputPath?: string): Promise<string>

  /**
   * Play an audio file (wav / mp3 / ogg).
   * Accepts a file path string or raw audio Buffer.
   */
  play(audioSource: string): Promise<void>
}

// ── aiden.todo ───────────────────────────────────────────────────────────────

export interface AidenTodo {
  /** Add a new todo item. Returns a confirmation string with the assigned id. */
  add(text: string, priority?: 'low' | 'normal' | 'high'): Promise<string>

  /** Mark a todo item as done by its id. */
  complete(id: string): Promise<string>

  /** Remove a todo item by its id. */
  remove(id: string): Promise<string>

  /** List todo items. Filter: 'all' | 'pending' | 'done'. */
  list(filter?: 'all' | 'pending' | 'done'): Promise<string>

  /** Clear all todo items. Returns a count string. */
  clear(): Promise<string>
}

// ── aiden.cron ───────────────────────────────────────────────────────────────

export interface AidenCron {
  /**
   * Create a scheduled job.
   * @param description  Human-readable name.
   * @param schedule     Natural language: "every 5 minutes", "hourly", "daily".
   * @param action       Shell command to execute on each tick.
   */
  create(description: string, schedule: string, action: string): Promise<string>

  /** List all cron jobs with status, schedule, and run count. */
  list(): Promise<string>

  /** Pause a running job (stops timer until resumed). */
  pause(id: string): Promise<string>

  /** Resume a paused job. */
  resume(id: string): Promise<string>

  /** Permanently delete a cron job. */
  delete(id: string): Promise<string>

  /** Immediately execute a cron job outside its schedule. */
  trigger(id: string): Promise<string>
}

// ── aiden.vision ─────────────────────────────────────────────────────────────

export interface AidenVisionAnalyze {
  /**
   * Analyze an image using AI vision.
   * Accepts a local file path or an HTTP(S) URL.
   * Routes to Anthropic → OpenAI → Ollama llava in order.
   * Returns a description string prefixed with provider and timing.
   */
  analyze(imageSource: string, prompt?: string): Promise<string>
}

// ── aiden.mcp ────────────────────────────────────────────────────────────────

export interface McpToolInfo {
  name:         string   // prefixed: 'server:tool'
  description:  string
  inputSchema:  any
  serverName:   string
  originalName: string
}

export interface AidenMcp {
  /** List names of all connected MCP servers. */
  list(): string[]

  /** List all available MCP tools across all connected servers. */
  tools(): McpToolInfo[]

  /** Call an MCP tool by 'server:toolName'. Returns the raw MCP result. */
  call(toolName: string, args?: Record<string, any>): Promise<any>
}

// ── Top-level aiden object ────────────────────────────────────────────────────

export interface AidenSDK {
  web:     AidenWeb
  file:    AidenFile
  shell:   AidenShell
  browser: AidenBrowser
  screen:  AidenScreen
  memory:  AidenMemory
  system:  AidenSystem
  git:     AidenGit
  data:    AidenData
  mcp:     AidenMcp
  voice:   AidenVoice
  todo:    AidenTodo
  cron:    AidenCron
  vision:  AidenVisionAnalyze

  /**
   * Ask the user a clarification question mid-task.
   * In TUI mode shows the question and waits for input.
   * In headless mode returns the first option (or empty string) immediately.
   */
  clarify(question: string, options?: string[], allowFreeText?: boolean): Promise<string>

  /** Spawn a sub-agent to complete a task. Returns result string. */
  runAgent(task: string): Promise<string>
}

// ── Global declaration for /run scripts ──────────────────────────────────────
// When writing scripts in scripts/*.js, `aiden` is available as a global.

declare const aiden: AidenSDK
