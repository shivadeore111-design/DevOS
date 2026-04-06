// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
// index.ts — DevOS CLI Entry Point
//
// Imports ONLY from files that exist in the actual codebase.
// All missing-module imports from prior versions have been removed.
//
// Commands: serve, stop, status, goal, doctor, setup, setup:reset,
//           hardware, automate, automate:stop, memory, models, help
// ============================================================

import 'dotenv/config'
import path from 'path'
import fs   from 'fs'

// ── Real imports only ─────────────────────────────────────────
import { isSetupComplete, runSetupWizard } from './core/setupWizard'
import { detectHardware }                  from './core/hardwareDetector'
import { modelRouter }                     from './core/modelRouter'
import { memoryLayers }                    from './memory/memoryLayers'
import { livePulse }                       from './coordination/livePulse'
import { commandGate }                     from './coordination/commandGate'
import { runDoctor, cleanCorruptedSkills }  from './core/doctor'
import { visionLoop }                      from './integrations/computerUse/visionLoop'
import { executor }                        from './core/executor'
import { memoryStrategy }                  from './core/memoryStrategy'
import { startApiServer }                  from './api/server'
import { checkSearxNG }                   from './core/webSearch'
import { auditTrail }                     from './core/auditTrail'
import { buildCapabilityProfile }         from './core/capabilityProfile'
import { verifyInstall, getCurrentLicense } from './core/licenseManager'
import { scheduler }      from './core/scheduler'
import { startMCPServer } from './core/mcpServer'
import { initLocalModels } from './providers/router'
import { registerHook }   from './core/hooks'

// ── Bootstrap ─────────────────────────────────────────────────

const workspace = path.join(process.cwd(), 'workspace', 'sandbox')
if (!fs.existsSync(workspace)) fs.mkdirSync(workspace, { recursive: true })

// ── Global crash prevention — keep server alive on unhandled errors ──
process.on('uncaughtException', (err) => {
  console.error('[DevOS] Uncaught Exception (server kept alive):', err.message)
  // Do NOT exit — keep the server alive
})

process.on('unhandledRejection', (reason) => {
  console.error('[DevOS] Unhandled Rejection (server kept alive):', reason)
  // Do NOT exit
})

// ── CLI args ──────────────────────────────────────────────────

const args     = process.argv.slice(2)
const command  = args[0] ?? ''
const goalArgs = args.slice(1)

// ── Main ──────────────────────────────────────────────────────

async function main(): Promise<void> {

  // ── Feature 11: devos -p "prompt" [--json] ────────────────────
  if (args[0] === '-p' || args[0] === '--prompt') {
    const isJson      = args.includes('--json')
    const promptArgs  = args.filter(a => a !== '--json').slice(1)
    const prompt      = promptArgs.join(' ').replace(/^["']|["']$/g, '').trim()

    if (!prompt) {
      console.log('Usage: devos -p "your prompt here"')
      process.exit(1)
    }

    try {
      const res = await fetch('http://localhost:4200/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: prompt, history: [] }),
        signal:  AbortSignal.timeout(120_000),
      })

      if (!res.ok) {
        console.error(`Server error: HTTP ${res.status}. Is DevOS running? Try: devos serve`)
        process.exit(1)
      }

      const data      = await res.json() as { response?: string; message?: string }
      const response  = data.response || data.message || ''

      if (isJson) {
        console.log(JSON.stringify({ response, prompt }, null, 2))
      } else {
        console.log(response)
      }
    } catch (e: any) {
      console.error(`Could not reach DevOS server. Is it running? Try: devos serve`)
      console.error(`Error: ${e.message}`)
      process.exit(1)
    }

    process.exit(0)
  }

  switch (command) {

    // ── devos serve ─────────────────────────────────────────
    case 'serve': {
      try {
        if (!isSetupComplete()) {
          console.log('[DevOS] First boot — running setup wizard...')
          await runSetupWizard()
        }

        // ── SearxNG startup check ─────────────────────────────
        const searxOk = await checkSearxNG()
        if (searxOk) {
          console.log('[DevOS] ✓ SearxNG is running — web search fully operational')
        } else {
          console.log('[DevOS] ⚠  SearxNG not detected on http://localhost:8888')
          console.log('           Web search will fall back to: Brave API → DuckDuckGo → Wikipedia')
          console.log('           For best results, start SearxNG: .\\scripts\\start-searxng.ps1')
        }

        // ── Sprint 20: machine binding check ──────────────────
        const license   = getCurrentLicense()
        const userEmail = license.email || ''
        if (userEmail) {
          const verify = await verifyInstall(userEmail)
          if (!verify.allowed) {
            console.log('\n╔══════════════════════════════════════════╗')
            console.log('║  Access Required                         ║')
            console.log('║  Get access at: devos.taracod.com        ║')
            console.log('╚══════════════════════════════════════════╝\n')
            process.exit(1)
          }
        }

        startApiServer()

        // ── Built-in hooks ─────────────────────────────────────
        // Audit trail: log every tool call result
        registerHook('after_tool_call', async (data) => {
          auditTrail.record({
            action:     'tool',
            tool:       data.toolName,
            input:      JSON.stringify(data.input || {}).slice(0, 200),
            output:     String(data.output || '').slice(0, 200),
            durationMs: data.duration || 0,
            success:    data.success ?? true,
          })
          return data
        })
        console.log('[Hooks] Built-in hooks registered')

        // ── Sprint 29: start MCP server ────────────────────────
        startMCPServer(3001)
        console.log('[MCP] Aiden is now available as an MCP server on port 3001')

        // ── Sprint 25: register morning briefing ───────────────
        scheduler.registerMorningBriefing()

        // ── Background service PID management ─────────────────
        const { startBackgroundService } = await import('./core/backgroundService')
        startBackgroundService(4200)

        // ── Local model discovery — runs once at startup ───────
        initLocalModels().then(lm => {
          console.log('[Aiden] Local model assignments:')
          console.log('  Chat/Responder:', lm.responder || 'none — using cloud')
          console.log('  Planner:       ', lm.planner   || 'none — using cloud')
          console.log('  Code tasks:    ', lm.coder      || 'none — using cloud')
          console.log('  Fast tasks:    ', lm.fast       || 'none — using cloud')
        }).catch(() => { /* non-fatal */ })

        // ── Capability profile — detect hardware tier silently ─
        buildCapabilityProfile().then(profile => {
          console.log(`[Capability] Tier: ${profile.tier} | RAM: ${profile.ramGB}GB | GPU: ${profile.gpuVRAM}GB VRAM | Local LLM: ${profile.localLLM}`)
        }).catch(() => { /* non-fatal */ })

        console.log('╔══════════════════════════════════════════════╗')
        console.log('║  DevOS v2.0 · Aiden — Your Personal AI OS   ║')
        console.log('║  http://localhost:4200  ·  Zero telemetry    ║')
        console.log('╚══════════════════════════════════════════════╝')
      } catch (err: any) {
        console.error(`[serve] Error: ${err?.message ?? err}`)
        process.exit(1)
      }
      break
    }

    // ── devos stop ──────────────────────────────────────────
    case 'stop': {
      try {
        const { stopService } = await import('./core/backgroundService')
        stopService()
      } catch (err: any) {
        console.error(`[stop] Error: ${err?.message ?? err}`)
      }
      break
    }

    // ── devos status ─────────────────────────────────────────
    case 'status': {
      try {
        const { isServiceRunning, getPid } = await import('./core/backgroundService')
        if (isServiceRunning()) {
          const pid = getPid()
          console.log(`✓ Aiden is running (PID: ${pid})`)
          console.log(`  API:       http://localhost:4200`)
          console.log(`  Dashboard: http://localhost:3000`)
        } else {
          console.log('✗ Aiden is not running')
        }
      } catch (err: any) {
        console.error(`[status] Error: ${err?.message ?? err}`)
      }
      break
    }

    // ── devos goal "<title>" "<description>" ────────────────
    case 'goal': {
      try {
        const title       = goalArgs[0] ?? ''
        const description = goalArgs[1] ?? ''
        if (!title) {
          console.log('Usage: devos goal "<title>" "<description>"')
          break
        }
        livePulse.act('CEO', `Starting goal: ${title}`)
        memoryLayers.write(`Goal: ${title} — ${description}`, ['goal', 'cli'])
        livePulse.done('CEO', `Goal logged: ${title}`)
        console.log(`[Goal] ✓ Logged: ${title}`)
        if (description) console.log(`       ${description}`)
      } catch (err: any) {
        console.error(`[goal] Error: ${err?.message ?? err}`)
      }
      break
    }

    // ── devos doctor [--clean-skills] ───────────────────────
    case 'doctor': {
      try {
        if (goalArgs.includes('--clean-skills')) {
          console.log('\n[Doctor] Cleaning corrupted skills...\n')
          const result = cleanCorruptedSkills()
          if (result.deleted.length === 0) {
            console.log('  No corrupted skills found.')
          } else {
            console.log(`  Deleted ${result.deleted.length} corrupted skill(s):`)
            result.deleted.forEach(name => console.log(`    - ${name}`))
          }
          console.log(`  Kept: ${result.kept} clean skill(s)\n`)
          break
        }
        const report = await runDoctor()
        console.log('\n[Doctor] System Health Report\n')
        for (const check of report.checks) {
          const icon = check.status === 'ok' ? '✓' : check.status === 'warn' ? '⚠' : '✗'
          console.log(`  ${icon}  ${check.name}: ${check.message}`)
          if (check.detail) {
            const detail = typeof check.detail === 'string'
              ? check.detail
              : JSON.stringify(check.detail, null, 2)
            console.log(`      ${detail}`)
          }
        }
        console.log(`\n  Overall: ${report.healthy ? '✓ Healthy' : '✗ Issues found'}\n`)
      } catch (err: any) {
        console.error(`[doctor] Error: ${err?.message ?? err}`)
      }
      break
    }

    // ── devos setup ─────────────────────────────────────────
    case 'setup': {
      try {
        await runSetupWizard()
      } catch (err: any) {
        console.error(`[setup] Error: ${err?.message ?? err}`)
      }
      break
    }

    // ── devos setup:reset ───────────────────────────────────
    case 'setup:reset': {
      try {
        const setupFlag = path.join(process.cwd(), 'config', 'setup-complete.json')
        const hwFile    = path.join(process.cwd(), 'config', 'hardware.json')
        if (fs.existsSync(setupFlag)) fs.unlinkSync(setupFlag)
        if (fs.existsSync(hwFile))    fs.unlinkSync(hwFile)
        console.log('[Setup] Reset. Restarting setup wizard...\n')
        await runSetupWizard()
      } catch (err: any) {
        console.error(`[setup:reset] Error: ${err?.message ?? err}`)
      }
      break
    }

    // ── devos hardware ──────────────────────────────────────
    case 'hardware': {
      try {
        const hw = detectHardware()
        console.log('\n[Hardware]\n' + JSON.stringify(hw, null, 2) + '\n')
      } catch (err: any) {
        console.error(`[hardware] Error: ${err?.message ?? err}`)
      }
      break
    }

    // ── devos automate "<task>" ──────────────────────────────
    case 'automate': {
      try {
        const task = goalArgs.join(' ').trim()
        if (!task) {
          console.log('Usage: devos automate "<task description>"')
          break
        }
        console.log(`[DesktopAutomator] Starting: ${task}`)
        const result = await visionLoop.run(task, { requireApproval: true, visionModel: 'auto' })
        if (result.success) {
          console.log(`✓ Done in ${result.iterations} iteration(s)`)
        } else {
          console.log(`✗ Failed: ${result.failureReason}`)
          console.log(`  Actions executed: ${result.actionsExecuted.length}`)
        }
      } catch (err: any) {
        console.error(`[automate] Error: ${err?.message ?? err}`)
      }
      break
    }

    // ── devos automate:stop ─────────────────────────────────
    case 'automate:stop': {
      try {
        visionLoop.abort()
        console.log('[DesktopAutomator] Aborted')
      } catch (err: any) {
        console.error(`[automate:stop] Error: ${err?.message ?? err}`)
      }
      break
    }

    // ── devos memory stats ──────────────────────────────────
    case 'memory': {
      try {
        const sub = goalArgs[0]
        if (sub === 'stats') {
          const layerStats = await memoryLayers.getStats()
          const cuStats    = memoryStrategy.stats()
          console.log('\n[Memory Stats]\n')
          console.log(`  HOT  (RAM):        ${layerStats.hot} entries`)
          console.log(`  WARM (SQLite):     ${layerStats.warm} entries`)
          console.log(`  COLD (JSON):       ${layerStats.cold} entries`)
          console.log('\n[ComputerUse Memory]\n')
          console.log(`  Goals tracked:     ${cuStats.total}`)
          console.log(`  Avg success rate:  ${(cuStats.avgSuccessRate * 100).toFixed(1)}%`)
          if (cuStats.topGoals.length) {
            console.log('  Top goals:')
            cuStats.topGoals.forEach(g => console.log(`    • ${g}`))
          }
          console.log()
        } else {
          console.log('Usage: devos memory stats')
        }
      } catch (err: any) {
        console.error(`[memory] Error: ${err?.message ?? err}`)
      }
      break
    }

    // ── devos models [recommend] ────────────────────────────
    case 'models': {
      try {
        const sub    = goalArgs[0]
        const hw     = modelRouter.getHardware()
        const models = modelRouter.listModels()

        if (sub === 'recommend') {
          console.log('\n[Model Recommendations for your hardware]\n')
          console.log(`  GPU: ${hw.gpu}  (${hw.vramGB}GB VRAM · ${hw.ramGB}GB RAM)\n`)
          const types = ['chat', 'code', 'vision', 'reasoning', 'embedding'] as const
          for (const t of types) {
            console.log(`  ${t.padEnd(10)} →  ${modelRouter.route(t)}`)
          }
          console.log()
        } else {
          console.log('\n[Compatible Models for your machine]\n')
          console.log(`  GPU: ${hw.gpu}  ·  ${hw.vramGB}GB VRAM  ·  ${hw.ramGB}GB RAM\n`)
          for (const m of models) {
            console.log(`  ${m.type.padEnd(10)}  ${m.name}`)
          }
          console.log()
        }
      } catch (err: any) {
        console.error(`[models] Error: ${err?.message ?? err}`)
      }
      break
    }

    // ── devos history ────────────────────────────────────────
    case 'history': {
      try {
        const entries = auditTrail.getToday()
        console.log('\n' + auditTrail.formatSummary(entries) + '\n')
      } catch (err: any) {
        console.error(`[history] Error: ${err?.message ?? err}`)
      }
      break
    }

    // ── devos backup ────────────────────────────────────────
    case 'backup': {
      try {
        let archiver: any
        try {
          archiver = require('archiver')
        } catch {
          console.log('  archiver package not found. Run: npm install archiver @types/archiver')
          break
        }

        const timestamp  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
        const backupName = `aiden-backup-${timestamp}.zip`

        console.log(`\n  Creating backup: ${backupName}`)

        const output  = fs.createWriteStream(backupName)
        const archive = archiver('zip', { zlib: { level: 9 } })

        archive.pipe(output)

        const dirs = [
          'workspace/memory',
          'workspace/sessions',
          'workspace/skills',
          'workspace/knowledge',
        ]
        for (const dir of dirs) {
          if (fs.existsSync(dir)) archive.directory(dir, dir)
        }

        const files = [
          'workspace/USER.md',
          'workspace/HEARTBEAT.md',
          'workspace/STANDING_ORDERS.md',
          'workspace/identity.json',
          'workspace/scheduled-tasks.json',
        ]
        for (const file of files) {
          if (fs.existsSync(file)) archive.file(file, { name: file })
        }

        // NEVER include config/devos.config.json — contains API keys

        await new Promise<void>((resolve, reject) => {
          output.on('close', resolve)
          archive.on('error', reject)
          archive.finalize()
        })

        const stats = fs.statSync(backupName)
        console.log(`  ✓ Saved: ${backupName}`)
        console.log(`  Size: ${(stats.size / 1024 / 1024).toFixed(1)} MB`)
        console.log(`  Restore: devos restore ${backupName}`)
      } catch (err: any) {
        console.error(`[backup] Error: ${err?.message ?? err}`)
      }
      break
    }

    // ── devos security ───────────────────────────────────────
    case 'security': {
      try {
        console.log('\n  AIDEN SECURITY AUDIT\n')
        let issues = 0

        // Check 1: API keys in session history
        const sessionDir = 'workspace/sessions'
        if (fs.existsSync(sessionDir)) {
          const sessions    = fs.readdirSync(sessionDir)
          const keyPatterns = [
            /sk-[a-zA-Z0-9]{20,}/,
            /gsk_[a-zA-Z0-9]{20,}/,
            /AIza[a-zA-Z0-9_-]{33}/,
            /ghp_[a-zA-Z0-9]{36}/,
          ]
          let found = false
          for (const file of sessions) {
            try {
              const content = fs.readFileSync(path.join(sessionDir, file), 'utf-8')
              for (const pattern of keyPatterns) {
                if (pattern.test(content)) {
                  console.log(`  ✗ API key found in ${file}`)
                  issues++
                  found = true
                }
              }
            } catch { /* skip unreadable files */ }
          }
          if (!found) console.log('  ✓ No API keys in session history')
        }

        // Check 2: Config has API keys (expected — just note it)
        const configPath = 'config/devos.config.json'
        if (fs.existsSync(configPath)) {
          const config   = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
          const keyCount = (JSON.stringify(config).match(/apiKey/gi) || []).length
          console.log(`  ⚠  ${keyCount} API key(s) in config — ensure config is gitignored`)
        }

        // Check 3: Suspicious skills
        const skillDir = 'workspace/skills/learned'
        if (fs.existsSync(skillDir)) {
          const suspicious = fs.readdirSync(skillDir).filter(s =>
            s.includes('password') || s.includes('token') || s.includes('secret')
          )
          if (suspicious.length > 0) {
            console.log(`  ✗ Suspicious skills: ${suspicious.join(', ')}`)
            issues++
          } else {
            console.log('  ✓ No suspicious skills found')
          }
        }

        // Check 4: GitHub visibility reminder
        console.log('  ⚠  Verify GitHub repo is private: github.com/shivadeore111-design/DevOS')

        console.log(`\n  ${issues === 0 ? '✓ Clean' : `✗ ${issues} issue(s) found`}\n`)
      } catch (err: any) {
        console.error(`[security] Error: ${err?.message ?? err}`)
      }
      break
    }

    // ── devos cleanup ────────────────────────────────────────
    case 'cleanup': {
      try {
        const sessionDir = 'workspace/sessions'
        if (!fs.existsSync(sessionDir)) {
          console.log('No sessions found')
          break
        }

        const MAX_AGE_DAYS = 30
        const now          = Date.now()
        const files        = fs.readdirSync(sessionDir)
        let deleted        = 0
        let kept           = 0
        let freedBytes     = 0

        for (const file of files) {
          const filePath  = path.join(sessionDir, file)
          const stats     = fs.statSync(filePath)
          const ageInDays = (now - stats.mtimeMs) / 86400000

          if (ageInDays > MAX_AGE_DAYS) {
            freedBytes += stats.size
            fs.unlinkSync(filePath)
            deleted++
          } else {
            kept++
          }
        }

        console.log(`\n  Session cleanup:`)
        console.log(`  Deleted: ${deleted} file(s) older than ${MAX_AGE_DAYS} days`)
        console.log(`  Kept:    ${kept} recent file(s)`)
        console.log(`  Freed:   ${(freedBytes / 1024).toFixed(0)} KB\n`)
      } catch (err: any) {
        console.error(`[cleanup] Error: ${err?.message ?? err}`)
      }
      break
    }

    // ── devos help / default ─────────────────────────────────
    case 'help':
    case '--help':
    default: {
      console.log(`
DevOS v1.0 — Personal AI OS

Usage: devos <command>

Commands:
  serve              Start DevOS server (background service)
  stop               Stop the running Aiden service
  status             Check if Aiden is running
  goal "<t>" "<d>"   Run a goal
  automate "<task>"  Control your computer
  doctor             System health check
  setup              Configure DevOS for your machine
  setup:reset        Reset and re-run setup
  hardware           Show detected hardware
  history            Show today's activity summary
  models             List compatible AI models
  models recommend   Show recommended model per task type
  memory stats       Show memory statistics
  automate:stop      Stop running computer automation
  backup             Create a .zip backup of workspace data
  security           Run a security audit
  cleanup            Delete session files older than 30 days
  -p "<prompt>"      Send a single prompt (server must be running)
  -p "<prompt>" --json  Same, output as JSON
`)
      break
    }
  }
}

main().then(() => {
  // For one-shot commands (doctor, status, hardware, etc.) exit cleanly.
  // 'serve' keeps the process alive via the HTTP server — process.exit is never reached.
  if (command !== 'serve' && command !== 'daemon') {
    process.exit(0)
  }
}).catch(err => {
  console.error(`[DevOS] Fatal: ${err?.message ?? err}`)
  process.exit(1)
})
