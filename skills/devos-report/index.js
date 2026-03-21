// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// skills/devos-report/index.js
// Input:
//   { goalId, type, goalTitle, tasksCompleted, totalTasks, filesCreated,
//     actions, duration, status, outputPath? }
// Output:
//   { htmlPath, summary }

'use strict'

const fs   = require('fs')
const path = require('path')

/**
 * @param {Object} opts
 * @param {string}   opts.goalId
 * @param {string}   [opts.type]           e.g. 'goal' | 'mission'
 * @param {string}   opts.goalTitle
 * @param {number}   [opts.tasksCompleted]
 * @param {number}   [opts.totalTasks]
 * @param {string[]} [opts.filesCreated]
 * @param {Array<{description:string, status:string, durationMs?:number}>} [opts.actions]
 * @param {number}   [opts.duration]       ms
 * @param {string}   opts.status           'completed' | 'failed'
 * @param {string}   [opts.outputPath]     override output directory
 * @returns {{ htmlPath: string, summary: string }}
 */
function run(opts) {
  const {
    goalId       = `report-${Date.now()}`,
    type         = 'goal',
    goalTitle    = 'Untitled Goal',
    tasksCompleted = 0,
    totalTasks   = 0,
    filesCreated = [],
    actions      = [],
    duration     = 0,
    status       = 'completed',
  } = opts

  const success    = status === 'completed'
  const timestamp  = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const durationS  = (duration / 1000).toFixed(1)
  const statusColor = success ? '#22c55e' : '#ef4444'
  const statusIcon  = success ? '✅' : '❌'
  const statusText  = success ? 'COMPLETED' : 'FAILED'

  // ── File list HTML ─────────────────────────────────────────
  const fileRows = filesCreated.length
    ? filesCreated.map(f =>
        `<li style="padding:4px 0;border-bottom:1px solid #1e293b;font-family:monospace;font-size:13px;color:#94a3b8;">${escHtml(f)}</li>`
      ).join('')
    : '<li style="color:#475569;font-style:italic;padding:4px 0">No files recorded</li>'

  // ── Actions timeline HTML ─────────────────────────────────
  const actionRows = actions.length
    ? actions.map((a, i) => {
        const dot   = a.status === 'done'    ? '#22c55e'
                    : a.status === 'failed'  ? '#ef4444'
                    : '#64748b'
        const dur   = a.durationMs ? ` <span style="color:#475569;font-size:11px">${(a.durationMs/1000).toFixed(1)}s</span>` : ''
        return `<div style="display:flex;align-items:flex-start;gap:12px;padding:8px 0;border-bottom:1px solid #1e293b;">
          <span style="width:22px;height:22px;border-radius:50%;background:${dot};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;font-weight:bold;color:#0f172a">${i+1}</span>
          <div style="flex:1">
            <div style="color:#e2e8f0;font-size:13px">${escHtml(a.description ?? '(action)')}</div>
            ${dur}
          </div>
          <span style="font-size:11px;padding:2px 6px;border-radius:4px;background:${dot}22;color:${dot}">${escHtml(a.status ?? '')}</span>
        </div>`
      }).join('')
    : '<div style="color:#475569;font-style:italic;padding:8px 0">No action timeline recorded</div>'

  // ── Full HTML ──────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DevOS Report — ${escHtml(goalTitle)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0f172a; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; min-height: 100vh; padding: 32px 16px; }
  .container { max-width: 860px; margin: 0 auto; }
  .card { background: #1e293b; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
  .label { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #64748b; margin-bottom: 6px; }
  h1 { font-size: 22px; font-weight: 700; color: #f1f5f9; }
  h2 { font-size: 15px; font-weight: 600; color: #94a3b8; margin-bottom: 14px; }
  .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; letter-spacing: .05em; }
</style>
</head>
<body>
<div class="container">

  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
    <div>
      <div style="font-size:12px;color:#475569;margin-bottom:4px;">DevOS Execution Report</div>
      <h1>${escHtml(goalTitle)}</h1>
    </div>
    <div style="text-align:right">
      <div style="font-size:12px;color:#475569">${timestamp}</div>
      <div style="font-size:11px;color:#334155;margin-top:2px">${escHtml(type.toUpperCase())}</div>
    </div>
  </div>

  <!-- Summary card -->
  <div class="card">
    <h2>Summary</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:16px;">
      <div>
        <div class="label">Status</div>
        <span class="badge" style="background:${statusColor}22;color:${statusColor}">${statusIcon} ${statusText}</span>
      </div>
      <div>
        <div class="label">Tasks</div>
        <div style="font-size:24px;font-weight:700;color:#f1f5f9">${tasksCompleted}<span style="font-size:16px;color:#64748b">/${totalTasks}</span></div>
      </div>
      <div>
        <div class="label">Duration</div>
        <div style="font-size:24px;font-weight:700;color:#f1f5f9">${durationS}<span style="font-size:16px;color:#64748b">s</span></div>
      </div>
      <div>
        <div class="label">Actions</div>
        <div style="font-size:24px;font-weight:700;color:#f1f5f9">${actions.length}</div>
      </div>
    </div>
  </div>

  <!-- Files created -->
  <div class="card">
    <h2>Files Created (${filesCreated.length})</h2>
    <ul style="list-style:none">${fileRows}</ul>
  </div>

  <!-- Actions timeline -->
  <div class="card">
    <h2>Actions Timeline</h2>
    ${actionRows}
  </div>

  <!-- Footer -->
  <div style="text-align:center;color:#334155;font-size:12px;margin-top:24px;">
    Generated by DevOS &mdash; Goal ID: ${escHtml(goalId)}
  </div>

</div>
</body>
</html>`

  // ── Write to disk ──────────────────────────────────────────
  const outDir = opts.outputPath ?? path.join(process.cwd(), 'workspace', 'reports')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  const safeId   = goalId.replace(/[^a-z0-9_-]/gi, '_').slice(0, 60)
  const htmlPath = path.join(outDir, `${safeId}.html`)
  fs.writeFileSync(htmlPath, html, 'utf-8')

  const summary = `${statusIcon} ${goalTitle} — ${tasksCompleted}/${totalTasks} tasks, ${durationS}s`
  console.log(`[DevOSReport] Report written: ${htmlPath}`)
  return { htmlPath, summary }
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

module.exports = { run }
