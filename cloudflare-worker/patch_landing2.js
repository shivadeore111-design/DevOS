// patch_landing2.js — removes Pro pricing, adds Free+OS and Business sections
// Run with: node patch_landing2.js
//
// Strategy: HTML in landing.js is one big JS string where " → \" and newline → \n (literal).
// We write new HTML cleanly, then toLandingStr() converts it to the file's format.

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'landing.js');
let s = fs.readFileSync(FILE, 'utf8');
const origLen = s.length;

// ── Helpers ───────────────────────────────────────────────────────────────────

function bail(msg) { console.error('FAIL:', msg); process.exit(1); }

// Convert normal HTML (real " and real newlines) to landing.js escaped format
function esc(html) {
  return html.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

// ── PART 1: Replace pricing HTML section ─────────────────────────────────────
// Delete: \n\n<section id="download"> ... </div>  (everything up to roadmap's <div class="wrap">)
// Insert: FREE section + FOR TEAMS section + new roadmap <section> opener

const PRICING_OPEN  = '\\n\\n<section class=\\"wl-wrap z\\" id=\\"download\\">';
const ROADMAP_STAG  = '<div class=\\"stag\\">ROADMAP';
const WRAP_DIV      = '<div class=\\"wrap\\">';

const pricingStart  = s.indexOf(PRICING_OPEN);
if (pricingStart === -1) bail('pricing section not found');

const roadmapStagPos = s.indexOf(ROADMAP_STAG, pricingStart);
if (roadmapStagPos === -1) bail('roadmap stag not found');

const roadmapWrapPos = s.lastIndexOf(WRAP_DIV, roadmapStagPos);
if (roadmapWrapPos === -1) bail('roadmap wrap not found');

console.log('Pricing start:', pricingStart);
console.log('Roadmap wrap:', roadmapWrapPos);
console.log('HTML delete size:', roadmapWrapPos - pricingStart, 'chars');

// ── New HTML: FREE AND OPEN SOURCE section ────────────────────────────────────

const LI = (text) =>
  `          <li style="font-family:var(--mono);font-size:12px;color:var(--muted2);display:flex;gap:8px">` +
  `<span style="color:var(--green);flex-shrink:0">&#10003;</span>${text}</li>`;

const CARD_STYLE      = `background:var(--bg1);border:1px solid var(--b);border-radius:16px;padding:32px 24px`;
const CARD_STYLE_GRN  = `background:var(--bg1);border:1px solid rgba(34,197,94,0.35);border-radius:16px;padding:32px 24px;position:relative`;
const CARD_STYLE_ORG  = `background:var(--bg1);border:1px solid rgba(249,115,22,0.25);border-radius:16px;padding:32px 24px`;
const UL_STYLE        = `list-style:none;padding:0;margin:0 0 28px;display:flex;flex-direction:column;gap:10px`;
const LABEL_STYLE     = `font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.12em;margin-bottom:12px`;
const PRICE_STYLE     = `font-family:var(--mono);font-size:40px;font-weight:800;color:var(--text);line-height:1;margin-bottom:4px`;
const SUB_STYLE       = `font-family:var(--mono);font-size:11px;color:var(--muted);margin-bottom:24px`;
const BADGE_STYLE     = `position:absolute;top:-12px;left:50%;transform:translateX(-50%);font-family:var(--mono);font-size:10px;font-weight:700;padding:4px 14px;border-radius:20px;white-space:nowrap`;

const freeSectionHtml = `

<section class="wl-wrap z" id="download">
  <div class="wrap">
    <div class="shd" style="text-align:center">
      <div class="stag" style="justify-content:center">PRICING</div>
      <h2>Free and open source.<br><span style="color:var(--green)">Built for developers.</span></h2>
      <p>No subscriptions. No paywalls. Download, run, and build.</p>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;max-width:900px;margin:0 auto 48px">

      <!-- Free Forever -->
      <div style="${CARD_STYLE}">
        <div style="${LABEL_STYLE};color:var(--muted)">Free Forever</div>
        <div style="${PRICE_STYLE}">$0</div>
        <div style="${SUB_STYLE}">always</div>
        <ul style="${UL_STYLE}">
${LI('All 56 skills included')}
${LI('60+ built-in tools')}
${LI('13 AI providers supported')}
${LI('Local Ollama — fully private')}
${LI('No account required')}
${LI('Commercial use OK (AGPL-3.0)')}
        </ul>
        <a href="https://github.com/taracodlabs/aiden-releases/releases/latest" target="_blank" rel="noopener" class="btnp" style="width:100%;font-size:14px;padding:12px;display:block;text-align:center;text-decoration:none;box-sizing:border-box">Download free &#8594;</a>
      </div>

      <!-- Open Source -->
      <div style="${CARD_STYLE_GRN}">
        <div style="${BADGE_STYLE};background:var(--green);color:#000">AGPL-3.0</div>
        <div style="${LABEL_STYLE};color:var(--green)">Open Source</div>
        <div style="${PRICE_STYLE}">&#60;/&#62;</div>
        <div style="${SUB_STYLE}">full source on GitHub</div>
        <ul style="${UL_STYLE}">
${LI('Auditable &amp; forkable')}
${LI('Community contributions welcome')}
${LI('Self-host or modify freely')}
${LI('No vendor lock-in')}
${LI('Transparent roadmap')}
${LI('Fork it. Make it yours.')}
        </ul>
        <a href="https://github.com/taracodlabs/aiden-releases" target="_blank" rel="noopener" style="font-family:var(--mono);font-size:13px;color:var(--green);text-decoration:none">View on GitHub &#8594;</a>
      </div>

      <!-- Local First -->
      <div style="${CARD_STYLE}">
        <div style="${LABEL_STYLE};color:var(--muted)">Local First</div>
        <div style="${PRICE_STYLE}">&#128274;</div>
        <div style="${SUB_STYLE}">100% private</div>
        <ul style="${UL_STYLE}">
${LI('Runs on your machine')}
${LI('Zero data sent to cloud')}
${LI('Works offline with Ollama')}
${LI('Your data stays yours')}
${LI('No telemetry by default')}
${LI('Air-gap compatible')}
        </ul>
        <a href="#features" style="font-family:var(--mono);font-size:13px;color:var(--muted3);text-decoration:none">See how it works &#8594;</a>
      </div>

    </div>
  </div>
</section>

<section class="z" id="business" style="padding:0 0 80px">
  <div class="wrap">
    <div class="shd" style="text-align:center;padding:0 0 40px">
      <div class="stag" style="justify-content:center">FOR TEAMS</div>
      <h2>Custom skills.<br><span style="color:var(--orange)">Serious automation.</span></h2>
      <p>Need Aiden wired into your stack? We build bespoke integrations and provide enterprise support.</p>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;max-width:900px;margin:0 auto 48px">

      <!-- Custom Skills -->
      <div style="${CARD_STYLE_ORG}">
        <div style="${LABEL_STYLE};color:var(--muted)">Custom Skills</div>
        <div style="${PRICE_STYLE}">$1,500</div>
        <div style="${SUB_STYLE}">/ skill</div>
        <ul style="${UL_STYLE}">
${LI('We build the skill for you')}
${LI('Any API or internal tool')}
${LI('Deployed to your instance')}
${LI('Full source included')}
${LI('2 revision rounds')}
${LI('Delivered in 2 weeks')}
        </ul>
        <a href="mailto:hello@taracod.com" style="font-family:var(--mono);font-size:13px;color:var(--orange);text-decoration:none">Get in touch &#8594;</a>
      </div>

      <!-- Sponsored Partnerships -->
      <div style="${CARD_STYLE_ORG}">
        <div style="${LABEL_STYLE};color:var(--muted)">Sponsored Partnerships</div>
        <div style="${PRICE_STYLE}" class="o">Custom</div>
        <div style="${SUB_STYLE}">fund a feature or skill</div>
        <ul style="${UL_STYLE}">
${LI('Fund a skill or feature')}
${LI('Logo &amp; attribution in README')}
${LI('Priority roadmap slot')}
${LI('Co-announce opportunity')}
${LI('Early access to new releases')}
${LI('Permanent contributor credit')}
        </ul>
        <a href="mailto:hello@taracod.com" style="font-family:var(--mono);font-size:13px;color:var(--orange);text-decoration:none">Partner with us &#8594;</a>
      </div>

      <!-- Self-Hosted Enterprise -->
      <div style="${CARD_STYLE_ORG}">
        <div style="${LABEL_STYLE};color:var(--muted)">Self-Hosted Enterprise</div>
        <div style="${PRICE_STYLE}" class="o">Custom</div>
        <div style="${SUB_STYLE}">air-gapped deployment</div>
        <ul style="${UL_STYLE}">
${LI('Air-gapped deployment')}
${LI('SSO &amp; access controls')}
${LI('Dedicated support channel')}
${LI('Custom model integrations')}
${LI('SLA available')}
${LI('On-prem or private cloud')}
        </ul>
        <a href="mailto:hello@taracod.com" style="font-family:var(--mono);font-size:13px;color:var(--orange);text-decoration:none">Talk to us &#8594;</a>
      </div>

    </div>

    <div style="text-align:center;margin-top:8px">
      <a href="mailto:hello@taracod.com" style="font-family:var(--mono);font-size:12px;color:var(--muted);text-decoration:none">hello@taracod.com</a>
    </div>
  </div>
</section>

<section class="z" style="padding:0 0 80px">
`;
// NOTE: no </section> — the existing one at char ~113451 closes this roadmap section

// Apply HTML replacement
const escapedInsert = esc(freeSectionHtml);
s = s.slice(0, pricingStart) + escapedInsert + s.slice(roadmapWrapPos);
console.log('✓ HTML section replaced (pricing → FREE+TEAMS+roadmap-opener)');

// ── PART 2: Delete obsolete JS functions ──────────────────────────────────────
// Delete from: \n\nfunction showDownload(){
// To (exclusive): (function(){ \n  const SESSIONS=  (the demo sessions IIFE)
//
// Unique end marker: the event listener that ends just before the sessions IIFE

const JS_DELETE_START = '\\n\\nfunction showDownload(){';
const JS_DELETE_END   = '\\n\\n(function(){\\n  const SESSIONS=';

const jsFnStart = s.indexOf(JS_DELETE_START);
if (jsFnStart === -1) bail('JS delete start (showDownload) not found');

const jsFnEnd = s.indexOf(JS_DELETE_END, jsFnStart);
if (jsFnEnd === -1) bail('JS delete end (SESSIONS IIFE) not found');

console.log('JS delete start:', jsFnStart);
console.log('JS delete end:', jsFnEnd);
console.log('JS delete size:', jsFnEnd - jsFnStart, 'chars');

// Verify the functions we expect to delete are in this range
const jsBlock = s.slice(jsFnStart, jsFnEnd);
['showDownload', 'joinWL', 'PRICES', 'setCurrency', 'selectPlan', 'startCheckout', 'closeCheckout', 'initiatePayment', 'Razorpay'].forEach(fn => {
  if (!jsBlock.includes(fn)) console.warn('  ⚠ not found in JS block (may be OK):', fn);
  else console.log('  ✓ found in JS delete block:', fn);
});

s = s.slice(0, jsFnStart) + s.slice(jsFnEnd);
console.log('✓ JS functions deleted');

// ── PART 3: Verify ────────────────────────────────────────────────────────────
function countOcc(str, needle) {
  let n = 0, idx = 0;
  while ((idx = str.indexOf(needle, idx)) !== -1) { n++; idx++; }
  return n;
}

console.log('\n── Verification ─────────────────────────────────────────────');
const checks = [
  { label: 'v3.6.0 (should be 0)',          needle: 'v3.6.0',               expect: 0  },
  { label: 'Pro Monthly (should be 0)',      needle: 'Pro Monthly',          expect: 0  },
  { label: 'Pro Annual (should be 0)',       needle: 'Pro Annual',           expect: 0  },
  { label: 'PRICES (should be 0)',           needle: 'var PRICES=',          expect: 0  },
  { label: 'startCheckout (should be 0)',    needle: 'startCheckout',        expect: 0  },
  { label: 'initiatePayment (should be 0)',  needle: 'initiatePayment',      expect: 0  },
  { label: 'Razorpay (should be 0)',         needle: 'Razorpay',             expect: 0  },
  { label: 'launchPriceBanner (should be 0)',needle: 'launchPriceBanner',    expect: 0  },
  { label: 'id="business" (should be 1)',    needle: 'id=\\"business\\"',    expect: 1  },
  { label: 'FOR TEAMS (should be 1+)',       needle: 'FOR TEAMS',            expect: 1  },
  { label: 'Custom Skills (should be 1)',    needle: 'Custom Skills',        expect: 1  },
  { label: 'hello@taracod.com (should be 3+)',needle:'hello@taracod.com',   expect: 3  },
  { label: 'AGPL (should be 2+)',            needle: 'AGPL',                 expect: 2  },
  { label: 'id="download" (should be 1)',    needle: 'id=\\"download\\"',    expect: 1  },
];

let failures = 0;
checks.forEach(({ label, needle, expect }) => {
  const count = countOcc(s, needle);
  const ok = expect === 0 ? count === 0 : count >= expect;
  if (ok) console.log(`  ✓ ${label}: ${count}`);
  else { console.error(`  ✗ ${label}: got ${count}`); failures++; }
});

if (failures > 0) {
  console.error(`\n${failures} verification checks failed — NOT writing file.`);
  process.exit(1);
}

// ── Write back ────────────────────────────────────────────────────────────────
fs.writeFileSync(FILE, s);
console.log(`\n✓ Done. File: ${s.length} bytes (was ${origLen} bytes, delta ${s.length - origLen})`);
