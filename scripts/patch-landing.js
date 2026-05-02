/**
 * One-shot landing.js content drift patch for v3.19.0
 * Run: node scripts/patch-landing.js
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'cloudflare-worker', 'landing.js');
let content = fs.readFileSync(FILE, 'utf8');

const log = [];

function replace(from, to, label) {
  const count = content.split(from).length - 1;
  if (count === 0) {
    log.push(`MISS:        ${label}`);
    return;
  }
  content = content.split(from).join(to);
  log.push(`OK [${count}x]:  ${label}`);
}

// ── 1. Meta description ────────────────────────────────────────────────────
replace(
  '1,400+ skills, 80+ tools, multi-provider failover',
  '1,500+ skills, 89+ tools, multi-provider failover',
  'meta description skills+tools'
);

// ── 2. All remaining 1,400+ skills ─────────────────────────────────────────
replace('1,400+ skills', '1,500+ skills', '1400->1500 skills (remaining)');

// ── 3. All 80+ tools ───────────────────────────────────────────────────────
replace('80+ tools', '89+ tools', '80->89 tools');

// ── 4. Provider pill 14+ total -> 15+ ──────────────────────────────────────
replace('14+ total', '15+', 'provider pill 14->15');

// ── 5. Instant actions count ───────────────────────────────────────────────
replace('15 instant actions', '7 instant actions', 'instant actions 15->7');

// ── 6. Linux binary buttons: remove AppImage + .deb + "Linux x64" label ───
// Replace with a brief text note. The commands below (curl / npx) remain.
const LINUX_BUTTONS =
  '<div style=\\"display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px\\"><a href=\\"https://github.com/taracodlabs/aiden-releases/releases/download/v3.16.0/Aiden-3.16.0.AppImage\\" style=\\"flex:1;min-width:165px;background:var(--bg2);border:1px solid var(--b);border-radius:8px;padding:12px 16px;text-decoration:none;color:var(--text);display:flex;align-items:center;gap:8px\\" target=\\"_blank\\" rel=\\"noopener\\"><span style=\\"font-weight:600\\">AppImage</span><span style=\\"font-size:11px;color:var(--muted)\\">any distro</span></a><a href=\\"https://github.com/taracodlabs/aiden-releases/releases/download/v3.16.0/devos-ai_3.16.0_amd64.deb\\" style=\\"flex:1;min-width:165px;background:var(--bg2);border:1px solid var(--b);border-radius:8px;padding:12px 16px;text-decoration:none;color:var(--text);display:flex;align-items:center;gap:8px\\" target=\\"_blank\\" rel=\\"noopener\\"><span style=\\"font-weight:600\\">.deb</span><span style=\\"font-size:11px;color:var(--muted)\\">Ubuntu / Debian</span></a></div>\\n      <div style=\\"font-family:var(--mono);font-size:11px;color:var(--muted);text-align:center;margin-bottom:14px\\">Linux x64</div>';

const LINUX_NOTE =
  '<div style=\\"font-family:var(--mono);font-size:11px;color:var(--muted3);text-align:center;margin-bottom:14px\\">Linux &amp; macOS: install via npm using the commands below. Native installers: Windows only.</div>';

replace(LINUX_BUTTONS, LINUX_NOTE, 'Linux binary buttons -> npm note');

// ── 7. "or via CLI:" label — clarify for Linux/macOS context ───────────────
replace(
  '<div style=\\"font-family:var(--mono);font-size:11px;color:var(--muted);text-align:center;margin-bottom:6px\\">or via CLI:</div>',
  '<div style=\\"font-family:var(--mono);font-size:11px;color:var(--muted);text-align:center;margin-bottom:6px\\">Linux &amp; macOS — install via CLI:</div>',
  '"or via CLI" label -> Linux & macOS'
);

// ── Write ───────────────────────────────────────────────────────────────────
fs.writeFileSync(FILE, content, 'utf8');

console.log('\nPatch results:');
log.forEach(l => console.log(' ', l));
console.log('\nDone. Verify with: node -e "const f=require(\'fs\');const c=f.readFileSync(\'cloudflare-worker/landing.js\',\'utf8\');[\'1,400\',\'80+ tools\',\'14+ total\',\'15 instant\',\'AppImage\',\'1,500\',\'89+ tools\'].forEach(s=>console.log(s,(c.includes(s)?\'FOUND\':\'gone\')));"');
