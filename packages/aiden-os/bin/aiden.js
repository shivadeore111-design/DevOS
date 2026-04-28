#!/usr/bin/env node
// ============================================================
// packages/aiden-os/bin/aiden.js
// npx aiden-os  /  npm i -g aiden-os && aiden
//
// Bootstraps DevOS in a single Node.js process:
//   1. First-run wizard (provider + API key + optional Ollama check)
//   2. Starts the DevOS API server in-process (no child_process.spawn)
//   3. Starts the DevOS CLI REPL in the same process
// ============================================================
'use strict'

const fs      = require('fs')
const path    = require('path')
const os      = require('os')
const readline = require('readline')
const { execSync } = require('child_process')

// ── Platform paths ──────────────────────────────────────────────────────────
function getAppDir() {
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
    return path.join(local, 'aiden', 'app')
  }
  return path.join(os.homedir(), '.aiden', 'app')
}

const APP_DIR    = getAppDir()
const ENV_FILE   = path.join(APP_DIR, '.env')
const WIZARD_FLAG = path.join(APP_DIR, '.wizard-done')
const PORT       = parseInt(process.env.AIDEN_PORT || '4200', 10)

// ── Simple logger ────────────────────────────────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  cyan:   '\x1b[36m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  blue:   '\x1b[34m',
}
const log = {
  info:    (...a) => console.log(`${c.cyan}ℹ${c.reset}`, ...a),
  success: (...a) => console.log(`${c.green}✓${c.reset}`, ...a),
  warn:    (...a) => console.log(`${c.yellow}⚠${c.reset}`, ...a),
  error:   (...a) => console.error(`${c.red}✗${c.reset}`, ...a),
  step:    (n, label) => console.log(`\n${c.bold}${c.blue}[${n}]${c.reset} ${c.bold}${label}${c.reset}`),
  header:  (...a) => console.log(`\n${c.bold}${c.cyan}${a.join(' ')}${c.reset}`),
}

// ── Readline helper ──────────────────────────────────────────────────────────
function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve))
}

function askSecret(question) {
  return new Promise(resolve => {
    const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    process.stdout.write(question)
    let answer = ''
    if (process.stdin.isTTY) {
      // Suppress echo
      process.stdin.setRawMode(true)
      process.stdin.resume()
      process.stdin.setEncoding('utf8')
      const onData = (ch) => {
        if (ch === '\n' || ch === '\r' || ch === '') {
          if (ch === '') { process.stdout.write('\n'); process.exit(1) }
          process.stdin.setRawMode(false)
          process.stdin.removeListener('data', onData)
          rl2.close()
          process.stdout.write('\n')
          resolve(answer)
        } else if (ch === '') {
          answer = answer.slice(0, -1)
        } else {
          answer += ch
        }
      }
      process.stdin.on('data', onData)
    } else {
      rl2.question('', ans => { rl2.close(); resolve(ans.trim()) })
    }
  })
}

// ── Load existing .env into process.env ─────────────────────────────────────
function loadEnv() {
  if (!fs.existsSync(ENV_FILE)) return
  const lines = fs.readFileSync(ENV_FILE, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}

// ── Write / merge .env ───────────────────────────────────────────────────────
function writeEnvKey(key, value) {
  let content = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : ''
  const lines = content.split('\n')
  const idx   = lines.findIndex(l => l.startsWith(key + '='))
  const entry = `${key}=${value}`
  if (idx === -1) {
    content = content.trimEnd() + (content ? '\n' : '') + entry + '\n'
  } else {
    lines[idx] = entry
    content = lines.join('\n')
  }
  fs.mkdirSync(path.dirname(ENV_FILE), { recursive: true })
  fs.writeFileSync(ENV_FILE, content, 'utf8')
}

// ── Provider catalogue ───────────────────────────────────────────────────────
const PROVIDERS = [
  {
    id:       'groq',
    label:    'Groq  (fast, free tier available — https://console.groq.com/keys)',
    envKey:   'GROQ_API_KEY',
    prefix:   'gsk_',
    validate: async (key) => {
      const r = await safeFetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      })
      return r && r.ok
    },
  },
  {
    id:       'openrouter',
    label:    'OpenRouter  (200+ models — https://openrouter.ai/keys)',
    envKey:   'OPENROUTER_API_KEY',
    prefix:   'sk-or-',
    validate: async (key) => {
      const r = await safeFetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      })
      return r && r.ok
    },
  },
  {
    id:       'anthropic',
    label:    'Anthropic / Claude  (https://console.anthropic.com/api-keys)',
    envKey:   'ANTHROPIC_API_KEY',
    prefix:   'sk-ant-',
    validate: async (key) => {
      const r = await safeFetch('https://api.anthropic.com/v1/models', {
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      })
      return r && r.ok
    },
  },
  {
    id:       'openai',
    label:    'OpenAI / GPT  (https://platform.openai.com/api-keys)',
    envKey:   'OPENAI_API_KEY',
    prefix:   'sk-',
    validate: async (key) => {
      const r = await safeFetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      })
      return r && r.ok
    },
  },
  {
    id:    'ollama',
    label: 'Ollama only  (100% offline — must be running locally)',
    envKey: null,
    validate: async () => {
      const r = await safeFetch('http://127.0.0.1:11434/api/tags')
      return r && r.ok
    },
  },
]

async function safeFetch(url, opts = {}) {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const r = await fetch(url, { ...opts, signal: controller.signal })
    clearTimeout(timer)
    return r
  } catch {
    return null
  }
}

// ── Ollama check ─────────────────────────────────────────────────────────────
async function checkOllama() {
  const r = await safeFetch('http://127.0.0.1:11434/api/tags')
  if (!r || !r.ok) return null
  const json = await r.json().catch(() => ({}))
  return Array.isArray(json.models) ? json.models : []
}

// ── First-run wizard ─────────────────────────────────────────────────────────
async function runWizard() {
  log.header('  Welcome to Aiden — DevOS Setup Wizard  ')
  console.log(`${c.dim}  This runs once. Settings saved to: ${ENV_FILE}${c.reset}\n`)

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })

  // ── Step 1: Choose provider ─────────────────────────────────────────────
  log.step(1, 'Choose your AI provider')
  console.log()
  PROVIDERS.forEach((p, i) => console.log(`  ${c.bold}${i + 1})${c.reset} ${p.label}`))
  console.log()

  let providerIdx = -1
  while (providerIdx < 0 || providerIdx >= PROVIDERS.length) {
    const ans = await ask(rl, `  Enter number [1–${PROVIDERS.length}]: `)
    providerIdx = parseInt(ans.trim(), 10) - 1
    if (isNaN(providerIdx) || providerIdx < 0 || providerIdx >= PROVIDERS.length) {
      log.warn('Invalid choice — try again.')
      providerIdx = -1
    }
  }
  const provider = PROVIDERS[providerIdx]
  log.success(`Selected: ${provider.label.split('(')[0].trim()}`)

  // ── Step 2: API key (skip for Ollama) ─────────────────────────────────
  if (provider.envKey) {
    log.step(2, `Enter your ${provider.id.toUpperCase()} API key`)
    console.log(`  ${c.dim}(input hidden — paste and press Enter)${c.reset}`)

    let apiKey = ''
    let valid  = false
    let attempts = 0

    while (!valid && attempts < 3) {
      rl.close()
      apiKey = await askSecret('  API key: ')
      apiKey = apiKey.trim()

      if (!apiKey) {
        log.warn('No key entered. Try again.')
        attempts++
        // Re-open rl for potential retries via the readline flow
        continue
      }

      process.stdout.write('  Validating key…')
      valid = await provider.validate(apiKey)
      if (valid) {
        process.stdout.write(` ${c.green}✓ valid${c.reset}\n`)
        writeEnvKey(provider.envKey, apiKey)
        process.env[provider.envKey] = apiKey
        log.success(`${provider.envKey} saved to ${ENV_FILE}`)
      } else {
        process.stdout.write(` ${c.red}✗ rejected${c.reset}\n`)
        log.warn('Key was rejected by the provider. Check it and try again.')
        attempts++
      }
    }

    if (!valid) {
      rl.close()
      log.error('Could not validate API key after 3 attempts.')
      log.info('You can add it manually to: ' + ENV_FILE)
      log.info('Then re-run: npx aiden-os')
      process.exit(1)
    }

    // Reopen rl for step 3 continuation
    const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    await continueWizard(rl2, provider)
    rl2.close()
  } else {
    // Ollama branch
    log.step(2, 'Checking Ollama…')
    const models = await checkOllama()
    if (!models) {
      log.warn('Ollama is not running or not installed.')
      console.log(`\n  ${c.dim}Install from: https://ollama.com${c.reset}`)
      console.log(`  ${c.dim}Then run: ollama pull qwen2.5:7b${c.reset}\n`)
      const cont = await ask(rl, '  Continue anyway? (y/N): ')
      if (cont.trim().toLowerCase() !== 'y') {
        rl.close()
        log.info('Setup cancelled. Re-run once Ollama is ready.')
        process.exit(0)
      }
    } else if (models.length === 0) {
      log.warn('Ollama running but no models pulled.')
      console.log(`  ${c.dim}Run: ollama pull qwen2.5:7b${c.reset}\n`)
    } else {
      log.success(`Ollama running — ${models.length} model(s) available`)
      models.slice(0, 5).forEach(m => console.log(`    • ${m.name}`))
      if (models.length > 5) console.log(`    … and ${models.length - 5} more`)
    }
    await continueWizard(rl, provider)
    rl.close()
  }
}

async function continueWizard(rl, selectedProvider) {
  // ── Optional: additional providers ─────────────────────────────────────
  log.step(3, 'Additional providers (optional — adds fallback / more models)')
  const others = PROVIDERS.filter(p => p.id !== selectedProvider.id && p.envKey)
  if (others.length > 0) {
    console.log(`\n  ${c.dim}Press Enter to skip any provider.${c.reset}\n`)
    for (const p of others) {
      const ans = await ask(rl, `  ${p.label.split('(')[0].trim()} key (optional): `)
      const key = ans.trim()
      if (key) {
        process.stdout.write('  Validating…')
        const ok = await p.validate(key)
        if (ok) {
          process.stdout.write(` ${c.green}✓${c.reset}\n`)
          writeEnvKey(p.envKey, key)
          process.env[p.envKey] = key
        } else {
          process.stdout.write(` ${c.yellow}skipped (rejected)${c.reset}\n`)
        }
      }
    }
  }

  // ── Port ────────────────────────────────────────────────────────────────
  log.step(4, 'Server port')
  const portAns = await ask(rl, `  Port [${PORT}]: `)
  const chosenPort = parseInt(portAns.trim(), 10) || PORT
  if (chosenPort !== PORT) writeEnvKey('AIDEN_PORT', String(chosenPort))

  // ── Done ────────────────────────────────────────────────────────────────
  fs.mkdirSync(APP_DIR, { recursive: true })
  fs.writeFileSync(WIZARD_FLAG, JSON.stringify({ completedAt: new Date().toISOString() }), 'utf8')

  console.log()
  log.success('Setup complete! Starting Aiden…\n')
}

// ── Resolve aiden-runtime from multiple possible locations ───────────────────
// The runtime package is published as "aiden-runtime" on npm.
// (The npm name "devos-ai" is taken by an unrelated project.)
const RUNTIME_PKG = 'aiden-runtime'

function resolveDevOs() {
  // 1. Already in the monorepo (dev environment)
  try {
    return require.resolve(`${RUNTIME_PKG}/dist/api/server`)
  } catch {}

  // 2. Global node_modules (npm i -g aiden-os auto-installs aiden-runtime)
  try {
    const globalRoot = execSync('npm root -g', { encoding: 'utf8', timeout: 5000 }).trim()
    const p = path.join(globalRoot, RUNTIME_PKG, 'dist', 'api', 'server.js')
    if (fs.existsSync(p)) return p
  } catch {}

  // 3. Local node_modules relative to cwd
  const local = path.resolve(process.cwd(), 'node_modules', RUNTIME_PKG, 'dist', 'api', 'server.js')
  if (fs.existsSync(local)) return local

  return null
}

function resolveDevOsCli() {
  try {
    return require.resolve(`${RUNTIME_PKG}/dist-bundle/cli`)
  } catch {}

  try {
    const globalRoot = execSync('npm root -g', { encoding: 'utf8', timeout: 5000 }).trim()
    const p = path.join(globalRoot, RUNTIME_PKG, 'dist-bundle', 'cli.js')
    if (fs.existsSync(p)) return p
  } catch {}

  const local = path.resolve(process.cwd(), 'node_modules', RUNTIME_PKG, 'dist-bundle', 'cli.js')
  if (fs.existsSync(local)) return local

  return null
}

// ── Install aiden-runtime if missing ─────────────────────────────────────────
async function ensureDevOs() {
  if (resolveDevOs()) return  // already installed

  log.info(`${RUNTIME_PKG} not found — installing now…`)
  log.info('(This takes ~30 s on first run)')
  console.log()

  try {
    execSync(`npm install -g ${RUNTIME_PKG}`, { stdio: 'inherit', timeout: 120_000 })
    log.success(`${RUNTIME_PKG} installed globally.`)
  } catch (e) {
    log.error(`Failed to install ${RUNTIME_PKG}:`, e.message)
    log.info(`Run manually: npm install -g ${RUNTIME_PKG}`)
    process.exit(1)
  }

  if (!resolveDevOs()) {
    log.error(`${RUNTIME_PKG} still not found after install — check npm prefix.`)
    process.exit(1)
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${c.bold}${c.cyan}  ██████╗ ███████╗██╗   ██╗ ██████╗ ███████╗${c.reset}`)
  console.log(`${c.bold}${c.cyan}  ██╔══██╗██╔════╝██║   ██║██╔═══██╗██╔════╝${c.reset}`)
  console.log(`${c.bold}${c.cyan}  ██║  ██║█████╗  ██║   ██║██║   ██║███████╗${c.reset}`)
  console.log(`${c.bold}${c.cyan}  ██║  ██║██╔══╝  ╚██╗ ██╔╝██║   ██║╚════██║${c.reset}`)
  console.log(`${c.bold}${c.cyan}  ██████╔╝███████╗ ╚████╔╝ ╚██████╔╝███████║${c.reset}`)
  console.log(`${c.bold}${c.cyan}  ╚═════╝ ╚══════╝  ╚═══╝   ╚═════╝ ╚══════╝${c.reset}`)
  console.log(`${c.dim}  Autonomous AI Operating System  v${require('../package.json').version}${c.reset}\n`)

  // Ensure aiden-runtime (peer dep) is available
  await ensureDevOs()

  // Load existing env
  fs.mkdirSync(APP_DIR, { recursive: true })
  loadEnv()

  // First-run wizard
  if (!fs.existsSync(WIZARD_FLAG)) {
    await runWizard()
    // Reload env after wizard writes keys
    loadEnv()
  } else {
    log.info(`Config loaded from ${APP_DIR}`)
  }

  // ── Start API server in-process ────────────────────────────────────────
  log.info('Starting DevOS API server…')

  process.env.AIDEN_USER_DATA = APP_DIR
  process.env.AIDEN_PORT      = String(PORT)

  const serverPath = resolveDevOs()
  let serverModule
  try {
    serverModule = require(serverPath)
  } catch (e) {
    log.error('Failed to load aiden-runtime server module:', e.message)
    log.info('Try: npm install -g aiden-runtime && npx aiden-os')
    process.exit(1)
  }

  if (typeof serverModule.start !== 'function') {
    // Fallback: startApiServer() (older aiden-runtime without start())
    if (typeof serverModule.startApiServer === 'function') {
      log.warn('aiden-runtime start() not found — using startApiServer() fallback (upgrade aiden-runtime for best results)')
      serverModule.startApiServer(PORT)
      // Give server a moment
      await new Promise(r => setTimeout(r, 2000))
    } else {
      log.error('aiden-runtime server module does not export start() or startApiServer()')
      process.exit(1)
    }
  } else {
    const { port: livePort } = await serverModule.start({ port: PORT, configDir: APP_DIR })
    log.success(`DevOS API ready on http://127.0.0.1:${livePort}`)
  }

  // ── Start CLI in-process ───────────────────────────────────────────────
  const cliPath = resolveDevOsCli()
  if (!cliPath) {
    log.error('aiden-runtime CLI bundle not found (dist-bundle/cli.js missing).')
    log.info('Ensure aiden-runtime >= 3.16 is installed, then re-run.')
    process.exit(1)
  }

  let cliModule
  try {
    cliModule = require(cliPath)
  } catch (e) {
    log.error('Failed to load CLI module:', e.message)
    process.exit(1)
  }

  if (typeof cliModule.run === 'function') {
    await cliModule.run()
  } else {
    log.error('aiden-runtime CLI does not export run() — upgrade aiden-runtime to >= 3.16')
    process.exit(1)
  }
}

main().catch(err => {
  console.error('\n[aiden-os] Fatal error:', err.message || err)
  process.exit(1)
})
