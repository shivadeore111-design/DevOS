// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
// index.ts — DevOS CLI Entry Point
//
// Imports ONLY from files that exist in the actual codebase.
// All missing-module imports from prior versions have been removed.
//
// Commands: serve, goal, doctor, setup, setup:reset, hardware,
//           automate, automate:stop, memory, models, help
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
import { runDoctor }                       from './core/doctor'
import { visionLoop }                      from './integrations/computerUse/visionLoop'
import { executor }                        from './core/executor'
import { memoryStrategy }                  from './core/memoryStrategy'
import { startApiServer }                  from './api/server'

// ── Bootstrap ─────────────────────────────────────────────────

const workspace = path.join(process.cwd(), 'workspace', 'sandbox')
if (!fs.existsSync(workspace)) fs.mkdirSync(workspace, { recursive: true })

// ── CLI args ──────────────────────────────────────────────────

const args     = process.argv.slice(2)
const command  = args[0] ?? ''
const goalArgs = args.slice(1)

// ── Main ──────────────────────────────────────────────────────

async function main(): Promise<void> {
  switch (command) {

    // ── devos serve ─────────────────────────────────────────
    case 'serve': {
      try {
        if (!isSetupComplete()) {
          console.log('[DevOS] First boot — running setup wizard...')
          await runSetupWizard()
        }
        startApiServer()
        console.log('DevOS v1.0 running at http://localhost:4200')
      } catch (err: any) {
        console.error(`[serve] Error: ${err?.message ?? err}`)
        process.exit(1)
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

    // ── devos doctor ────────────────────────────────────────
    case 'doctor': {
      try {
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

    // ── devos help / default ─────────────────────────────────
    case 'help':
    case '--help':
    default: {
      console.log(`
DevOS v1.0 — Personal AI OS

Usage: devos <command>

Commands:
  serve              Start DevOS server
  goal "<t>" "<d>"   Run a goal
  automate "<task>"  Control your computer
  doctor             System health check
  setup              Configure DevOS for your machine
  setup:reset        Reset and re-run setup
  hardware           Show detected hardware
  models             List compatible AI models
  models recommend   Show recommended model per task type
  memory stats       Show memory statistics
  automate:stop      Stop running computer automation
`)
      break
    }
  }
}

main().catch(err => {
  console.error(`[DevOS] Fatal: ${err?.message ?? err}`)
  process.exit(1)
})
