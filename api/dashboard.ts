// api/dashboard.ts — Aiden local web dashboard
// Served at GET /ui — single self-contained HTML, no external build step.

export function getDashboardHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Aiden Dashboard</title>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<style>
:root {
  --bg: #0D0D0D;
  --surface: #1A1A1A;
  --surface2: #222222;
  --border: #2A2A2A;
  --orange: #FF6B35;
  --orange-dim: #c0521e;
  --text: #E8E8E8;
  --text-dim: #888;
  --green: #4CAF50;
  --red: #F44336;
  --yellow: #FFC107;
  --radius: 8px;
  --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:var(--font);font-size:14px;height:100vh;display:flex;flex-direction:column;overflow:hidden}

/* ── Top bar ── */
#topbar{display:flex;align-items:center;gap:12px;padding:0 20px;height:48px;border-bottom:1px solid var(--border);background:var(--surface);flex-shrink:0}
#logo{font-weight:700;font-size:16px;color:var(--orange);letter-spacing:.5px}
#status-dot{width:8px;height:8px;border-radius:50%;background:var(--red);transition:background .4s}
#status-dot.ok{background:var(--green)}
#status-text{color:var(--text-dim);font-size:12px}
#topbar-right{margin-left:auto;display:flex;gap:8px;align-items:center}
#version-label{color:var(--text-dim);font-size:11px}

/* ── Tab bar ── */
#tabbar{display:flex;gap:2px;padding:8px 20px 0;background:var(--surface);border-bottom:1px solid var(--border);flex-shrink:0}
.tab{padding:8px 18px;border-radius:6px 6px 0 0;cursor:pointer;font-size:13px;font-weight:500;color:var(--text-dim);border:1px solid transparent;border-bottom:none;background:transparent;transition:all .15s}
.tab:hover{color:var(--text);background:var(--surface2)}
.tab.active{color:var(--orange);background:var(--bg);border-color:var(--border)}

/* ── Main content ── */
#panels{flex:1;overflow:hidden;display:flex;flex-direction:column}
.panel{display:none;flex:1;overflow:hidden;flex-direction:column}
.panel.active{display:flex}

/* ── Shared card ── */
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:12px}
.card-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--text-dim);margin-bottom:10px}

/* ── Scrollable inner ── */
.scroll{overflow-y:auto;flex:1;padding:16px 20px}
.scroll::-webkit-scrollbar{width:6px}
.scroll::-webkit-scrollbar-track{background:transparent}
.scroll::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}

/* ─────────────────── CHAT ─────────────────── */
#chat-wrap{display:flex;flex:1;flex-direction:column;overflow:hidden}
#chat-messages{flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:10px}
#chat-messages::-webkit-scrollbar{width:6px}
#chat-messages::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
.msg{max-width:80%;border-radius:10px;padding:10px 14px;line-height:1.55;font-size:13.5px}
.msg.user{align-self:flex-end;background:var(--orange);color:#fff;border-bottom-right-radius:2px}
.msg.aiden{align-self:flex-start;background:var(--surface);border:1px solid var(--border);color:var(--text);border-bottom-left-radius:2px}
.msg.aiden pre{background:var(--bg);border:1px solid var(--border);border-radius:5px;padding:8px 10px;overflow-x:auto;font-size:12px;margin-top:8px}
.msg.aiden code{font-size:12px;background:var(--bg);padding:1px 4px;border-radius:3px}
.msg.system{align-self:center;color:var(--text-dim);font-size:12px;font-style:italic}
.msg.thinking{align-self:flex-start;color:var(--text-dim);font-size:12px;font-style:italic;padding:6px 10px}
#chat-input-bar{padding:12px 20px;border-top:1px solid var(--border);display:flex;gap:8px;flex-shrink:0;background:var(--surface)}
#chat-input{flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px 14px;color:var(--text);font-size:14px;resize:none;min-height:40px;max-height:120px;line-height:1.4;font-family:var(--font)}
#chat-input:focus{outline:none;border-color:var(--orange)}
#send-btn{background:var(--orange);color:#fff;border:none;border-radius:8px;padding:9px 18px;font-size:14px;font-weight:600;cursor:pointer;flex-shrink:0;transition:background .15s}
#send-btn:hover{background:var(--orange-dim)}
#send-btn:disabled{opacity:.5;cursor:not-allowed}
#session-bar{padding:6px 20px;font-size:11px;color:var(--text-dim);border-bottom:1px solid var(--border);display:flex;gap:16px;align-items:center;flex-shrink:0;background:var(--surface)}
.sess-btn{background:transparent;border:1px solid var(--border);color:var(--text-dim);border-radius:5px;padding:2px 8px;font-size:11px;cursor:pointer}
.sess-btn:hover{border-color:var(--orange);color:var(--orange)}

/* ─────────────────── PROVIDERS ─────────────────── */
.provider-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
.pcard{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px}
.pcard-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.pcard-name{font-weight:600;font-size:13px}
.badge{font-size:10px;padding:2px 7px;border-radius:20px;font-weight:600;text-transform:uppercase;letter-spacing:.4px}
.badge.ok{background:#1a3a1a;color:var(--green)}
.badge.err{background:#3a1a1a;color:var(--red)}
.badge.warn{background:#3a2a00;color:var(--yellow)}
.pcard-model{font-size:11px;color:var(--text-dim);margin-top:2px}
.pcard-latency{font-size:11px;color:var(--text-dim);margin-top:4px}

/* ─────────────────── MEMORY ─────────────────── */
.mem-item{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:10px 14px;margin-bottom:8px;display:flex;gap:10px;align-items:flex-start}
.mem-icon{color:var(--orange);font-size:16px;flex-shrink:0;margin-top:1px}
.mem-text{font-size:13px;line-height:1.5;color:var(--text);flex:1}
.mem-meta{font-size:10px;color:var(--text-dim);margin-top:3px}
#mem-search{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:7px;padding:8px 13px;color:var(--text);font-size:13px;margin-bottom:14px}
#mem-search:focus{outline:none;border-color:var(--orange)}
.mem-section-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--text-dim);margin:14px 0 8px}

/* ─────────────────── SKILLS ─────────────────── */
.skill-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
.scard{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:12px 14px}
.scard-name{font-weight:600;font-size:13px;color:var(--orange);margin-bottom:4px}
.scard-desc{font-size:12px;color:var(--text-dim);line-height:1.4}
.scard-trigger{font-size:10px;color:var(--text-dim);margin-top:5px;font-family:monospace}

/* ─────────────────── REFRESH ─────────────────── */
.refresh-btn{background:transparent;border:1px solid var(--border);color:var(--text-dim);border-radius:6px;padding:5px 12px;font-size:12px;cursor:pointer;transition:all .15s}
.refresh-btn:hover{border-color:var(--orange);color:var(--orange)}
.panel-toolbar{display:flex;justify-content:space-between;align-items:center;padding:12px 20px 0;flex-shrink:0}
.panel-toolbar h2{font-size:14px;font-weight:600;color:var(--text)}
</style>
</head>
<body>

<!-- Top bar -->
<div id="topbar">
  <span id="logo">⬡ Aiden</span>
  <span id="status-dot"></span>
  <span id="status-text">connecting…</span>
  <div id="topbar-right">
    <span id="version-label"></span>
  </div>
</div>

<!-- Tab bar -->
<div id="tabbar">
  <div class="tab active" data-tab="chat">💬 Chat</div>
  <div class="tab" data-tab="providers">⚡ Providers</div>
  <div class="tab" data-tab="memory">🧠 Memory</div>
  <div class="tab" data-tab="skills">🎯 Skills</div>
</div>

<!-- Panels -->
<div id="panels">

  <!-- ── CHAT ── -->
  <div class="panel active" id="panel-chat">
    <div id="session-bar">
      <span id="session-label">Session: —</span>
      <button class="sess-btn" id="new-session-btn">＋ New session</button>
      <button class="sess-btn" id="clear-chat-btn">✕ Clear</button>
    </div>
    <div id="chat-wrap">
      <div id="chat-messages">
        <div class="msg system">Aiden is running locally. Ask anything.</div>
      </div>
      <div id="chat-input-bar">
        <textarea id="chat-input" placeholder="Message Aiden…" rows="1"></textarea>
        <button id="send-btn">Send</button>
      </div>
    </div>
  </div>

  <!-- ── PROVIDERS ── -->
  <div class="panel" id="panel-providers">
    <div class="panel-toolbar">
      <h2>LLM Providers</h2>
      <button class="refresh-btn" id="refresh-providers">↻ Refresh</button>
    </div>
    <div class="scroll">
      <div id="providers-content"><p style="color:var(--text-dim);padding:20px 0">Loading…</p></div>
    </div>
  </div>

  <!-- ── MEMORY ── -->
  <div class="panel" id="panel-memory">
    <div class="panel-toolbar">
      <h2>Memory</h2>
      <button class="refresh-btn" id="refresh-memory">↻ Refresh</button>
    </div>
    <div class="scroll">
      <input id="mem-search" type="text" placeholder="Search memory…" autocomplete="off"/>
      <div id="memory-content"><p style="color:var(--text-dim)">Loading…</p></div>
    </div>
  </div>

  <!-- ── SKILLS ── -->
  <div class="panel" id="panel-skills">
    <div class="panel-toolbar">
      <h2>Skills</h2>
      <button class="refresh-btn" id="refresh-skills">↻ Refresh</button>
    </div>
    <div class="scroll">
      <div id="skills-content"><p style="color:var(--text-dim);padding:20px 0">Loading…</p></div>
    </div>
  </div>

</div><!-- /panels -->

<script>
// ── Config ──────────────────────────────────────────────────
const BASE = window.location.origin  // e.g. http://localhost:4200

// ── Tabs ────────────────────────────────────────────────────
const tabs = document.querySelectorAll('.tab')
const panels = document.querySelectorAll('.panel')
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const id = tab.dataset.tab
    tabs.forEach(t => t.classList.remove('active'))
    panels.forEach(p => p.classList.remove('active'))
    tab.classList.add('active')
    document.getElementById('panel-' + id).classList.add('active')
    if (id === 'providers') loadProviders()
    if (id === 'memory')    loadMemory()
    if (id === 'skills')    loadSkills()
  })
})

// ── Status bar ──────────────────────────────────────────────
async function ping() {
  try {
    const r = await fetch(BASE + '/api/ping', { cache: 'no-store' })
    const d = await r.json()
    document.getElementById('status-dot').className = 'ok'
    document.getElementById('status-text').textContent = 'online'
    document.getElementById('version-label').textContent = 'v' + (d.version || '')
  } catch {
    document.getElementById('status-dot').className = ''
    document.getElementById('status-text').textContent = 'offline'
  }
}
ping()
setInterval(ping, 10000)

// ── Chat ─────────────────────────────────────────────────────
let sessionId = null
const chatBox   = document.getElementById('chat-messages')
const chatInput = document.getElementById('chat-input')
const sendBtn   = document.getElementById('send-btn')

function addMsg(role, html) {
  const el = document.createElement('div')
  el.className = 'msg ' + role
  el.innerHTML = html
  chatBox.appendChild(el)
  chatBox.scrollTop = chatBox.scrollHeight
  return el
}

function mdToHtml(text) {
  try { return marked.parse(text) } catch { return escHtml(text) }
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
})

document.getElementById('send-btn').addEventListener('click', sendMessage)

document.getElementById('clear-chat-btn').addEventListener('click', () => {
  chatBox.innerHTML = '<div class="msg system">Cleared.</div>'
})

document.getElementById('new-session-btn').addEventListener('click', () => {
  sessionId = null
  document.getElementById('session-label').textContent = 'Session: —'
  chatBox.innerHTML = '<div class="msg system">New session started.</div>'
})

async function sendMessage() {
  const text = chatInput.value.trim()
  if (!text) return
  chatInput.value = ''
  chatInput.style.height = ''
  sendBtn.disabled = true
  addMsg('user', escHtml(text))

  const thinkEl = addMsg('thinking', '⋯ thinking')
  let aiEl = null
  let buffer = ''

  try {
    const body = { message: text }
    if (sessionId) body.sessionId = sessionId

    const resp = await fetch(BASE + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
      body: JSON.stringify(body)
    })

    const reader = resp.body.getReader()
    const dec    = new TextDecoder()
    let partial  = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      partial += dec.decode(value, { stream: true })
      const lines = partial.split('\\n')
      partial = lines.pop()
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const raw = line.slice(5).trim()
        if (!raw || raw === '[DONE]') continue
        let ev
        try { ev = JSON.parse(raw) } catch { continue }

        if (ev.sessionId && !sessionId) {
          sessionId = ev.sessionId
          document.getElementById('session-label').textContent = 'Session: ' + sessionId.slice(0,8)
        }
        // server sends { token, done: false } — no type field
        if (ev.token || ev.delta) {
          if (thinkEl && thinkEl.parentNode) thinkEl.remove()
          if (!aiEl) aiEl = addMsg('aiden', '')
          buffer += (ev.delta || ev.token || '')
          aiEl.innerHTML = mdToHtml(buffer)
          chatBox.scrollTop = chatBox.scrollHeight
        }
        // server sends { tool: "name", message: "...", timestamp } for tool progress
        if (ev.tool) {
          if (thinkEl && thinkEl.parentNode) thinkEl.innerHTML = '🔧 ' + escHtml(ev.tool)
        }
        // server sends { activity: { icon, message, style, rawTool? }, done: false }
        if (ev.activity) {
          const act = ev.activity
          if (thinkEl && thinkEl.parentNode) {
            thinkEl.innerHTML = (act.icon ? act.icon + ' ' : '🔧 ') + escHtml(act.message || act.rawTool || 'working…')
          }
          if (act.style === 'error' && !buffer) {
            if (thinkEl && thinkEl.parentNode) thinkEl.remove()
            addMsg('system', '⚠ ' + escHtml(act.message || 'Error'))
          }
        }
        // server sends { thinking: { stage, message } }
        if (ev.thinking) {
          if (thinkEl && thinkEl.parentNode) thinkEl.innerHTML = '⋯ ' + escHtml(ev.thinking.message || 'thinking…')
        }
        // server sends { done: true } — no type field
        if (ev.done === true) {
          if (thinkEl && thinkEl.parentNode) thinkEl.remove()
        }
      }
    }
    if (thinkEl && thinkEl.parentNode) thinkEl.remove()
    if (!aiEl && !buffer) addMsg('system', '(no response)')
  } catch (err) {
    if (thinkEl && thinkEl.parentNode) thinkEl.remove()
    addMsg('system', '⚠ ' + escHtml(err.message))
  } finally {
    sendBtn.disabled = false
    chatInput.focus()
  }
}

// Auto-resize textarea
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto'
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px'
})

// ── Providers ────────────────────────────────────────────────
async function loadProviders() {
  const el = document.getElementById('providers-content')
  try {
    const [stateRes, statusRes] = await Promise.all([
      fetch(BASE + '/api/providers/state').then(r => r.json()),
      fetch(BASE + '/api/providers/status').then(r => r.json()).catch(() => ({}))
    ])

    const providers = Array.isArray(stateRes) ? stateRes
      : (stateRes.providers || Object.entries(stateRes).map(([k,v]) => ({ name: k, ...v })))

    if (!providers.length) { el.innerHTML = '<p style="color:var(--text-dim)">No providers configured.</p>'; return }

    const statusMap = {}
    if (statusRes && typeof statusRes === 'object') {
      const arr = Array.isArray(statusRes) ? statusRes : Object.entries(statusRes).map(([k,v])=>({name:k,...v}))
      arr.forEach(p => { statusMap[p.name || p.id] = p })
    }

    el.innerHTML = '<div class="provider-grid">' + providers.map(p => {
      const name = p.name || p.id || '?'
      const status = p.status || statusMap[name]?.status || 'unknown'
      const badgeCls = status === 'ok' || status === 'healthy' || status === 'active' ? 'ok'
        : status === 'error' || status === 'down' ? 'err' : 'warn'
      const model = p.currentModel || p.model || p.defaultModel || ''
      const latency = p.latency || p.avgLatency || statusMap[name]?.latency || ''
      return \`<div class="pcard">
        <div class="pcard-header">
          <span class="pcard-name">\${escHtml(name)}</span>
          <span class="badge \${badgeCls}">\${escHtml(status)}</span>
        </div>
        \${model ? \`<div class="pcard-model">Model: \${escHtml(model)}</div>\` : ''}
        \${latency ? \`<div class="pcard-latency">Latency: \${typeof latency==='number' ? latency+'ms' : escHtml(String(latency))}</div>\` : ''}
      </div>\`
    }).join('') + '</div>'
  } catch (err) {
    el.innerHTML = '<p style="color:var(--red)">Failed to load providers: ' + escHtml(err.message) + '</p>'
  }
}
document.getElementById('refresh-providers').addEventListener('click', loadProviders)

// ── Memory ───────────────────────────────────────────────────
let allMemories = []

async function loadMemory() {
  const el = document.getElementById('memory-content')
  try {
    const data = await fetch(BASE + '/api/memory').then(r => r.json())
    allMemories = Array.isArray(data) ? data : (data.memories || data.items || [])
    renderMemory(allMemories)
  } catch (err) {
    el.innerHTML = '<p style="color:var(--red)">Failed to load memory: ' + escHtml(err.message) + '</p>'
  }
}

function renderMemory(items) {
  const el = document.getElementById('memory-content')
  if (!items.length) { el.innerHTML = '<p style="color:var(--text-dim)">No memories stored yet.</p>'; return }
  el.innerHTML = items.map(m => {
    const text = m.content || m.text || m.value || JSON.stringify(m)
    const meta = [m.type, m.category, m.created_at || m.createdAt].filter(Boolean).join(' · ')
    return \`<div class="mem-item">
      <span class="mem-icon">◈</span>
      <div>
        <div class="mem-text">\${escHtml(String(text))}</div>
        \${meta ? \`<div class="mem-meta">\${escHtml(meta)}</div>\` : ''}
      </div>
    </div>\`
  }).join('')
}

let memSearchTimer = null
document.getElementById('mem-search').addEventListener('input', e => {
  clearTimeout(memSearchTimer)
  const q = e.target.value.trim()
  memSearchTimer = setTimeout(async () => {
    if (!q) { renderMemory(allMemories); return }
    try {
      const data = await fetch(BASE + '/api/memory/search?q=' + encodeURIComponent(q)).then(r => r.json())
      const results = Array.isArray(data) ? data : (data.results || data.memories || [])
      renderMemory(results)
    } catch { renderMemory(allMemories.filter(m => JSON.stringify(m).toLowerCase().includes(q.toLowerCase()))) }
  }, 300)
})
document.getElementById('refresh-memory').addEventListener('click', loadMemory)

// ── Skills ───────────────────────────────────────────────────
async function loadSkills() {
  const el = document.getElementById('skills-content')
  try {
    const data = await fetch(BASE + '/api/skills/learned').then(r => r.json())
    const skills = Array.isArray(data) ? data : (data.skills || data.items || [])
    if (!skills.length) { el.innerHTML = '<p style="color:var(--text-dim)">No skills loaded.</p>'; return }
    el.innerHTML = '<div class="skill-grid">' + skills.map(s => {
      const name = s.name || s.id || '?'
      const desc = s.description || s.desc || ''
      const trigger = s.trigger || s.command || ''
      return \`<div class="scard">
        <div class="scard-name">\${escHtml(name)}</div>
        \${desc ? \`<div class="scard-desc">\${escHtml(desc)}</div>\` : ''}
        \${trigger ? \`<div class="scard-trigger">trigger: \${escHtml(trigger)}</div>\` : ''}
      </div>\`
    }).join('') + '</div>'
  } catch (err) {
    el.innerHTML = '<p style="color:var(--red)">Failed to load skills: ' + escHtml(err.message) + '</p>'
  }
}
document.getElementById('refresh-skills').addEventListener('click', loadSkills)

// ── Init ─────────────────────────────────────────────────────
chatInput.focus()
</script>
</body>
</html>`
}
