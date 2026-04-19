// patch_landing5.js — contact page, CTA rewire, nav rename
// PART 1: Nav + footer "roadmap" → "requests" (text only, href unchanged)
// PART 2: FOR TEAMS CTA links → /contact?type=…
// PART 3: Add contact routes to fetch handler
// PART 4: Append contact_functions.js to landing.js
// Run with: node patch_landing5.js

const fs   = require('fs');
const path = require('path');

const FILE         = path.join(__dirname, 'landing.js');
const CONTACT_FILE = path.join(__dirname, 'contact_functions.js');

let s = fs.readFileSync(FILE, 'utf8');
const origLen = s.length;

function bail(msg) { console.error('FAIL:', msg); process.exit(1); }

function rep(label, oldStr, newStr) {
  if (!s.includes(oldStr)) bail(`NOT FOUND: ${label}`);
  s = s.replace(oldStr, newStr);
  console.log('  \u2713', label);
}

function cnt(str, needle) {
  let n = 0, i = 0;
  while ((i = str.indexOf(needle, i)) !== -1) { n++; i++; }
  return n;
}

// ── PART 1: roadmap → requests ────────────────────────────────────────────

const ROADMAP_OLD = 'href=\\"#request\\">roadmap</a>';
const ROADMAP_NEW = 'href=\\"#request\\">requests</a>';

const roadmapCount = cnt(s, ROADMAP_OLD);
if (roadmapCount !== 2) bail(`Expected 2 roadmap nav/footer links, found ${roadmapCount}`);
s = s.split(ROADMAP_OLD).join(ROADMAP_NEW);
console.log('  \u2713 roadmap \u2192 requests (nav + footer, 2 occurrences)');

// ── PART 2: FOR TEAMS CTA rewire ─────────────────────────────────────────

const CTA_STYLE = 'style=\\"font-family:var(--mono);font-size:13px;color:var(--orange);text-decoration:none\\">';

rep(
  'CTA1: Get in touch \u2192 /contact?type=custom-skills',
  'href=\\"mailto:hello@taracod.com\\" ' + CTA_STYLE + 'Get in touch &#8594;</a>',
  'href=\\"/contact?type=custom-skills\\" ' + CTA_STYLE + 'Get in touch &#8594;</a>'
);

rep(
  'CTA2: Partner with us \u2192 /contact?type=sponsored',
  'href=\\"mailto:hello@taracod.com\\" ' + CTA_STYLE + 'Partner with us &#8594;</a>',
  'href=\\"/contact?type=sponsored\\" ' + CTA_STYLE + 'Partner with us &#8594;</a>'
);

rep(
  'CTA3: Talk to us \u2192 /contact?type=enterprise',
  'href=\\"mailto:hello@taracod.com\\" ' + CTA_STYLE + 'Talk to us &#8594;</a>',
  'href=\\"/contact?type=enterprise\\" ' + CTA_STYLE + 'Talk to us &#8594;</a>'
);

// ── PART 3: Add contact routes ────────────────────────────────────────────

// NOTE: real JS zone in landing.js uses \r\n line endings (Windows)
const ROUTE_NEEDLE = "    if (pathname === '/install.ps1')   return installPs1Route();\r\n\r\n    return new Response(html, {";

const ROUTE_NEW =
  "    if (pathname === '/install.ps1')   return installPs1Route();\r\n" +
  "    if (pathname === '/contact' && request.method !== 'POST')         return contactPage(url);\r\n" +
  "    if (pathname === '/contact/success') return contactSuccessPage(url);\r\n" +
  "    if (pathname === '/api/contact' && request.method === 'POST') return contactApiHandler(request, env);\r\n" +
  "\r\n" +
  "    return new Response(html, {";

rep('Add contact routes to fetch handler', ROUTE_NEEDLE, ROUTE_NEW);

// ── PART 4: Append contact functions ─────────────────────────────────────

const contactFunctions = fs.readFileSync(CONTACT_FILE, 'utf8');
s = s + '\n' + contactFunctions;
console.log('  \u2713 Appended contact_functions.js');

// ── Verification ──────────────────────────────────────────────────────────

console.log('\n\u2500\u2500 Verification \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
const checks = [
  { label: 'roadmap (should be 2 body-text, 0 nav/footer links)', needle: '>roadmap</a>', expect: 0 },
  { label: 'requests nav/footer links (should be 2)',              needle: '>requests</a>', expect: 2 },
  { label: 'mailto:hello@taracod in FOR TEAMS CTAs (should be 0)', needle: 'href=\\"mailto:hello@taracod.com\\" ' + CTA_STYLE, expect: 0 },
  { label: '/contact?type=custom-skills CTA (should be 1)',        needle: 'href=\\"/contact?type=custom-skills\\"', expect: 1 },
  { label: '/contact?type=sponsored CTA (should be 1)',            needle: 'href=\\"/contact?type=sponsored\\"', expect: 1 },
  { label: '/contact?type=enterprise CTA (should be 1)',           needle: 'href=\\"/contact?type=enterprise\\"', expect: 1 },
  { label: 'contactPage route (should be 1)',                      needle: "pathname === '/contact'", expect: 1 },
  { label: 'contactSuccessPage route (should be 1)',               needle: "pathname === '/contact/success'", expect: 1 },
  { label: 'contactApiHandler route (should be 1)',                needle: "pathname === '/api/contact'", expect: 1 },
  { label: 'function contactPage (should be 1)',                   needle: 'function contactPage(', expect: 1 },
  { label: 'function contactSuccessPage (should be 1)',            needle: 'function contactSuccessPage(', expect: 1 },
  { label: 'function contactApiHandler (should be 1)',             needle: 'function contactApiHandler(', expect: 1 },
  { label: 'function escHtml (should be 1)',                       needle: 'function escHtml(', expect: 1 },
  { label: 'CONTACT_SUBMISSIONS KV ref (should be 1)',             needle: 'CONTACT_SUBMISSIONS', expect: 1 },
  { label: 'RESEND_API_KEY ref (should be 1)',                     needle: 'RESEND_API_KEY', expect: 1 },
  { label: 'irm aiden.taracod.com still present (should be 1)',   needle: 'irm aiden.taracod.com', expect: 1 },
  { label: 'ONE COMMAND TO INSTALL still present (should be 1)',  needle: 'ONE COMMAND TO INSTALL', expect: 1 },
];

let failures = 0;
checks.forEach(({ label, needle, expect }) => {
  const count = cnt(s, needle);
  const ok = expect === 0 ? count === 0 : count >= expect;
  if (ok) console.log(`  \u2713 ${label}: ${count}`);
  else { console.error(`  \u2717 ${label}: got ${count}, expected ${expect === 0 ? '0' : '>=' + expect}`); failures++; }
});

// Section balance
const secOpen  = cnt(s, '<section');
const secClose = cnt(s, '</section>');
console.log(`\n  Section balance: ${secOpen} open / ${secClose} close`, secOpen === secClose ? '\u2713' : '\u2717 MISMATCH');
if (secOpen !== secClose) failures++;

// Syntax check: function count
const funcCount = cnt(s, 'function ');
console.log(`  Function declarations: ${funcCount}`);

if (failures > 0) {
  console.error(`\n${failures} verification checks failed \u2014 NOT writing file.`);
  process.exit(1);
}

// ── Write back ────────────────────────────────────────────────────────────
fs.writeFileSync(FILE, s);
console.log(`\n\u2713 Done. File: ${s.length} bytes (was ${origLen} bytes, delta +${s.length - origLen})`);
