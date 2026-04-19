// patch_landing4.js — install hero redesign + FOR TEAMS pricing cleanup
// PART 1: Replace 3-card grid in id="download" with install hero
// PART 2: Remove dollar amounts from FOR TEAMS cards, add descriptive text
// Run with: node patch_landing4.js

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'landing.js');
let s = fs.readFileSync(FILE, 'utf8');
const origLen = s.length;

function bail(msg) { console.error('FAIL:', msg); process.exit(1); }

// Convert clean HTML (real " and real newlines) to landing.js escaped format
function esc(html) {
  return html.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

// Simple exact string replace with bail on not found
function rep(label, oldStr, newStr) {
  if (!s.includes(oldStr)) bail(`NOT FOUND: ${label}`);
  s = s.replace(oldStr, newStr);
  console.log('  ✓', label);
}

// ── PART 1A: Update stag PRICING → FREE AND OPEN SOURCE ─────────────────────

const DL_IDX = s.indexOf('id=\\"download\\"');
if (DL_IDX === -1) bail('id=download not found');

const STAG_OLD = 'PRICING</div>\\n      <h2>Free and open source.<br><span style=\\"color:var(--green)\\">Built for developers.</span></h2>';
const STAG_NEW = 'FREE AND OPEN SOURCE</div>\\n      <h2>Aiden is free. Forever.</h2>';

// Verify it's in the download section
if (s.indexOf(STAG_OLD, DL_IDX) === -1) bail('stag+h2 block not found in download section');
rep('stag PRICING → FREE AND OPEN SOURCE + h2 update', STAG_OLD, STAG_NEW);

// ── PART 1B: Replace 3-card grid with install hero ───────────────────────────

// Find grid start: \n\n    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;...">
const GRID_OPEN_NEEDLE = '\\n\\n    <div style=\\"display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;max-width:900px;margin:0 auto 48px\\">';
const gridOpenIdx = s.indexOf(GRID_OPEN_NEEDLE, DL_IDX);
if (gridOpenIdx === -1) bail('grid opening div not found in download section');

// Find grid close: \n\n    </div>  (grid's own closing tag, after the 3 cards)
// followed by \n  </div>\n</section> which we KEEP
const GRID_WRAP_CLOSE = '\\n\\n    </div>\\n  </div>\\n</section>';
const gridCloseIdx = s.indexOf(GRID_WRAP_CLOSE, gridOpenIdx);
if (gridCloseIdx === -1) bail('grid wrap close not found');

// The old content to delete: grid open + 3 cards + grid's closing </div>
// grid's closing </div> is: \n\n    </div> = 14 chars
const GRID_CLOSE_DIV = '\\n\\n    </div>';  // 14 chars at runtime: \n\n    </div>
const gridEnd = gridCloseIdx + GRID_CLOSE_DIV.length;

console.log(`Grid region: ${gridOpenIdx} → ${gridEnd} (${gridEnd - gridOpenIdx} chars)`);

// New install hero HTML (clean, will be esc()'d)
const installHeroHtml = `


    <div style="max-width:680px;margin:0 auto 48px">
      <div style="font-family:var(--mono);font-size:10px;color:var(--muted);letter-spacing:.1em;text-transform:uppercase;text-align:center;margin-bottom:16px">ONE COMMAND TO INSTALL</div>
      <div style="background:var(--bg2);border:1px solid var(--b);border-radius:8px;padding:16px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px">
        <span style="font-family:var(--mono);font-size:15px;color:var(--text)"><span style="color:var(--muted)">$ </span>irm aiden.taracod.com/install.ps1 | iex</span>
        <button onclick="(function(b){navigator.clipboard.writeText('irm aiden.taracod.com/install.ps1 | iex');b.textContent='copied ✓';setTimeout(function(){b.textContent='copy'},1500)})(this)" style="font-family:var(--mono);font-size:11px;color:var(--orange);background:transparent;border:1px solid rgba(249,115,22,.3);border-radius:4px;padding:4px 10px;cursor:pointer;flex-shrink:0;white-space:nowrap">copy</button>
      </div>
      <div style="font-family:var(--mono);font-size:11px;color:var(--muted);text-align:center;margin-bottom:24px">Windows 10/11 · PowerShell 5.1+</div>
      <div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin-bottom:24px">
        <a href="https://github.com/taracodlabs/aiden-releases/releases/download/v3.7.0/Aiden-Setup-3.7.0.exe" class="ncta" style="text-decoration:none;padding:10px 20px">Download installer &#8594;</a>
        <a href="https://github.com/taracodlabs/aiden-releases" target="_blank" rel="noopener" class="gbtn">View on GitHub &#8594;</a>
      </div>
      <div style="border-top:1px solid var(--b);margin-bottom:20px"></div>
      <div style="font-family:var(--mono);font-size:11px;color:var(--muted);text-align:center;line-height:1.8">All 56 skills · 60+ tools · 13 providers · Local Ollama · AGPL-3.0 · No account · No telemetry</div>
    </div>`;

const escapedHero = esc(installHeroHtml);
s = s.slice(0, gridOpenIdx) + escapedHero + s.slice(gridEnd);
console.log('  ✓ 3-card grid replaced with install hero');

// ── PART 2: FOR TEAMS card updates ──────────────────────────────────────────

// Recompute business section index after PART 1 changes
const BIZ_IDX = s.indexOf('id=\\"business\\"');
if (BIZ_IDX === -1) bail('id=business not found after part 1');

// ── Card 1: Custom Skills ─────────────────────────────────────────────────
const C1_OLD = '<div style=\\"font-family:var(--mono);font-size:40px;font-weight:800;color:var(--text);line-height:1;margin-bottom:4px\\">$1,500</div>\\n        <div style=\\"font-family:var(--mono);font-size:11px;color:var(--muted);margin-bottom:24px\\">/ skill</div>';
const c1NewHtml = '<div style="font-family:var(--mono);font-size:13px;color:var(--muted);margin-bottom:12px">Typical engagement: 2\u20136 weeks</div>\n        <p style="font-family:var(--mono);font-size:12px;color:var(--muted2);line-height:1.6;margin:0 0 20px">We build custom Aiden skills wired into your stack \u2014 any API, any internal tool, fully integrated with your workflows. Source included, deployed to your instance, delivered in weeks not months.</p>';
const C1_NEW = esc(c1NewHtml);

if (s.indexOf(C1_OLD, BIZ_IDX) === -1) bail('Card 1 $1,500 block not found in business section');
s = s.replace(C1_OLD, C1_NEW);
console.log('  ✓ Card 1: $1,500 / skill → Typical engagement');

// ── Card 2: Sponsored Partnerships ──────────────────────────────────────
const C2_OLD = '<div style=\\"font-family:var(--mono);font-size:40px;font-weight:800;color:var(--text);line-height:1;margin-bottom:4px\\" class=\\"o\\">Custom</div>\\n        <div style=\\"font-family:var(--mono);font-size:11px;color:var(--muted);margin-bottom:24px\\">fund a feature or skill</div>';
const c2NewHtml = '<div style="font-family:var(--mono);font-size:13px;color:var(--muted);margin-bottom:12px">Ideal for API providers, dev tools, and fintechs</div>\n        <p style="font-family:var(--mono);font-size:12px;color:var(--muted2);line-height:1.6;margin:0 0 20px">Fund a feature or skill that ships in the public release. Your logo and attribution in the README, priority placement on the roadmap, and permanent contributor credit.</p>';
const C2_NEW = esc(c2NewHtml);

if (s.indexOf(C2_OLD, BIZ_IDX) === -1) bail('Card 2 Sponsored block not found');
s = s.replace(C2_OLD, C2_NEW);
console.log('  ✓ Card 2: Custom / fund a feature → Ideal for API providers');

// ── Card 3: Self-Hosted Enterprise ───────────────────────────────────────
const C3_OLD = '<div style=\\"font-family:var(--mono);font-size:40px;font-weight:800;color:var(--text);line-height:1;margin-bottom:4px\\" class=\\"o\\">Custom</div>\\n        <div style=\\"font-family:var(--mono);font-size:11px;color:var(--muted);margin-bottom:24px\\">air-gapped deployment</div>';
const c3NewHtml = '<div style="font-family:var(--mono);font-size:13px;color:var(--muted);margin-bottom:12px">Custom pricing based on scope</div>\n        <p style="font-family:var(--mono);font-size:12px;color:var(--muted2);line-height:1.6;margin:0 0 20px">Air-gapped deployment, SSO and access controls, dedicated support channel, custom model integrations, SLA options. Run Aiden fully on-prem or in your private cloud.</p>';
const C3_NEW = esc(c3NewHtml);

if (s.indexOf(C3_OLD, BIZ_IDX) === -1) bail('Card 3 Enterprise block not found');
s = s.replace(C3_OLD, C3_NEW);
console.log('  ✓ Card 3: Custom / air-gapped → Custom pricing based on scope');

// ── PART 3: Verify ────────────────────────────────────────────────────────

function cnt(str, needle) {
  let n = 0, i = 0;
  while ((i = str.indexOf(needle, i)) !== -1) { n++; i++; }
  return n;
}

console.log('\n── Verification ───────────────────────────────────────────');
const checks = [
  { label: '&#128274; (lock emoji entity, should be 0)',  needle: '&#128274;',                 expect: 0 },
  { label: '$1,500 (should be 0)',                        needle: '$1,500',                    expect: 0 },
  { label: 'fund a feature or skill (should be 0)',       needle: 'fund a feature or skill',   expect: 0 },
  { label: 'air-gapped deployment sub (should be 0)',     needle: '>air-gapped deployment<',   expect: 0 },
  { label: '/ skill sub (should be 0)',                   needle: '">/ skill</div>',            expect: 0 },
  { label: 'irm aiden.taracod.com (should be ≥1)',        needle: 'irm aiden.taracod.com',     expect: 1 },
  { label: 'ONE COMMAND TO INSTALL (should be 1)',        needle: 'ONE COMMAND TO INSTALL',    expect: 1 },
  { label: 'Typical engagement (should be 1)',            needle: 'Typical engagement',        expect: 1 },
  { label: 'Ideal for API providers (should be 1)',       needle: 'Ideal for API providers',   expect: 1 },
  { label: 'Custom pricing based on scope (should be 1)', needle: 'Custom pricing based on scope', expect: 1 },
  { label: 'id=download (should be 1)',                   needle: 'id=\\"download\\"',         expect: 1 },
  { label: 'id=business (should be 1)',                   needle: 'id=\\"business\\"',         expect: 1 },
  { label: 'FREE AND OPEN SOURCE stag (should be 1)',     needle: '>FREE AND OPEN SOURCE<',    expect: 1 },
  { label: 'Aiden is free. Forever. (should be 1)',       needle: 'Aiden is free. Forever.',   expect: 1 },
  { label: 'install.ps1 command (should be ≥1)',          needle: 'install.ps1',               expect: 1 },
];

let failures = 0;
checks.forEach(({ label, needle, expect }) => {
  const count = cnt(s, needle);
  const ok = expect === 0 ? count === 0 : count >= expect;
  if (ok) console.log(`  ✓ ${label}: ${count}`);
  else { console.error(`  ✗ ${label}: got ${count}`); failures++; }
});

// Count <section> and </section> for balance
const secOpen  = cnt(s, '<section');
const secClose = cnt(s, '</section>');
console.log(`\n  Section balance: ${secOpen} open / ${secClose} close`, secOpen === secClose ? '✓' : '✗ MISMATCH');
if (secOpen !== secClose) failures++;

if (failures > 0) {
  console.error(`\n${failures} verification checks failed — NOT writing file.`);
  process.exit(1);
}

// ── Write back ────────────────────────────────────────────────────────────
fs.writeFileSync(FILE, s);
console.log(`\n✓ Done. File: ${s.length} bytes (was ${origLen} bytes, delta ${s.length - origLen})`);
